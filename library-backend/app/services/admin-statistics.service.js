const ApiError = require('../api-error');
const { Author, Category, Fine, ForumReport, ForumThread, Loan, Notification, Publisher, RenewalRequest, User } = require('../models');

async function groupCounts(model, field, match = {}) {
  const values = await model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  return values.map(({ _id, count }) => ({ key: _id || 'unknown', count }));
}

function includeKnownKeys(items, keys) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return keys.map((key) => byKey.get(key) || { key, count: 0, amount: 0 });
}

async function getAdminStatistics(section, actor) {
  switch (section) {
  case 'loans': {
    const statuses = includeKnownKeys(await groupCounts(Loan, 'status'), [
      'pending', 'approved', 'borrowing', 'overdue', 'returned', 'rejected', 'cancelled', 'expired',
    ]);
    return { total: statuses.reduce((sum, item) => sum + item.count, 0), statuses };
  }
  case 'renewals': {
    const statuses = includeKnownKeys(await groupCounts(RenewalRequest, 'status'), ['pending', 'approved', 'rejected', 'cancelled']);
    return { total: statuses.reduce((sum, item) => sum + item.count, 0), statuses };
  }
  case 'fines': {
    const statuses = await Fine.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]);
    const completeStatuses = includeKnownKeys(
      statuses.map(({ _id, count, amount }) => ({ key: _id || 'unknown', count, amount })),
      ['unpaid', 'paid', 'waived']
    );
    return {
      total: statuses.reduce((sum, item) => sum + item.count, 0),
      statuses: completeStatuses,
    };
  }
  case 'users': {
    const match = actor?.role === 'staff' ? { role: 'reader' } : {};
    const [statusCounts, roleCounts] = await Promise.all([
      groupCounts(User, 'status', match),
      groupCounts(User, 'role', match),
    ]);
    const statuses = includeKnownKeys(statusCounts, ['active', 'locked']);
    const roles = includeKnownKeys(roleCounts, actor?.role === 'staff' ? ['reader'] : ['reader', 'staff', 'admin']);
    return { total: statuses.reduce((sum, item) => sum + item.count, 0), statuses, roles };
  }
  case 'staff': {
    if (actor?.role !== 'admin') throw ApiError.forbidden('Chỉ quản trị viên được xem thống kê nhân viên');
    const statuses = includeKnownKeys(await groupCounts(User, 'status', { role: 'staff' }), ['active', 'locked']);
    return { total: statuses.reduce((sum, item) => sum + item.count, 0), statuses };
  }
  case 'forum': {
    const [reportCounts, threadCounts] = await Promise.all([
      groupCounts(ForumReport, 'status'),
      groupCounts(ForumThread, 'status'),
    ]);
    const reports = includeKnownKeys(reportCounts, ['open', 'resolved', 'dismissed']);
    const threads = includeKnownKeys(threadCounts, ['active', 'hidden']);
    return {
      reports: { total: reports.reduce((sum, item) => sum + item.count, 0), statuses: reports },
      threads: { total: threads.reduce((sum, item) => sum + item.count, 0), statuses: threads },
    };
  }
  case 'notifications': {
    const audiences = includeKnownKeys(await groupCounts(Notification, 'audience'), ['user', 'all', 'readers', 'staff']);
    return { total: audiences.reduce((sum, item) => sum + item.count, 0), audiences };
  }
  case 'catalog': {
    const [authors, categories, publishers] = await Promise.all([
      Author.countDocuments(),
      Category.countDocuments(),
      Publisher.countDocuments(),
    ]);
    return {
      total: authors + categories + publishers,
      items: [
        { key: 'authors', count: authors },
        { key: 'categories', count: categories },
        { key: 'publishers', count: publishers },
      ],
    };
  }
  default:
    throw ApiError.badRequest('Mục thống kê không hợp lệ');
  }
}

module.exports = { getAdminStatistics };
