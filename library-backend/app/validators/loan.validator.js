const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema validate body khi độc giả gửi yêu cầu mượn sách
 * POST /api/v1/loans
 */
const submitLoanSchema = Joi.object({
  expectedPickupDate: Joi.date().required().messages({
    'any.required': 'Ngày dự kiến nhận sách là bắt buộc',
    'date.base': 'Ngày dự kiến nhận sách không đúng định dạng ngày',
  }),
  requestNote: Joi.string().trim().max(500).allow('', null).messages({
    'string.max': 'Ghi chú không được vượt quá 500 ký tự',
  }),
  note: Joi.string().trim().max(500).allow('', null).messages({
    'string.max': 'Ghi chú không được vượt quá 500 ký tự',
  }),
  items: Joi.array()
    .items(
      Joi.object({
        book: Joi.string().pattern(objectIdRegex).required().messages({
          'string.pattern.base': 'ID sách không hợp lệ',
          'any.required': 'ID sách là bắt buộc',
        }),
      }).unknown(true)
    )
    .optional(),
});

/**
 * Schema validate query khi lấy danh sách phiếu mượn của tôi
 * GET /api/v1/me/loans?status=&page=&limit=&sort=
 */
const getLoansQuerySchema = Joi.object({
  status: Joi.string()
    .valid(
      'pending',
      'approved',
      'borrowing',
      'overdue',
      'returned',
      'rejected',
      'cancelled',
      'expired'
    )
    .messages({
      'any.only': 'Trạng thái phiếu mượn không hợp lệ',
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

/**
 * Schema validate params chứa ID phiếu mượn
 * GET /api/v1/me/loans/:id
 * POST /api/v1/me/loans/:id/cancel
 */
const loanIdParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID phiếu mượn không đúng định dạng ObjectId',
    'string.empty': 'ID phiếu mượn không được để trống',
    'any.required': 'ID phiếu mượn là bắt buộc',
  }),
});

module.exports = {
  submitLoanSchema,
  getLoansQuerySchema,
  loanIdParamSchema,
};

