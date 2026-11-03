const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Loan, RenewalRequest, Reservation } = require('../models');
const settingsService = require('./settings.service');
const notifyService = require('./notify.service');
const countersService = require('./counters.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

async function requestRenewal(loanId, bookId, userId, reason) {
  const session = await mongoose.startSession();
  let renewal;
  try {
    await session.withTransaction(async () => {
      const loan = await Loan.findOne({ _id: loanId, reader: userId }).session(session);
      if (!loan) throw ApiError.notFound('Phiếu mượn không tồn tại hoặc không thuộc về bạn', null, 'RENEW_LOAN_NOT_FOUND');
      const item = loan.items.find((entry) => entry.book.toString() === bookId);
      if (!item) throw ApiError.notFound('Sách không thuộc phiếu mượn này', null, 'RENEW_BOOK_NOT_FOUND');
      if (item.status !== 'borrowing') throw ApiError.conflict('Chỉ có thể gia hạn sách đang mượn', null, 'RENEW_ITEM_NOT_BORROWING');

      const now = new Date();
      if (!item.dueDate || new Date(item.dueDate) < now) {
        throw ApiError.badRequest('Sách đã quá hạn, không thể gia hạn', null, 'RENEW_OVERDUE');
      }
      const settings = await settingsService.getSettings();
      if ((item.renewCount || 0) >= settings.maxRenewals) {
        throw ApiError.badRequest('Sách đã hết số lượt gia hạn', null, 'RENEW_LIMIT_REACHED');
      }
      if (await Reservation.exists({ book: bookId, status: 'waiting' }).session(session)) {
        throw ApiError.conflict('Sách đang có người đặt trước', null, 'RENEW_RESERVED');
      }
      if (await RenewalRequest.exists({ loan: loanId, book: bookId, status: 'pending' }).session(session)) {
        throw ApiError.conflict('Đã có yêu cầu gia hạn đang chờ xử lý', null, 'RENEW_PENDING');
      }

      const requestedDueDate = new Date(new Date(item.dueDate).getTime() + settings.renewDays * 86400000);
      [renewal] = await RenewalRequest.create([{
        loan: loan._id,
        book: item.book,
        reader: userId,
        currentDueDate: item.dueDate,
        requestedDueDate,
        reason: reason || undefined,
        status: 'pending',
      }], { session });
    });
  } catch (error) {
    if (error.code === 11000) throw ApiError.conflict('Đã có yêu cầu gia hạn đang chờ xử lý', null, 'RENEW_PENDING');
    throw error;
  } finally { await session.endSession(); }

  await notifyService.notifyStaff({
    type: 'renewal', title: 'Yêu cầu gia hạn mới',
    content: `Độc giả gửi yêu cầu gia hạn sách đến ${renewal.requestedDueDate.toLocaleDateString('vi-VN')}.`,
    link: '/admin/renewals', createdBy: userId,
  });
  await countersService.emitStaffCounters();
  return renewal;
}

async function getMyRenewals(userId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { reader: userId };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    RenewalRequest.find(filter)
      .populate('loan', 'code status')
      .populate('book', 'code title cover')
      .sort(sort).skip(skip).limit(limit).lean(),
    RenewalRequest.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function cancelRenewal(requestId, userId) {
  const renewal = await RenewalRequest.findOneAndUpdate(
    { _id: requestId, reader: userId, status: 'pending' },
    { $set: { status: 'cancelled', decidedAt: new Date() }, $unset: { decidedBy: 1 } },
    { new: true }
  );
  if (!renewal) {
    const existing = await RenewalRequest.findOne({ _id: requestId, reader: userId }).select('status');
    if (!existing) throw ApiError.notFound('Yêu cầu gia hạn không tồn tại');
    throw ApiError.conflict('Chỉ có thể hủy yêu cầu gia hạn đang chờ xử lý', null, 'RENEW_NOT_PENDING');
  }
  await notifyService.emitRenewalUpdated(userId.toString(), renewal._id.toString(), 'cancelled');
  await countersService.emitStaffCounters();
  return renewal;
}

module.exports = { requestRenewal, getMyRenewals, cancelRenewal };
