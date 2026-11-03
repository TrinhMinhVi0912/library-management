const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Reservation, Book } = require('../models');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const settingsService = require('./settings.service');
const notifyService = require('./notify.service');
const auditService = require('./audit.service');

function withSession(query, session) {
  return session ? query.session(session) : query;
}

async function offerNextWaiting(bookId, now, session) {
  const settings = await settingsService.getSettings();
  return Reservation.findOneAndUpdate(
    { book: bookId, status: 'waiting' },
    { $set: { status: 'available', notifiedAt: now, holdUntil: new Date(now.getTime() + settings.reservationHoldDays * 86400000) } },
    { new: true, sort: { createdAt: 1, _id: 1 }, session }
  );
}

/** Claim one returned/restored public copy for the oldest waiter in the same transaction. */
async function reserveReturnedCopy(bookId, { now = new Date(), session } = {}) {
  if (!session) throw ApiError.internal('Chuyển sách cho hàng đặt trước cần transaction');
  const reservation = await offerNextWaiting(bookId, now, session);
  if (!reservation) return null;
  const stock = await Book.updateOne({ _id: bookId, availableCopies: { $gte: 1 } }, { $inc: { availableCopies: -1 } }, { session });
  if (!stock.modifiedCount) throw ApiError.conflict('Không còn bản sách để giữ cho người đặt trước');
  return reservation;
}

/** Pass an already held copy to the next waiter, or release it back to public stock. */
async function passHeldCopy(bookId, { now = new Date(), session } = {}) {
  if (!session) throw ApiError.internal('Chuyển sách đặt trước cần transaction');
  const reservation = await offerNextWaiting(bookId, now, session);
  if (reservation) return reservation;
  const released = await Book.updateOne({ _id: bookId }, { $inc: { availableCopies: 1 } }, { session });
  if (!released.matchedCount) throw ApiError.notFound('Sách không tồn tại khi giải phóng bản đặt trước');
  return null;
}

async function notifyAvailable(reservation) {
  if (!reservation) return null;
  const book = await Book.findById(reservation.book).select('title').lean();
  const holdDate = reservation.holdUntil ? new Date(reservation.holdUntil).toLocaleDateString('vi-VN') : '';
  return notifyService.notifyUser(reservation.reader, {
    type: 'reservation',
    title: 'Sách đặt trước đã sẵn sàng',
    content: `Sách “${book?.title || 'bạn đã đặt trước'}” đang được giữ cho bạn${holdDate ? ` đến hết ngày ${holdDate}` : ''}. Hãy gửi yêu cầu mượn trước hạn.`,
    link: `/books/${reservation.book}`,
    expiresAt: reservation.holdUntil,
  });
}

async function createReservation(readerId, bookId) {
  const book = await Book.findById(bookId).select('status availableCopies');
  if (!book) throw ApiError.notFound('Sách không tồn tại');
  if (book.status !== 'active') throw ApiError.badRequest('Sách hiện không khả dụng để đặt trước');
  if (book.availableCopies > 0) throw ApiError.conflict('Sách vẫn còn bản có thể mượn, chưa thể đặt trước');
  try {
    const [reservation] = await Reservation.create([{ reader: readerId, book: bookId, status: 'waiting' }]);
    await auditService.log({ actor: readerId, action: 'reservation.create', targetType: 'Reservation', targetId: reservation._id, detail: { book: bookId } });
    return reservation;
  } catch (error) {
    if (error.code === 11000) throw ApiError.conflict('Bạn đã có lượt đặt trước đang chờ hoặc được giữ cho sách này');
    throw error;
  }
}

async function getMyReservations(readerId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, { defaultLimit: 10 });
  const filter = { reader: readerId };
  if (query.status) filter.status = query.status;
  const [reservations, total] = await Promise.all([
    Reservation.find(filter).populate('book', 'code title slug cover availableCopies').sort(sort).skip(skip).limit(limit).lean(),
    Reservation.countDocuments(filter),
  ]);
  const items = await Promise.all(reservations.map(async (reservation) => {
    if (reservation.status !== 'waiting') return { ...reservation, queuePosition: reservation.status === 'available' ? 0 : null };
    const before = await Reservation.countDocuments({
      book: reservation.book?._id || reservation.book,
      status: 'waiting',
      $or: [
        { createdAt: { $lt: reservation.createdAt } },
        { createdAt: reservation.createdAt, _id: { $lt: reservation._id } },
      ],
    });
    return { ...reservation, queuePosition: before + 1 };
  }));
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function cancelReservation(reservationId, readerId) {
  const session = await mongoose.startSession();
  let reservation;
  let offered = null;
  try {
    await session.withTransaction(async () => {
      reservation = await withSession(Reservation.findOne({ _id: reservationId, reader: readerId }), session);
      if (!reservation) throw ApiError.notFound('Lượt đặt trước không tồn tại');
      if (!['waiting', 'available'].includes(reservation.status)) throw ApiError.conflict('Chỉ có thể hủy lượt đang chờ hoặc đang được giữ');
      const wasAvailable = reservation.status === 'available';
      reservation.status = 'cancelled';
      reservation.holdUntil = undefined;
      await reservation.save({ session });
      if (wasAvailable) offered = await passHeldCopy(reservation.book, { session });
    });
  } finally {
    await session.endSession();
  }
  if (offered) await notifyAvailable(offered);
  await auditService.log({ actor: readerId, action: 'reservation.cancel', targetType: 'Reservation', targetId: reservation._id, detail: { book: reservation.book } });
  return { cancelled: true, reservationId: reservation._id };
}

async function findAvailableReservation(readerId, bookId, session) {
  return withSession(Reservation.findOne({ reader: readerId, book: bookId, status: 'available' }), session);
}

async function fulfillReservation(reservation, session) {
  reservation.status = 'fulfilled';
  reservation.holdUntil = undefined;
  await reservation.save({ session });
  return reservation;
}

module.exports = {
  createReservation,
  getMyReservations,
  cancelReservation,
  reserveReturnedCopy,
  passHeldCopy,
  notifyAvailable,
  findAvailableReservation,
  fulfillReservation,
};
