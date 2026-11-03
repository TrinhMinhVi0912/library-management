const { ok, asyncHandler } = require('../middlewares');
const reservationService = require('../services/reservation.service');

const createReservation = asyncHandler(async (req, res) => ok(res, await reservationService.createReservation(req.user._id, req.params.bookId), null, 201));
const getMyReservations = asyncHandler(async (req, res) => {
  const result = await reservationService.getMyReservations(req.user._id, req.query);
  return ok(res, result.items, result.meta);
});
const cancelReservation = asyncHandler(async (req, res) => ok(res, await reservationService.cancelReservation(req.params.id, req.user._id)));

module.exports = { createReservation, getMyReservations, cancelReservation };
