const mongoose = require('mongoose');
const { Reservation, Loan } = require('../models');
const reservationService = require('../services/reservation.service');
const auditService = require('../services/audit.service');

async function run({ now = new Date() } = {}) {
  const candidates = await Reservation.find({ status: 'available', holdUntil: { $lte: now } }).select('_id').lean();
  let expiredCount = 0;
  let offeredCount = 0;

  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    let expiredReservation = null;
    let offered = null;
    try {
      await session.withTransaction(async () => {
        expiredReservation = null;
        offered = null;
        const reservation = await Reservation.findOne({ _id: candidate._id, status: 'available', holdUntil: { $lte: now } }).session(session);
        if (!reservation) return;
        const pendingLoan = await Loan.exists({
          reader: reservation.reader,
          status: 'pending',
          createdAt: { $lte: reservation.holdUntil },
          items: { $elemMatch: { book: reservation.book, status: 'pending' } },
        }).session(session);
        if (pendingLoan) return;
        reservation.status = 'expired';
        reservation.holdUntil = undefined;
        await reservation.save({ session });
        expiredReservation = reservation;
        offered = await reservationService.passHeldCopy(reservation.book, { now, session });
      });
    } finally {
      await session.endSession();
    }
    if (!expiredReservation) continue;
    expiredCount += 1;
    await auditService.log({ action: 'reservation.expire', targetType: 'Reservation', targetId: expiredReservation._id, detail: { book: expiredReservation.book } });
    if (offered) {
      offeredCount += 1;
      await reservationService.notifyAvailable(offered);
      await auditService.log({ action: 'reservation.available', targetType: 'Reservation', targetId: offered._id, detail: { book: offered.book } });
    }
  }
  return { expiredCount, offeredCount };
}

module.exports = { run };
