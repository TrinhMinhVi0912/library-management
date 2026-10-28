const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const bookController = require('../controllers/book.controller');
const {
  idParamSchema,
  createBookSchema,
  updateBookSchema,
  updateStatusSchema,
  queryAdminBookSchema,
} = require('../validators/book.validator');

const router = express.Router();

// Tất cả các route quản trị đều yêu cầu xác thực và phân quyền nhân viên (staff) hoặc quản trị viên (admin)
router.use(auth);
router.use(requireRole('staff', 'admin'));

// =============================================================================
// QUẢN LÝ SÁCH (/admin/books)
// =============================================================================

router
  .route('/books')
  .get(validate(queryAdminBookSchema, 'query'), bookController.getAdminBooks)
  .post(validate(createBookSchema, 'body'), bookController.createBook);

router
  .route('/books/:id')
  .get(validate(idParamSchema, 'params'), bookController.getAdminBookById)
  .put(
    validate({ params: idParamSchema, body: updateBookSchema }),
    bookController.updateBook
  )
  .patch(
    validate({ params: idParamSchema, body: updateBookSchema }),
    bookController.updateBook
  )
  .delete(validate(idParamSchema, 'params'), bookController.deleteBook);

router.patch(
  '/books/:id/status',
  validate({ params: idParamSchema, body: updateStatusSchema }),
  bookController.updateBookStatus
);

module.exports = router;

