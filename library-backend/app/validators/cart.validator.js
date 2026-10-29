const Joi = require('joi');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema validate body khi thêm sách vào giỏ
 * POST /api/v1/cart/items
 */
const addCartItemSchema = Joi.object({
  bookId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID sách không đúng định dạng ObjectId hợp lệ',
    'string.empty': 'ID sách không được để trống',
    'any.required': 'ID sách là bắt buộc',
  }),
});

/**
 * Schema validate params khi xóa sách khỏi giỏ
 * DELETE /api/v1/cart/items/:bookId
 */
const bookIdParamSchema = Joi.object({
  bookId: Joi.string().pattern(objectIdRegex).required().messages({
    'string.pattern.base': 'ID sách không đúng định dạng ObjectId hợp lệ',
    'string.empty': 'ID sách không được để trống',
    'any.required': 'ID sách là bắt buộc',
  }),
});

module.exports = {
  addCartItemSchema,
  bookIdParamSchema,
};

