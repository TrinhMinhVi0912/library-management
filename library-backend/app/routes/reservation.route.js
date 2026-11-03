const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const reservationController = require('../controllers/reservation.controller');
const { reservationBookParamSchema, reservationIdParamSchema, myReservationsQuerySchema } = require('../validators/reservation.validator');

const router = express.Router();

router.post('/books/:bookId/reservations', auth, requireRole('reader'), validate(reservationBookParamSchema, 'params'), reservationController.createReservation);
router.get('/me/reservations', auth, requireRole('reader'), validate(myReservationsQuerySchema, 'query'), reservationController.getMyReservations);
router.delete('/me/reservations/:id', auth, requireRole('reader'), validate(reservationIdParamSchema, 'params'), reservationController.cancelReservation);

module.exports = router;
