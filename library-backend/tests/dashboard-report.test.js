const jwt = require('jsonwebtoken');
const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../app');
const config = require('../app/config');
const { Book, User, Loan, RenewalRequest, Fine } = require('../app/models');
const dashboardService = require('../app/services/dashboard.service');
const reportService = require('../app/services/report.service');
const { dashboardChartsQuerySchema, reportDateRangeSchema } = require('../app/validators/dashboard.validator');

const adminId = '507f1f77bcf86cd799439021';

describe('BE-31: Dashboard and Excel reports', () => {
  beforeEach(() => jest.restoreAllMocks());

  describe('validators', () => {
    it('accepts supported chart ranges and rejects unknown values', () => {
      expect(dashboardChartsQuerySchema.validate({ range: '7d' }).error).toBeUndefined();
      expect(dashboardChartsQuerySchema.validate({ range: '30d' }).error).toBeUndefined();
      expect(dashboardChartsQuerySchema.validate({ range: '12m' }).error).toBeUndefined();
      expect(dashboardChartsQuerySchema.validate({ range: 'all' }).error).toBeDefined();
    });

    it('validates an optional report date range and rejects reversed dates', () => {
      expect(reportDateRangeSchema.validate({ from: '2026-01-01', to: '2026-01-31' }).error).toBeUndefined();
      expect(reportDateRangeSchema.validate({ from: '2026-02-01', to: '2026-01-01' }).error).toBeDefined();
      expect(reportDateRangeSchema.validate({ from: 'bad-date' }).error).toBeDefined();
    });
  });

  describe('dashboard service', () => {
    it('returns summary counts and total unpaid fine amount', async () => {
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(80);
      jest.spyOn(Book, 'aggregate').mockResolvedValue([{ total: 145 }]);
      jest.spyOn(User, 'countDocuments').mockResolvedValue(32);
      jest.spyOn(Loan, 'countDocuments')
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
      jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Fine, 'aggregate').mockResolvedValue([{ count: 5, amount: 75000 }]);

      const result = await dashboardService.getSummary();

      expect(result).toEqual({
        totalBooks: 80,
        totalBookCopies: 145,
        totalReaders: 32,
        borrowingLoans: 12,
        overdueLoans: 4,
        pendingLoans: 3,
        pendingRenewals: 2,
        unpaidFines: { count: 5, amount: 75000 },
      });
      expect(Loan.countDocuments).toHaveBeenNthCalledWith(1, { status: 'borrowing' });
      expect(Fine.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        { $match: { status: 'unpaid' } },
      ]));
    });

    it('builds zero-filled daily series and aggregates chart data for the chosen range', async () => {
      jest.spyOn(Loan, 'aggregate')
        .mockResolvedValueOnce([{ period: '2026-11-01', count: 2 }])
        .mockResolvedValueOnce([{ bookId: 'book-id', title: 'Sách A', borrowCount: 4 }])
        .mockResolvedValueOnce([{ categoryId: 'category-id', name: 'Văn học', borrowCount: 4 }]);
      jest.spyOn(Fine, 'aggregate').mockResolvedValue([{ period: '2026-11-01', amount: 5000 }]);

      const result = await dashboardService.getCharts('7d', new Date('2026-11-03T12:00:00.000Z'));

      expect(result.range).toBe('7d');
      expect(result.loansByPeriod).toHaveLength(7);
      expect(result.loansByPeriod.find((row) => row.period === '2026-11-01')).toEqual({ period: '2026-11-01', count: 2 });
      expect(result.loansByPeriod.filter((row) => row.count === 0)).toHaveLength(6);
      expect(result.topBooks[0]).toMatchObject({ title: 'Sách A', borrowCount: 4 });
      expect(result.borrowingsByCategory[0]).toMatchObject({ name: 'Văn học', borrowCount: 4 });
      expect(result.fineRevenueByPeriod.find((row) => row.period === '2026-11-01')).toEqual({ period: '2026-11-01', amount: 5000 });
      expect(Loan.aggregate).toHaveBeenCalledTimes(3);
      expect(Loan.aggregate.mock.calls[0][0][0].$match['items.borrowDate']).toMatchObject({ $gte: expect.any(Date), $lte: expect.any(Date) });
    });

    it('builds twelve calendar-month labels and rejects unsupported ranges', () => {
      const now = new Date('2026-11-03T12:00:00.000Z');
      const periodRange = dashboardService.resolveRange('12m', now);
      const labels = dashboardService.buildPeriodLabels(periodRange, now);

      expect(periodRange.unit).toBe('month');
      expect(labels).toHaveLength(12);
      expect(labels[0]).toBe('2025-12');
      expect(labels.at(-1)).toBe('2026-11');
      expect(() => dashboardService.resolveRange('all', now)).toThrow('Khoảng thời gian');
    });
  });

  describe('Excel report service', () => {
    it('exports loan records with Vietnamese headers and date filters', async () => {
      const query = {
        populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          code: 'PM000001', status: 'borrowing', createdAt: new Date('2026-01-02T10:00:00Z'),
          reader: { code: 'DG000001', firstName: 'An', lastName: 'Nguyen' },
          items: [{ titleSnapshot: 'Sách A', status: 'borrowing', dueDate: new Date('2026-01-16T10:00:00Z') }],
        }]),
      };
      jest.spyOn(Loan, 'find').mockReturnValue(query);

      const buffer = await reportService.exportLoans({ from: '2026-01-01', to: '2026-01-31' });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(buffer));
      const sheet = workbook.getWorksheet('Phiếu mượn');

      expect(Loan.find).toHaveBeenCalledWith({ createdAt: { $gte: expect.any(Date), $lte: expect.any(Date) } });
      expect(sheet.getRow(1).getCell(1).value).toBe('Mã phiếu');
      expect(sheet.getRow(2).getCell(1).value).toBe('PM000001');
      expect(sheet.getRow(2).getCell(8).value).toBe('Sách A');
      expect(sheet.autoFilter).toBeDefined();
    });

    it('exports fine records with Vietnamese headers', async () => {
      const query = {
        populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          reader: { code: 'DG000001', firstName: 'An', lastName: 'Nguyen' },
          loan: { code: 'PM000001' }, book: { code: 'S000001', title: 'Sách A' },
          type: 'late', amount: 5000, status: 'paid', reason: 'Trễ hạn', createdAt: new Date(), paidAt: new Date(),
        }]),
      };
      jest.spyOn(Fine, 'find').mockReturnValue(query);

      const buffer = await reportService.exportFines();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(buffer));
      const sheet = workbook.getWorksheet('Khoản phạt');

      expect(Fine.find).toHaveBeenCalledWith({});
      expect(sheet.getRow(1).getCell(1).value).toBe('Mã độc giả');
      expect(sheet.getRow(2).getCell(7).value).toBe(5000);
    });
  });

  describe('admin routes', () => {
    const token = jwt.sign({ userId: adminId }, config.jwt.accessSecret, { expiresIn: '15m' });

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: adminId, role: 'admin', status: 'active' });
    });

    it('protects dashboard and serves charts with the selected range', async () => {
      jest.spyOn(dashboardService, 'getSummary').mockResolvedValue({ totalBooks: 1 });
      jest.spyOn(dashboardService, 'getCharts').mockResolvedValue({ range: '12m' });
      const noAuth = await request(app).get('/api/v1/admin/dashboard/summary');
      const invalidRange = await request(app).get('/api/v1/admin/dashboard/charts?range=all').set('Authorization', `Bearer ${token}`);
      const charts = await request(app).get('/api/v1/admin/dashboard/charts?range=12m').set('Authorization', `Bearer ${token}`);

      expect(noAuth.statusCode).toBe(401);
      expect(invalidRange.statusCode).toBe(422);
      expect(charts.statusCode).toBe(200);
      expect(dashboardService.getCharts).toHaveBeenCalledWith('12m');
    });

    it('returns downloadable Excel files and validates date filters', async () => {
      jest.spyOn(reportService, 'exportLoans').mockResolvedValue(Buffer.from('xlsx'));
      const invalidDates = await request(app).get('/api/v1/admin/reports/loans.xlsx?from=2026-02-01&to=2026-01-01').set('Authorization', `Bearer ${token}`);
      const response = await request(app).get('/api/v1/admin/reports/loans.xlsx?from=2026-01-01').set('Authorization', `Bearer ${token}`);

      expect(invalidDates.statusCode).toBe(422);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('loans-report.xlsx');
      expect(reportService.exportLoans).toHaveBeenCalledWith({ from: '2026-01-01' });
    });
  });
});
