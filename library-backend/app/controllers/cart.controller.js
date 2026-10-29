const { ok, asyncHandler } = require('../middlewares');
const cartService = require('../services/cart.service');

/**
 * Lấy giỏ mượn của người dùng hiện tại
 * GET /api/v1/cart
 */
const getCart = asyncHandler(async (req, res) => {
  const result = await cartService.getCart(req.user._id);
  return ok(res, result);
});

/**
 * Thêm sách vào giỏ mượn
 * POST /api/v1/cart/items
 */
const addItem = asyncHandler(async (req, res) => {
  const result = await cartService.addItem(req.user._id, req.body.bookId);
  return ok(res, result, null, 201);
});

/**
 * Xóa sách khỏi giỏ mượn
 * DELETE /api/v1/cart/items/:bookId
 */
const removeItem = asyncHandler(async (req, res) => {
  const result = await cartService.removeItem(req.user._id, req.params.bookId);
  return ok(res, result);
});

module.exports = {
  getCart,
  addItem,
  removeItem,
};

