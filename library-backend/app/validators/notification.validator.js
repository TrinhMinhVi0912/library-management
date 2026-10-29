const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema validate params khi đánh dấu đã đọc 1 thông báo
 * PATCH /api/v1/me/notifications/:id/read
 */
const notificationIdParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID thông báo không đúng định dạng ObjectId hợp lệ',
    'string.empty': 'ID thông báo không được để trống',
    'any.required': 'ID thông báo là bắt buộc',
  }),
});

/**
 * Schema validate query params cho danh sách thông báo
 * GET /api/v1/me/notifications?unread=true&page=1&limit=20
 */
const notificationQuerySchema = Joi.object({
  unread: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Trang phải là số',
    'number.min': 'Trang phải từ 1 trở lên',
  }),
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'Giới hạn phải là số',
    'number.min': 'Giới hạn phải từ 1 trở lên',
    'number.max': 'Giới hạn tối đa 100',
  }),
});

module.exports = {
  notificationIdParamSchema,
  notificationQuerySchema,
};

