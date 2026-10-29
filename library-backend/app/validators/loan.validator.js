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

/**
 * Schema validate body khi nhân viên từ chối phiếu mượn
 * POST /api/v1/admin/loans/:id/reject
 */
const rejectLoanSchema = Joi.object({
  reason: Joi.string().trim().required().min(1).max(500).messages({
    'string.base': 'Lý do từ chối phải là chuỗi',
    'string.empty': 'Lý do từ chối không được để trống',
    'string.min': 'Lý do từ chối không được để trống',
    'any.required': 'Lý do từ chối là bắt buộc',
    'string.max': 'Lý do từ chối không được vượt quá 500 ký tự',
  }),
});

/**
 * Schema validate query khi nhân viên/admin lấy danh sách phiếu mượn
 * GET /api/v1/admin/loans?status=&q=&from=&to=&page=&limit=&sort=
 */
const queryAdminLoansSchema = Joi.object({
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
  q: Joi.string().trim().allow(''),
  from: Joi.date().iso().messages({
    'date.format': 'Ngày bắt đầu không đúng định dạng ISO',
  }),
  to: Joi.date().iso().messages({
    'date.format': 'Ngày kết thúc không đúng định dạng ISO',
  }),
  reader: Joi.string().pattern(objectIdRegex).messages({
    'string.pattern.base': 'ID độc giả không hợp lệ',
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim(),
});

module.exports = {
  submitLoanSchema,
  getLoansQuerySchema,
  loanIdParamSchema,
  rejectLoanSchema,
  queryAdminLoansSchema,
};

