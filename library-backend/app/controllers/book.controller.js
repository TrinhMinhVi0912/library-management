const { ok, asyncHandler } = require('../middlewares');
const bookService = require('../services/book.service');

/**
 * Lấy danh sách sách dành cho quản trị viên (có phân trang, tìm kiếm & lọc)
 * GET /api/v1/admin/books
 */
const getAdminBooks = asyncHandler(async (req, res) => {
  const result = await bookService.getAdminBooks(req.query);
  return ok(res, result.books, result.meta);
});

/**
 * Lấy chi tiết sách theo ID dành cho quản trị viên
 * GET /api/v1/admin/books/:id
 */
const getAdminBookById = asyncHandler(async (req, res) => {
  const book = await bookService.getBookById(req.params.id);
  return ok(res, book);
});

/**
 * Tạo mới một đầu sách
 * POST /api/v1/admin/books
 */
const createBook = asyncHandler(async (req, res) => {
  const book = await bookService.createBook(req.body, {
    actor: req.user,
    ip: req.ip,
  });
  return ok(res, book, null, 201);
});

/**
 * Cập nhật thông tin sách
 * PUT/PATCH /api/v1/admin/books/:id
 */
const updateBook = asyncHandler(async (req, res) => {
  const book = await bookService.updateBook(req.params.id, req.body, {
    actor: req.user,
    ip: req.ip,
  });
  return ok(res, book);
});

/**
 * Cập nhật trạng thái hiển thị (ẩn / hiện) của sách
 * PATCH /api/v1/admin/books/:id/status
 */
const updateBookStatus = asyncHandler(async (req, res) => {
  const book = await bookService.updateBookStatus(req.params.id, req.body.status, {
    actor: req.user,
    ip: req.ip,
  });
  return ok(res, book);
});

/**
 * Xóa một đầu sách (chặn nếu đã có lịch sử mượn)
 * DELETE /api/v1/admin/books/:id
 */
const deleteBook = asyncHandler(async (req, res) => {
  const result = await bookService.deleteBook(req.params.id, {
    actor: req.user,
    ip: req.ip,
  });
  return ok(res, result);
});

/**
 * Lấy danh sách sách công khai (tìm kiếm, lọc, phân trang)
 * GET /api/v1/books
 */
const getPublicBooks = asyncHandler(async (req, res) => {
  const result = await bookService.getPublicBooks(req.query);
  return ok(res, result.books, result.meta);
});

/**
 * Gợi ý nhanh tìm kiếm sách
 * GET /api/v1/books/suggest?q=
 */
const suggestBooks = asyncHandler(async (req, res) => {
  const suggestions = await bookService.suggestBooks(req.query.q);
  return ok(res, suggestions);
});

/**
 * Lấy dữ liệu sách cho trang chủ
 * GET /api/v1/books/home
 */
const getHomeBooks = asyncHandler(async (_req, res) => {
  const homeData = await bookService.getHomeBooks();
  return ok(res, homeData);
});

/**
 * Lấy chi tiết sách theo ID hoặc Slug
 * GET /api/v1/books/:idOrSlug
 */
const getBookByIdOrSlug = asyncHandler(async (req, res) => {
  const book = await bookService.getBookByIdOrSlug(req.params.idOrSlug);
  return ok(res, book);
});

/**
 * Lấy danh sách sách liên quan
 * GET /api/v1/books/:id/related
 */
const getRelatedBooks = asyncHandler(async (req, res) => {
  const related = await bookService.getRelatedBooks(req.params.id, req.query.limit);
  return ok(res, related);
});

module.exports = {
  getAdminBooks,
  getAdminBookById,
  createBook,
  updateBook,
  updateBookStatus,
  deleteBook,
  getPublicBooks,
  suggestBooks,
  getHomeBooks,
  getBookByIdOrSlug,
  getRelatedBooks,
};

