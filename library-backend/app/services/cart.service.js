const ApiError = require('../api-error');
const { Cart, Book } = require('../models');
const settingsService = require('./settings.service');

/**
 * Lấy giỏ mượn của người dùng, kèm thông tin sách & cờ còn/hết.
 * Nếu chưa có giỏ → trả mảng trống.
 *
 * @param {string} userId
 * @returns {Promise<Object>} { items: [...] }
 */
async function getCart(userId) {
  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.book',
    select: 'title slug cover authors authorText categories availableCopies totalCopies status price',
    populate: [
      { path: 'authors', select: 'name' },
      { path: 'categories', select: 'name slug' },
    ],
  });

  if (!cart) {
    return { items: [] };
  }

  // Gắn cờ available (còn sách & active) cho từng item
  const items = cart.items.map((item) => {
    const bookObj = item.book ? item.book.toObject() : null;
    return {
      book: bookObj,
      addedAt: item.addedAt,
      available: bookObj ? bookObj.status === 'active' && bookObj.availableCopies > 0 : false,
    };
  });

  return { items };
}

/**
 * Thêm sách vào giỏ mượn.
 * Kiểm tra: sách tồn tại & active, còn bản sao, chưa có trong giỏ, giỏ < maxBooksPerLoan.
 *
 * @param {string} userId
 * @param {string} bookId
 * @returns {Promise<Object>} Giỏ sau khi thêm
 */
async function addItem(userId, bookId) {
  // 1. Kiểm tra sách tồn tại & active
  const book = await Book.findById(bookId);
  if (!book) {
    throw ApiError.notFound('Sách không tồn tại');
  }
  if (book.status !== 'active') {
    throw ApiError.badRequest('Sách hiện không khả dụng');
  }

  // 2. Kiểm tra còn bản sao
  if (book.availableCopies <= 0) {
    throw ApiError.badRequest('Sách đã hết, không thể thêm vào giỏ');
  }

  // 3. Lấy hoặc tạo giỏ
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  // 4. Kiểm tra chưa có trong giỏ
  const alreadyInCart = cart.items.some(
    (item) => item.book.toString() === bookId
  );
  if (alreadyInCart) {
    throw ApiError.conflict('Sách đã có trong giỏ mượn');
  }

  // 5. Kiểm tra giỏ < maxBooksPerLoan
  const settings = await settingsService.getSettings();
  const maxBooks = settings.maxBooksPerLoan || 5;
  if (cart.items.length >= maxBooks) {
    throw ApiError.badRequest(
      `Giỏ mượn đã đầy (tối đa ${maxBooks} cuốn)`
    );
  }

  // 6. Thêm sách vào giỏ
  cart.items.push({ book: bookId, addedAt: new Date() });
  await cart.save();

  // Trả giỏ đã populate
  return getCart(userId);
}

/**
 * Xóa sách khỏi giỏ mượn.
 *
 * @param {string} userId
 * @param {string} bookId
 * @returns {Promise<Object>} Giỏ sau khi xóa
 */
async function removeItem(userId, bookId) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    throw ApiError.notFound('Giỏ mượn không tồn tại');
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.book.toString() === bookId
  );
  if (itemIndex === -1) {
    throw ApiError.notFound('Sách không có trong giỏ mượn');
  }

  cart.items.splice(itemIndex, 1);
  await cart.save();

  return getCart(userId);
}

module.exports = {
  getCart,
  addItem,
  removeItem,
};

