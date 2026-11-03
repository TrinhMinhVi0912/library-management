const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const renewalIdParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required(),
});

const adminRenewalsQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

const rejectRenewalSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Lý do từ chối không được để trống',
    'any.required': 'Lý do từ chối là bắt buộc',
    'string.max': 'Lý do từ chối không được vượt quá 500 ký tự',
  }),
});

module.exports = { renewalIdParamSchema, adminRenewalsQuerySchema, rejectRenewalSchema };
