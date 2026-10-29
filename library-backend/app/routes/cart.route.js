const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const { addCartItemSchema, bookIdParamSchema } = require('../validators/cart.validator');
const cartController = require('../controllers/cart.controller');

const router = express.Router();

// Tất cả route giỏ mượn yêu cầu đăng nhập + role reader
router.use(auth, requireRole('reader'));

/**
 * @route   GET /api/v1/cart
 * @desc    Lấy giỏ mượn hiện tại (kèm thông tin sách & cờ còn/hết)
 * @access  Reader
 */
router.get('/', cartController.getCart);

/**
 * @route   POST /api/v1/cart/items
 * @desc    Thêm sách vào giỏ mượn
 * @access  Reader
 */
router.post('/items', validate(addCartItemSchema), cartController.addItem);

/**
 * @route   DELETE /api/v1/cart/items/:bookId
 * @desc    Xóa sách khỏi giỏ mượn
 * @access  Reader
 */
router.delete(
  '/items/:bookId',
  validate(bookIdParamSchema, 'params'),
  cartController.removeItem
);

module.exports = router;

