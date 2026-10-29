const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const config = require('../app/config');
const loanService = require('../app/services/loan.service');
const loanController = require('../app/controllers/loan.controller');
const { Loan, Book, User, Cart } = require('../app/models');
const settingsService = require('../app/services/settings.service');
const notifyService = require('../app/services/notify.service');
const countersService = require('../app/services/counters.service');
const codeUtil = require('../app/utils/code.util');
const {
  submitLoanSchema,
  getLoansQuerySchema,
  loanIdParamSchema,
} = require('../app/validators/loan.validator');

describe('BE-19: Gửi yêu cầu mượn & Phiếu của tôi', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      ip: '127.0.0.1',
      headers: {},
      body: {},
      query: {},
      params: {},
      user: {
        _id: '507f1f77bcf86cd799439011',
        role: 'reader',
        email: 'reader@example.com',
      },
      ...overrides,
    };
    const res = {
      statusCode: 200,
      jsonData: null,
      status: jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        res.jsonData = data;
        return res;
      }),
    };
    const next = jest.fn();
    return { req, res, next };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Validators kiểm tra input', () => {
    describe('submitLoanSchema', () => {
      it('hợp lệ khi có expectedPickupDate hợp lệ', () => {
        const { error, value } = submitLoanSchema.validate({
          expectedPickupDate: '2026-11-05T10:00:00.000Z',
          requestNote: 'Giao buổi sáng giúp em',
        });
        expect(error).toBeUndefined();
        expect(value.requestNote).toBe('Giao buổi sáng giúp em');
      });

      it('chấp nhận note thay cho requestNote', () => {
        const { error, value } = submitLoanSchema.validate({
          expectedPickupDate: '2026-11-05',
          note: 'Lấy tại quầy',
        });
        expect(error).toBeUndefined();
        expect(value.note).toBe('Lấy tại quầy');
      });

      it('báo lỗi khi thiếu expectedPickupDate', () => {
        const { error } = submitLoanSchema.validate({
          requestNote: 'Không có ngày nhận',
        });
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Ngày dự kiến nhận sách là bắt buộc');
      });

      it('báo lỗi khi ngày nhận không đúng định dạng', () => {
        const { error } = submitLoanSchema.validate({
          expectedPickupDate: 'ngay-mai',
        });
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Ngày dự kiến nhận sách không đúng định dạng');
      });

      it('báo lỗi khi ghi chú vượt quá 500 ký tự', () => {
        const { error } = submitLoanSchema.validate({
          expectedPickupDate: '2026-11-05',
          requestNote: 'a'.repeat(501),
        });
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Ghi chú không được vượt quá 500 ký tự');
      });
    });

    describe('getLoansQuerySchema', () => {
      it('hợp lệ với query status và phân trang chuẩn', () => {
        const { error, value } = getLoansQuerySchema.validate({
          status: 'pending',
          page: '2',
          limit: '15',
        });
        expect(error).toBeUndefined();
        expect(value.status).toBe('pending');
        expect(value.page).toBe(2);
        expect(value.limit).toBe(15);
      });

      it('báo lỗi khi status không nằm trong danh mục', () => {
        const { error } = getLoansQuerySchema.validate({
          status: 'invalid_status',
        });
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Trạng thái phiếu mượn không hợp lệ');
      });
    });

    describe('loanIdParamSchema', () => {
      it('hợp lệ với ObjectId 24 hex', () => {
        const { error } = loanIdParamSchema.validate({
          id: '507f1f77bcf86cd799439011',
        });
        expect(error).toBeUndefined();
      });

      it('báo lỗi với id sai định dạng', () => {
        const { error } = loanIdParamSchema.validate({
          id: '123-abc',
        });
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('ID phiếu mượn không đúng định dạng ObjectId');
      });
    });
  });

  describe('2. Service: submitLoan', () => {
    const readerId = '507f1f77bcf86cd799439011';
    const mockBook = {
      _id: '507f1f77bcf86cd799439021',
      title: 'Lập trình Node.js',
      price: 150000,
      status: 'active',
      availableCopies: 3,
    };

    it('tạo phiếu mượn thành công từ giỏ hàng và làm sạch giỏ', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 0,
        firstName: 'Nguyễn Văn',
        lastName: 'A',
        code: 'DG000001',
      });
      jest.spyOn(Loan, 'exists').mockResolvedValue(false);
      jest.spyOn(Cart, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          items: [{ book: mockBook, addedAt: new Date() }],
        }),
      });
      jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ maxBooksPerLoan: 5 });
      jest.spyOn(Loan, 'find').mockResolvedValue([]);
      jest.spyOn(codeUtil, 'nextCode').mockResolvedValue('PM000001');

      const createdLoan = {
        _id: '507f1f77bcf86cd799439099',
        code: 'PM000001',
        reader: readerId,
        status: 'pending',
        items: [
          {
            book: mockBook._id,
            titleSnapshot: mockBook.title,
            priceSnapshot: mockBook.price,
            status: 'pending',
          },
        ],
      };
      jest.spyOn(Loan, 'create').mockResolvedValue(createdLoan);
      jest.spyOn(Cart, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(notifyService, 'notifyStaff').mockResolvedValue({});
      jest.spyOn(countersService, 'emitStaffCounters').mockResolvedValue({});

      const result = await loanService.submitLoan(readerId, {
        expectedPickupDate: '2026-11-05',
        requestNote: 'Nhận vào chiều thứ 5',
      });

      expect(result).toEqual(createdLoan);
      expect(Loan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PM000001',
          reader: readerId,
          status: 'pending',
          items: [
            expect.objectContaining({
              book: mockBook._id,
              titleSnapshot: 'Lập trình Node.js',
              priceSnapshot: 150000,
              status: 'pending',
            }),
          ],
          requestNote: 'Nhận vào chiều thứ 5',
        })
      );
      expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
        { user: readerId },
        { $set: { items: [] } }
      );
      expect(notifyService.notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loan',
          title: 'Yêu cầu mượn sách mới',
        })
      );
      expect(countersService.emitStaffCounters).toHaveBeenCalled();
    });

    it('bị chặn khi tài khoản bị khóa', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'locked',
        unpaidFineTotal: 0,
      });

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow(
        'Tài khoản của bạn đang bị khóa, không thể mượn sách'
      );
    });

    it('bị chặn khi nợ phạt > 0', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 50000,
      });

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow(
        'Bạn đang có tiền phạt chưa thanh toán, vui lòng thanh toán trước khi mượn sách'
      );
    });

    it('bị chặn khi có sách mượn quá hạn', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 0,
      });
      jest.spyOn(Loan, 'exists').mockResolvedValue(true);

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow(
        'Bạn đang có sách mượn quá hạn chưa trả, không thể mượn thêm sách'
      );
    });

    it('bị chặn khi giỏ mượn đang trống', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 0,
      });
      jest.spyOn(Loan, 'exists').mockResolvedValue(false);
      jest.spyOn(Cart, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({ items: [] }),
      });

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow('Giỏ mượn đang trống');
    });

    it('bị chặn khi sách trong giỏ đã hết bản sao có thể mượn', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 0,
      });
      jest.spyOn(Loan, 'exists').mockResolvedValue(false);
      jest.spyOn(Cart, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          items: [{ book: { ...mockBook, availableCopies: 0 } }],
        }),
      });

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow(
        'hiện đã hết bản sao có thể mượn'
      );
    });

    it('bị chặn khi tổng sách (đang mượn + đang chờ + mới) vượt quá giới hạn 5', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: readerId,
        status: 'active',
        unpaidFineTotal: 0,
      });
      jest.spyOn(Loan, 'exists').mockResolvedValue(false);
      jest.spyOn(Cart, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          items: [
            { book: mockBook },
            { book: { ...mockBook, _id: '507f1f77bcf86cd799439022' } },
          ],
        }),
      });
      jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ maxBooksPerLoan: 5 });

      // Đã có 4 sách đang mượn/chờ duyệt
      jest.spyOn(Loan, 'find').mockResolvedValue([
        {
          items: [
            { status: 'borrowing' },
            { status: 'borrowing' },
            { status: 'pending' },
            { status: 'pending' },
          ],
        },
      ]);

      await expect(loanService.submitLoan(readerId, {})).rejects.toThrow(
        'Vượt quá giới hạn mượn sách'
      );
    });
  });

  describe('3. Service: getMyLoans & getMyLoanById', () => {
    const readerId = '507f1f77bcf86cd799439011';

    const createChainQuery = (result) => {
      const query = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockImplementation(() => query),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    };

    it('getMyLoans trả về danh sách phân trang chuẩn', async () => {
      const mockItems = [{ _id: 'loan1', code: 'PM000001' }];
      const mockQueryChain = createChainQuery(mockItems);
      jest.spyOn(Loan, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(Loan, 'countDocuments').mockResolvedValue(1);

      const result = await loanService.getMyLoans(readerId, { page: 1, limit: 10, status: 'pending' });

      expect(result.items).toEqual(mockItems);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(Loan.find).toHaveBeenCalledWith({ reader: readerId, status: 'pending' });
    });

    it('getMyLoanById trả về thông tin chi tiết phiếu mượn', async () => {
      const mockLoan = { _id: 'loan1', code: 'PM000001', reader: readerId };
      const mockQuery = createChainQuery(mockLoan);
      jest.spyOn(Loan, 'findOne').mockReturnValue(mockQuery);

      const result = await loanService.getMyLoanById(readerId, 'loan1');
      expect(result).toEqual(mockLoan);
    });

    it('getMyLoanById ném lỗi 404 khi không tìm thấy phiếu mượn', async () => {
      const mockQuery = createChainQuery(null);
      jest.spyOn(Loan, 'findOne').mockReturnValue(mockQuery);

      await expect(loanService.getMyLoanById(readerId, 'loan_unknown')).rejects.toThrow(
        'Phiếu mượn không tồn tại'
      );
    });
  });

  describe('4. Service: cancelLoan', () => {
    const readerId = '507f1f77bcf86cd799439011';
    const loanId = '507f1f77bcf86cd799439033';

    let mockSession;

    beforeEach(() => {
      mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
    });

    it('hủy thành công phiếu pending, không hoàn tồn kho và emit counters', async () => {
      const loanDoc = {
        _id: loanId,
        reader: readerId,
        status: 'pending',
        items: [{ book: '507f1f77bcf86cd799439021' }],
        save: jest.fn().mockResolvedValue(this),
      };

      jest.spyOn(Loan, 'findOne').mockReturnValue({
        session: jest.fn().mockResolvedValue(loanDoc),
      });
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({});
      jest.spyOn(notifyService, 'emitLoanUpdated').mockReturnValue();
      jest.spyOn(countersService, 'emitStaffCounters').mockResolvedValue({});

      const result = await loanService.cancelLoan(readerId, loanId);

      expect(loanDoc.status).toBe('cancelled');
      expect(loanDoc.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(Book.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(notifyService.emitLoanUpdated).toHaveBeenCalledWith(readerId, loanId, 'cancelled');
      expect(countersService.emitStaffCounters).toHaveBeenCalled();
      expect(result).toBe(loanDoc);
    });

    it('hủy thành công phiếu approved, hoàn lại tồn kho trong transaction', async () => {
      const bookId1 = '507f1f77bcf86cd799439021';
      const bookId2 = '507f1f77bcf86cd799439022';
      const loanDoc = {
        _id: loanId,
        reader: readerId,
        status: 'approved',
        items: [{ book: bookId1 }, { book: bookId2 }],
        save: jest.fn().mockResolvedValue(this),
      };

      jest.spyOn(Loan, 'findOne').mockReturnValue({
        session: jest.fn().mockResolvedValue(loanDoc),
      });
      jest.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue({});
      jest.spyOn(notifyService, 'emitLoanUpdated').mockReturnValue();
      jest.spyOn(countersService, 'emitStaffCounters').mockResolvedValue({});

      await loanService.cancelLoan(readerId, loanId);

      expect(loanDoc.status).toBe('cancelled');
      expect(Book.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(Book.findByIdAndUpdate).toHaveBeenCalledWith(
        bookId1,
        { $inc: { availableCopies: 1 } },
        { session: mockSession }
      );
      expect(Book.findByIdAndUpdate).toHaveBeenCalledWith(
        bookId2,
        { $inc: { availableCopies: 1 } },
        { session: mockSession }
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      // Phiếu approved khi hủy không giảm pendingLoans nên không gọi emitStaffCounters
      expect(countersService.emitStaffCounters).not.toHaveBeenCalled();
    });

    it('bị chặn khi hủy phiếu ở trạng thái không cho phép (vd: borrowing)', async () => {
      const loanDoc = {
        _id: loanId,
        reader: readerId,
        status: 'borrowing',
      };

      jest.spyOn(Loan, 'findOne').mockReturnValue({
        session: jest.fn().mockResolvedValue(loanDoc),
      });

      await expect(loanService.cancelLoan(readerId, loanId)).rejects.toThrow(
        'Không thể hủy phiếu mượn ở trạng thái "borrowing"'
      );
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('báo lỗi 404 khi không tìm thấy phiếu mượn', async () => {
      jest.spyOn(Loan, 'findOne').mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(loanService.cancelLoan(readerId, loanId)).rejects.toThrow(
        'Phiếu mượn không tồn tại'
      );
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('5. Controllers: loan.controller', () => {
    it('submitLoan trả về status 201 cùng dữ liệu phiếu mượn', async () => {
      const mockCreated = { _id: 'loan1', code: 'PM000001' };
      jest.spyOn(loanService, 'submitLoan').mockResolvedValue(mockCreated);

      const { req, res, next } = createMockReqRes({
        body: { expectedPickupDate: '2026-11-05' },
      });

      await loanController.submitLoan(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.jsonData).toEqual({
        success: true,
        data: mockCreated,
      });
    });

    it('getMyLoans trả về 200 kèm meta phân trang', async () => {
      const mockResult = {
        items: [{ _id: 'loan1' }],
        meta: { totalItems: 1, currentPage: 1 },
      };
      jest.spyOn(loanService, 'getMyLoans').mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        query: { page: '1' },
      });

      await loanController.getMyLoans(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.jsonData).toEqual({
        success: true,
        data: mockResult.items,
        meta: mockResult.meta,
      });
    });

    it('getMyLoanById trả về 200 kèm dữ liệu', async () => {
      const mockLoan = { _id: 'loan1' };
      jest.spyOn(loanService, 'getMyLoanById').mockResolvedValue(mockLoan);

      const { req, res, next } = createMockReqRes({
        params: { id: 'loan1' },
      });

      await loanController.getMyLoanById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.jsonData).toEqual({
        success: true,
        data: mockLoan,
      });
    });

    it('cancelLoan trả về 200 sau khi hủy', async () => {
      const mockCancelled = { _id: 'loan1', status: 'cancelled' };
      jest.spyOn(loanService, 'cancelLoan').mockResolvedValue(mockCancelled);

      const { req, res, next } = createMockReqRes({
        params: { id: 'loan1' },
      });

      await loanController.cancelLoan(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.jsonData).toEqual({
        success: true,
        data: mockCancelled,
      });
    });
  });

  describe('6. Route Endpoints Integration (Supertest)', () => {
    const readerId = new mongoose.Types.ObjectId().toString();
    const staffId = new mongoose.Types.ObjectId().toString();
    const validLoanId = new mongoose.Types.ObjectId().toString();

    const readerToken = jwt.sign(
      { userId: readerId, role: 'reader', email: 'reader@test.com' },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );

    const staffToken = jwt.sign(
      { userId: staffId, role: 'staff', email: 'staff@test.com' },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => {
        if (id && id.toString() === readerId) {
          return Promise.resolve({
            _id: readerId,
            role: 'reader',
            status: 'active',
          });
        }
        if (id && id.toString() === staffId) {
          return Promise.resolve({
            _id: staffId,
            role: 'staff',
            status: 'active',
          });
        }
        return Promise.resolve(null);
      });
    });

    it('POST /api/v1/loans yêu cầu đăng nhập (401 khi không có token)', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .send({ expectedPickupDate: '2026-11-05' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/loans chặn role không phải reader (403 khi dùng staff token)', async () => {
      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ expectedPickupDate: '2026-11-05' });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/loans thành công khi có token reader và dữ liệu hợp lệ (201)', async () => {
      const mockCreated = {
        _id: validLoanId,
        code: 'PM000001',
        status: 'pending',
      };
      jest.spyOn(loanService, 'submitLoan').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/loans')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ expectedPickupDate: '2026-11-05' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockCreated);
    });

    it('GET /api/v1/me/loans trả về 200 cho người dùng đã đăng nhập', async () => {
      jest.spyOn(loanService, 'getMyLoans').mockResolvedValue({
        items: [{ _id: validLoanId, code: 'PM000001' }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/v1/me/loans?status=pending')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /api/v1/me/loans/:id trả về 422 khi id sai định dạng', async () => {
      const res = await request(app)
        .get('/api/v1/me/loans/invalid-id')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/me/loans/:id trả về 200 khi id hợp lệ', async () => {
      jest.spyOn(loanService, 'getMyLoanById').mockResolvedValue({
        _id: validLoanId,
        code: 'PM000001',
      });

      const res = await request(app)
        .get(`/api/v1/me/loans/${validLoanId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(validLoanId);
    });

    it('POST /api/v1/me/loans/:id/cancel hủy phiếu thành công (200)', async () => {
      jest.spyOn(loanService, 'cancelLoan').mockResolvedValue({
        _id: validLoanId,
        status: 'cancelled',
      });

      const res = await request(app)
        .post(`/api/v1/me/loans/${validLoanId}/cancel`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });
  });
});
