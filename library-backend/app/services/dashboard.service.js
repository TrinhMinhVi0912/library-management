const ApiError = require('../api-error');
const { Book, User, Loan, RenewalRequest, Fine } = require('../models');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_CONFIG = {
  '7d': { unit: 'day', periods: 7 },
  '30d': { unit: 'day', periods: 30 },
  '12m': { unit: 'month', periods: 12 },
};

function localDateParts(date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(values.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

function localMidnightUtc(year, month, day) {
  // Vietnam does not observe daylight saving time (UTC+7).
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

function resolveRange(range = '30d', now = new Date()) {
  const config = RANGE_CONFIG[range];
  if (!config) throw ApiError.badRequest('Khoảng thời gian phải là 7d, 30d hoặc 12m');
  const parts = localDateParts(now);
  let start;
  if (config.unit === 'day') {
    start = localMidnightUtc(parts.year, parts.month, parts.day - (config.periods - 1));
  } else {
    const monthStart = new Date(Date.UTC(parts.year, parts.month - 1 - (config.periods - 1), 1));
    start = localMidnightUtc(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1);
  }
  return { range, unit: config.unit, start, end: now, periods: config.periods };
}

function buildPeriodLabels(periodRange, now = new Date()) {
  const { unit, periods } = periodRange;
  const parts = localDateParts(now);
  if (unit === 'day') {
    const first = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - (periods - 1)));
    return Array.from({ length: periods }, (_value, index) => {
      const date = new Date(first.getTime() + index * DAY_MS);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    });
  }
  const firstMonth = new Date(Date.UTC(parts.year, parts.month - 1 - (periods - 1), 1));
  return Array.from({ length: periods }, (_value, index) => {
    const date = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function periodFormat(unit) {
  return unit === 'day' ? '%Y-%m-%d' : '%Y-%m';
}

function fillPeriods(labels, rows) {
  const counts = new Map(rows.map((row) => [row.period, row.count]));
  return labels.map((period) => ({ period, count: counts.get(period) || 0 }));
}

async function getSummary() {
  const [totalBooks, totalBookCopies, totalReaders, borrowingLoans, overdueLoans, pendingLoans, pendingRenewals, unpaidFineStats] = await Promise.all([
    Book.countDocuments({}),
    Book.aggregate([{ $group: { _id: null, total: { $sum: '$totalCopies' } } }]),
    User.countDocuments({ role: 'reader' }),
    Loan.countDocuments({ status: 'borrowing' }),
    Loan.countDocuments({ status: 'overdue' }),
    Loan.countDocuments({ status: 'pending' }),
    RenewalRequest.countDocuments({ status: 'pending' }),
    Fine.aggregate([
      { $match: { status: 'unpaid' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
  ]);
  const unpaidFines = unpaidFineStats[0] || { count: 0, amount: 0 };
  return {
    totalBooks,
    totalBookCopies: totalBookCopies[0]?.total || 0,
    totalReaders,
    borrowingLoans,
    overdueLoans,
    pendingLoans,
    pendingRenewals,
    unpaidFines: { count: unpaidFines.count, amount: unpaidFines.amount },
  };
}

async function getCharts(range = '30d', now = new Date()) {
  const periodRange = resolveRange(range, now);
  const labels = buildPeriodLabels(periodRange, now);
  const borrowMatch = { 'items.borrowDate': { $gte: periodRange.start, $lte: periodRange.end } };
  const dateGroup = {
    $dateToString: { format: periodFormat(periodRange.unit), date: '$items.borrowDate', timezone: TIME_ZONE },
  };
  const fineDateGroup = {
    $dateToString: { format: periodFormat(periodRange.unit), date: '$paidAt', timezone: TIME_ZONE },
  };
  const baseBorrowPipeline = [
    { $match: borrowMatch },
    { $unwind: '$items' },
    { $match: { 'items.borrowDate': { $gte: periodRange.start, $lte: periodRange.end } } },
  ];
  const [loanRows, topBooks, categoryRows, fineRows] = await Promise.all([
    Loan.aggregate([
      ...baseBorrowPipeline,
      { $group: { _id: dateGroup, count: { $sum: 1 } } },
      { $project: { _id: 0, period: '$_id', count: 1 } },
      { $sort: { period: 1 } },
    ]),
    Loan.aggregate([
      ...baseBorrowPipeline,
      { $group: { _id: '$items.book', title: { $first: '$items.titleSnapshot' }, borrowCount: { $sum: 1 } } },
      { $sort: { borrowCount: -1, title: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, bookId: '$_id', title: 1, borrowCount: 1 } },
    ]),
    Loan.aggregate([
      ...baseBorrowPipeline,
      { $lookup: { from: 'books', localField: 'items.book', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $unwind: '$book.categories' },
      { $lookup: { from: 'categories', localField: 'book.categories', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $group: { _id: '$category._id', name: { $first: '$category.name' }, borrowCount: { $sum: 1 } } },
      { $sort: { borrowCount: -1, name: 1 } },
      { $project: { _id: 0, categoryId: '$_id', name: 1, borrowCount: 1 } },
    ]),
    Fine.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: periodRange.start, $lte: periodRange.end } } },
      { $group: { _id: fineDateGroup, amount: { $sum: '$amount' } } },
      { $project: { _id: 0, period: '$_id', amount: 1 } },
      { $sort: { period: 1 } },
    ]),
  ]);
  const revenueByPeriod = new Map(fineRows.map((row) => [row.period, row.amount]));
  return {
    range: periodRange.range,
    from: periodRange.start,
    to: periodRange.end,
    loansByPeriod: fillPeriods(labels, loanRows),
    topBooks,
    borrowingsByCategory: categoryRows,
    fineRevenueByPeriod: labels.map((period) => ({ period, amount: revenueByPeriod.get(period) || 0 })),
  };
}

module.exports = { getSummary, getCharts, resolveRange, buildPeriodLabels };
