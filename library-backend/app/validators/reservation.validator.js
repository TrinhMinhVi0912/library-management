const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const reservationBookParamSchema = Joi.object({ bookId: Joi.string().pattern(objectIdRegex).required() });
const reservationIdParamSchema = Joi.object({ id: Joi.string().pattern(objectIdRegex).required() });
const myReservationsQuerySchema = Joi.object({
  status: Joi.string().valid('waiting', 'available', 'fulfilled', 'expired', 'cancelled'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

module.exports = { reservationBookParamSchema, reservationIdParamSchema, myReservationsQuerySchema };
