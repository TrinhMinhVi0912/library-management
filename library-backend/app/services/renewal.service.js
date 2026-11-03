const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Loan, RenewalRequest, Reservation } = require('../models');
const settingsService = require('./settings.service');
const notifyService = require('./notify.service');
const countersService = require('./counters.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const auditService = require('./audit.service');

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

async function getAdminRenewals(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  const [requests, total] = await Promise.all([
    RenewalRequest.find(filter)
      .populate('reader', 'code firstName lastName email phone')
      .populate('book', 'code title cover')
      .populate('loan', 'code status items.book items.dueDate items.renewCount')
      .sort(sort).skip(skip).limit(limit).lean(),
    RenewalRequest.countDocuments(filter),
  ]);
  const bookIds = [...new Set(requests.map((request) => request.book?._id).filter(Boolean))];
  const reservations = bookIds.length
    ? await Reservation.find({ book: { $in: bookIds }, status: 'waiting' }).select('book').lean()
    : [];
  const reservedBookIds = new Set(reservations.map((reservation) => reservation.book.toString()));
  const items = requests.map((request) => {
    const loanItem = request.loan?.items?.find((item) => item.book?._id?.toString() === request.book?._id?.toString() || item.book?.toString() === request.book?._id?.toString());
    return {
      ...request,
      currentDueDate: request.currentDueDate || loanItem?.dueDate,
      renewCount: loanItem?.renewCount || 0,
      hasWaitingReservation: request.book ? reservedBookIds.has(request.book._id.toString()) : false,
    };
  });
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function approveRenewal(requestId, staffId, options = {}) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const request = await RenewalRequest.findById(requestId).session(session);
      if (!request) throw ApiError.notFound('Yêu cầu gia hạn không tồn tại');
      if (request.status !== 'pending') throw ApiError.conflict('Yêu cầu gia hạn không còn chờ xử lý', null, 'RENEW_NOT_PENDING');
      const loan = await Loan.findById(request.loan).session(session);
      if (!loan || loan.reader.toString() !== request.reader.toString()) {
        throw ApiError.conflict('Phiếu mượn không còn hợp lệ', null, 'RENEW_LOAN_INVALID');
      }
      const item = loan.items.find((entry) => entry.book.toString() === request.book.toString());
      if (!item || item.status !== 'borrowing') throw ApiError.conflict('Sách không còn ở trạng thái đang mượn', null, 'RENEW_ITEM_NOT_BORROWING');
      const now = new Date();
      if (!item.dueDate || new Date(item.dueDate) < now) throw ApiError.conflict('Sách đã quá hạn, không thể duyệt gia hạn', null, 'RENEW_OVERDUE');
      const settings = await settingsService.getSettings();
      if ((item.renewCount || 0) >= settings.maxRenewals) throw ApiError.conflict('Sách đã hết số lượt gia hạn', null, 'RENEW_LIMIT_REACHED');
      if (await Reservation.exists({ book: item.book, status: 'waiting' }).session(session)) {
        throw ApiError.conflict('Sách đang có người đặt trước, không thể duyệt gia hạn', null, 'RENEW_RESERVED');
      }
      const oldDue = new Date(item.dueDate);
      const newDue = new Date(oldDue.getTime() + settings.renewDays * 86400000);
      item.dueDate = newDue;
      item.renewCount = (item.renewCount || 0) + 1;
      item.renewals.push({ at: now, oldDue, newDue, approvedBy: staffId });
      await loan.save({ session });
      request.status = 'approved';
      request.decidedBy = staffId;
      request.decidedAt = now;
      await request.save({ session });
      result = { request, loan, oldDue, newDue };
    });
  } finally { await session.endSession(); }
  const readerId = result.request.reader.toString();
  await notifyService.notifyUser(readerId, {
    type: 'renewal', title: 'Yêu cầu gia hạn đã được duyệt',
    content: `Hạn trả mới là ${result.newDue.toLocaleDateString('vi-VN')}.`,
    link: `/my/loans/${result.loan._id}`, createdBy: staffId,
  });
  notifyService.emitRenewalUpdated(readerId, result.request._id.toString(), 'approved');
  notifyService.emitLoanUpdated(readerId, result.loan._id.toString(), result.loan.status);
  await countersService.emitStaffCounters();
  await auditService.log({ actor: staffId, action: 'renewal.approve', targetType: 'RenewalRequest', targetId: result.request._id, detail: { loanId: result.loan._id, bookId: result.request.book, oldDue: result.oldDue, newDue: result.newDue }, ip: options.ip || null });
  return result.request;
}

async function rejectRenewal(requestId, staffId, reason, options = {}) {
  const session = await mongoose.startSession();
  let request;
  let loanStatus = null;
  try {
    await session.withTransaction(async () => {
      request = await RenewalRequest.findById(requestId).session(session);
      if (!request) throw ApiError.notFound('Yêu cầu gia hạn không tồn tại');
      if (request.status !== 'pending') throw ApiError.conflict('Yêu cầu gia hạn không còn chờ xử lý', null, 'RENEW_NOT_PENDING');
      request.status = 'rejected';
      request.rejectReason = reason;
      request.decidedBy = staffId;
      request.decidedAt = new Date();
      await request.save({ session });
      const loan = await Loan.findById(request.loan).session(session);
      loanStatus = loan?.status || null;
    });
  } finally { await session.endSession(); }
  const readerId = request.reader.toString();
  await notifyService.notifyUser(readerId, {
    type: 'renewal', title: 'Yêu cầu gia hạn bị từ chối',
    content: `Lý do: ${reason}`, link: `/my/loans/${request.loan}`, createdBy: staffId,
  });
  notifyService.emitRenewalUpdated(readerId, request._id.toString(), 'rejected');
  if (loanStatus) notifyService.emitLoanUpdated(readerId, request.loan.toString(), loanStatus);
  await countersService.emitStaffCounters();
  await auditService.log({ actor: staffId, action: 'renewal.reject', targetType: 'RenewalRequest', targetId: request._id, detail: { reason }, ip: options.ip || null });
  return request;
}

module.exports = { requestRenewal, getMyRenewals, cancelRenewal, getAdminRenewals, approveRenewal, rejectRenewal };
