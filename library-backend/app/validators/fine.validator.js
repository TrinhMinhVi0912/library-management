const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const fineIdParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required(),
});

const myFinesQuerySchema = Joi.object({
  status: Joi.string().valid('unpaid', 'paid', 'waived'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sort: Joi.string().trim(),
});

const adminFinesQuerySchema = myFinesQuerySchema.keys({
  reader: Joi.string().pattern(objectIdRegex),
});

const createFineSchema = Joi.object({
  reader: Joi.string().pattern(objectIdRegex).required(),
  type: Joi.string().valid('damaged', 'lost', 'other').required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().trim().min(1).max(500).required(),
});

const waiveFineSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
});

module.exports = { fineIdParamSchema, myFinesQuerySchema, adminFinesQuerySchema, createFineSchema, waiveFineSchema };
