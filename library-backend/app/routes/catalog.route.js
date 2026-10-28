const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const catalogController = require('../controllers/catalog.controller');
const {
  idParamSchema,
  createAuthorSchema,
  updateAuthorSchema,
  queryAuthorSchema,
  createCategorySchema,
  updateCategorySchema,
  queryCategorySchema,
  createPublisherSchema,
  updatePublisherSchema,
  queryPublisherSchema,
} = require('../validators/catalog.validator');

const router = express.Router();

const adminOnly = [auth, requireRole('staff', 'admin')];

// =============================================================================
// ROUTE CÔNG KHAI (PUBLIC)
// =============================================================================

// Thể loại (Categories)
router.get(
  '/categories',
  validate(queryCategorySchema, 'query'),
  catalogController.getPublicCategories
);

// Tác giả (Authors)
router.get(
  '/authors',
  validate(queryAuthorSchema, 'query'),
  catalogController.getPublicAuthors
);

router.get(
  '/authors/:id',
  validate(idParamSchema, 'params'),
  catalogController.getPublicAuthorById
);

// Nhà xuất bản (Publishers)
router.get(
  '/publishers',
  validate(queryPublisherSchema, 'query'),
  catalogController.getPublicPublishers
);

// =============================================================================
// ROUTE QUẢN TRỊ (ADMIN: STAFF & ADMIN)
// =============================================================================

// --- Tác giả (Authors) ---
router.get(
  '/admin/authors',
  adminOnly,
  validate(queryAuthorSchema, 'query'),
  catalogController.getAdminAuthors
);

router.get(
  '/admin/authors/:id',
  adminOnly,
  validate(idParamSchema, 'params'),
  catalogController.getAdminAuthorById
);

router.post(
  '/admin/authors',
  adminOnly,
  validate(createAuthorSchema, 'body'),
  catalogController.createAuthor
);

router.route('/admin/authors/:id')
  .patch(
    adminOnly,
    validate({ params: idParamSchema, body: updateAuthorSchema }),
    catalogController.updateAuthor
  )
  .put(
    adminOnly,
    validate({ params: idParamSchema, body: updateAuthorSchema }),
    catalogController.updateAuthor
  )
  .delete(
    adminOnly,
    validate(idParamSchema, 'params'),
    catalogController.deleteAuthor
  );

// --- Thể loại (Categories) ---
router.get(
  '/admin/categories',
  adminOnly,
  validate(queryCategorySchema, 'query'),
  catalogController.getAdminCategories
);

router.get(
  '/admin/categories/:id',
  adminOnly,
  validate(idParamSchema, 'params'),
  catalogController.getAdminCategoryById
);

router.post(
  '/admin/categories',
  adminOnly,
  validate(createCategorySchema, 'body'),
  catalogController.createCategory
);

router.route('/admin/categories/:id')
  .patch(
    adminOnly,
    validate({ params: idParamSchema, body: updateCategorySchema }),
    catalogController.updateCategory
  )
  .put(
    adminOnly,
    validate({ params: idParamSchema, body: updateCategorySchema }),
    catalogController.updateCategory
  )
  .delete(
    adminOnly,
    validate(idParamSchema, 'params'),
    catalogController.deleteCategory
  );

// --- Nhà xuất bản (Publishers) ---
router.get(
  '/admin/publishers',
  adminOnly,
  validate(queryPublisherSchema, 'query'),
  catalogController.getAdminPublishers
);

router.get(
  '/admin/publishers/:id',
  adminOnly,
  validate(idParamSchema, 'params'),
  catalogController.getAdminPublisherById
);

router.post(
  '/admin/publishers',
  adminOnly,
  validate(createPublisherSchema, 'body'),
  catalogController.createPublisher
);

router.route('/admin/publishers/:id')
  .patch(
    adminOnly,
    validate({ params: idParamSchema, body: updatePublisherSchema }),
    catalogController.updatePublisher
  )
  .put(
    adminOnly,
    validate({ params: idParamSchema, body: updatePublisherSchema }),
    catalogController.updatePublisher
  )
  .delete(
    adminOnly,
    validate(idParamSchema, 'params'),
    catalogController.deletePublisher
  );

module.exports = router;

