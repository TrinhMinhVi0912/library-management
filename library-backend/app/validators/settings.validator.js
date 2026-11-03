const Joi = require('joi');

const settingsUpdateSchema = Joi.object({
  maxBooksPerLoan: Joi.number().integer().min(1),
  loanDays: Joi.number().integer().min(1),
  maxRenewals: Joi.number().integer().min(0),
  renewDays: Joi.number().integer().min(1),
  pickupHoldDays: Joi.number().integer().min(1),
  reservationHoldDays: Joi.number().integer().min(1),
  lateFeePerDay: Joi.number().min(0),
  lostBookFeeRate: Joi.number().min(0),
  lostBookProcessingFee: Joi.number().min(0),
}).min(1);

const auditLogsQuerySchema = Joi.object({
  actor: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  action: Joi.string().trim().max(100),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

module.exports = { settingsUpdateSchema, auditLogsQuerySchema };
