const express = require('express');
const { validate } = require('../middlewares');
const {
  queryPublicBookSchema,
  suggestQuerySchema,
  idParamSchema,
  idOrSlugParamSchema,
  relatedQuerySchema,
} = require('../validators/book.validator');
const bookController = require('../controllers/book.controller');

const router = express.Router();

/**
 * @route   GET /api/v1/books
 * @desc    Danh sách sách công khai (tìm kiếm q, lọc thể loại, tác giả, NXB, năm, còn hàng, sắp xếp)
 * @access  Public
 */
router.get('/', validate(queryPublicBookSchema, 'query'), bookController.getPublicBooks);

/**
 * @route   GET /api/v1/books/suggest
 * @desc    Gợi ý tìm kiếm nhanh sách công khai (tối đa 8 quyển)
 * @access  Public
 */
router.get('/suggest', validate(suggestQuerySchema, 'query'), bookController.suggestBooks);

/**
 * @route   GET /api/v1/books/home
 * @desc    Dữ liệu trang chủ (sách mới, sách mượn nhiều, sách đánh giá cao)
 * @access  Public
 */
router.get('/home', bookController.getHomeBooks);

/**
 * @route   GET /api/v1/books/:id/related
 * @desc    Lấy danh sách sách liên quan (cùng thể loại hoặc tác giả)
 * @access  Public
 */
router.get(
  '/:id/related',
  validate(idParamSchema, 'params'),
  validate(relatedQuerySchema, 'query'),
  bookController.getRelatedBooks
);

/**
 * @route   GET /api/v1/books/:idOrSlug
 * @desc    Chi tiết sách theo ID hoặc Slug (chỉ trả về sách active)
 * @access  Public
 */
router.get('/:idOrSlug', validate(idOrSlugParamSchema, 'params'), bookController.getBookByIdOrSlug);

module.exports = router;

