const ExcelJS = require('exceljs');
const { Loan, Fine } = require('../models');

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const localStart = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
    return endOfDay ? new Date(localStart.getTime() + DAY_MS - 1) : localStart;
  }
  return date;
}

function buildCreatedAtFilter(query = {}) {
  const createdAt = {};
  const from = parseDate(query.from);
  const to = parseDate(query.to, true);
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;
  return Object.keys(createdAt).length ? { createdAt } : {};
}

function styleWorksheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  for (const column of worksheet.columns) {
    column.width = Math.min(Math.max(column.header.length + 4, 14), 32);
  }
}

async function buildWorkbook(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Library Management';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns;
  worksheet.addRows(rows);
  styleWorksheet(worksheet);
  return workbook.xlsx.writeBuffer();
}

async function exportLoans(query = {}) {
  const loans = await Loan.find(buildCreatedAtFilter(query))
    .populate('reader', 'code firstName lastName')
    .sort({ createdAt: 1 })
    .lean();
  const rows = loans.flatMap((loan) => {
    const items = loan.items?.length ? loan.items : [{}];
    return items.map((item) => ({
      loanCode: loan.code,
      readerCode: loan.reader?.code || '',
      readerName: `${loan.reader?.firstName || ''} ${loan.reader?.lastName || ''}`.trim(),
      loanStatus: loan.status,
      createdAt: loan.createdAt,
      handedOverAt: loan.handedOverAt || null,
      closedAt: loan.closedAt || null,
      bookTitle: item.titleSnapshot || '',
      itemStatus: item.status || '',
      dueDate: item.dueDate || null,
    }));
  });
  return buildWorkbook('Phiếu mượn', [
    { header: 'Mã phiếu', key: 'loanCode' },
    { header: 'Mã độc giả', key: 'readerCode' },
    { header: 'Tên độc giả', key: 'readerName' },
    { header: 'Trạng thái phiếu', key: 'loanStatus' },
    { header: 'Ngày tạo', key: 'createdAt', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Ngày giao sách', key: 'handedOverAt', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Ngày đóng phiếu', key: 'closedAt', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Tên sách', key: 'bookTitle' },
    { header: 'Trạng thái sách', key: 'itemStatus' },
    { header: 'Hạn trả', key: 'dueDate', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  ], rows);
}

async function exportFines(query = {}) {
  const fines = await Fine.find(buildCreatedAtFilter(query))
    .populate('reader', 'code firstName lastName')
    .populate('loan', 'code')
    .populate('book', 'code title')
    .sort({ createdAt: 1 })
    .lean();
  const rows = fines.map((fine) => ({
    readerCode: fine.reader?.code || '',
    readerName: `${fine.reader?.firstName || ''} ${fine.reader?.lastName || ''}`.trim(),
    loanCode: fine.loan?.code || '',
    bookCode: fine.book?.code || '',
    bookTitle: fine.book?.title || '',
    type: fine.type,
    amount: fine.amount,
    status: fine.status,
    reason: fine.reason || '',
    createdAt: fine.createdAt,
    paidAt: fine.paidAt || null,
  }));
  return buildWorkbook('Khoản phạt', [
    { header: 'Mã độc giả', key: 'readerCode' },
    { header: 'Tên độc giả', key: 'readerName' },
    { header: 'Mã phiếu', key: 'loanCode' },
    { header: 'Mã sách', key: 'bookCode' },
    { header: 'Tên sách', key: 'bookTitle' },
    { header: 'Loại phạt', key: 'type' },
    { header: 'Số tiền (VND)', key: 'amount', style: { numFmt: '#,##0' } },
    { header: 'Trạng thái', key: 'status' },
    { header: 'Lý do', key: 'reason' },
    { header: 'Ngày ghi nhận', key: 'createdAt', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'Ngày thu', key: 'paidAt', style: { numFmt: 'dd/mm/yyyy hh:mm' } },
  ], rows);
}

module.exports = { exportLoans, exportFines, buildCreatedAtFilter };
