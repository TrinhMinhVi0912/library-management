const { ok, asyncHandler } = require('../middlewares');
const catalogService = require('../services/catalog.service');

// =============================================================================
// PUBLIC CONTROLLERS
// =============================================================================

/**
 * Lấy danh sách thể loại (công khai)
 * GET /api/v1/categories
 */
const getPublicCategories = asyncHandler(async (req, res) => {
  const result = await catalogService.getCategories(req.query);
  return ok(res, result.categories, result.meta);
});

/**
 * Lấy danh sách tác giả (công khai)
 * GET /api/v1/authors
 */
const getPublicAuthors = asyncHandler(async (req, res) => {
  const result = await catalogService.getAuthors(req.query);
  return ok(res, result.authors, result.meta);
});

/**
 * Lấy chi tiết tác giả (công khai)
 * GET /api/v1/authors/:id
 */
const getPublicAuthorById = asyncHandler(async (req, res) => {
  const author = await catalogService.getAuthorById(req.params.id);
  return ok(res, author);
});

/**
 * Lấy danh sách nhà xuất bản (công khai)
 * GET /api/v1/publishers
 */
const getPublicPublishers = asyncHandler(async (req, res) => {
  const result = await catalogService.getPublishers(req.query);
  return ok(res, result.publishers, result.meta);
});

// =============================================================================
// ADMIN CONTROLLERS (STAFF & ADMIN)
// =============================================================================

// --- Authors ---
const getAdminAuthors = asyncHandler(async (req, res) => {
  const result = await catalogService.getAuthors(req.query);
  return ok(res, result.authors, result.meta);
});

const getAdminAuthorById = asyncHandler(async (req, res) => {
  const author = await catalogService.getAuthorById(req.params.id);
  return ok(res, author);
});

const createAuthor = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const author = await catalogService.createAuthor(req.body, context);
  return ok(res, author, null, 201);
});

const updateAuthor = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const author = await catalogService.updateAuthor(req.params.id, req.body, context);
  return ok(res, author);
});

const deleteAuthor = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const result = await catalogService.deleteAuthor(req.params.id, context);
  return ok(res, result);
});

// --- Categories ---
const getAdminCategories = asyncHandler(async (req, res) => {
  const result = await catalogService.getCategories(req.query);
  return ok(res, result.categories, result.meta);
});

const getAdminCategoryById = asyncHandler(async (req, res) => {
  const category = await catalogService.getCategoryById(req.params.id);
  return ok(res, category);
});

const createCategory = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const category = await catalogService.createCategory(req.body, context);
  return ok(res, category, null, 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const category = await catalogService.updateCategory(req.params.id, req.body, context);
  return ok(res, category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const result = await catalogService.deleteCategory(req.params.id, context);
  return ok(res, result);
});

// --- Publishers ---
const getAdminPublishers = asyncHandler(async (req, res) => {
  const result = await catalogService.getPublishers(req.query);
  return ok(res, result.publishers, result.meta);
});

const getAdminPublisherById = asyncHandler(async (req, res) => {
  const publisher = await catalogService.getPublisherById(req.params.id);
  return ok(res, publisher);
});

const createPublisher = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const publisher = await catalogService.createPublisher(req.body, context);
  return ok(res, publisher, null, 201);
});

const updatePublisher = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const publisher = await catalogService.updatePublisher(req.params.id, req.body, context);
  return ok(res, publisher);
});

const deletePublisher = asyncHandler(async (req, res) => {
  const context = { actor: req.user, ip: req.ip };
  const result = await catalogService.deletePublisher(req.params.id, context);
  return ok(res, result);
});

module.exports = {
  // Public
  getPublicCategories,
  getPublicAuthors,
  getPublicAuthorById,
  getPublicPublishers,

  // Admin Authors
  getAdminAuthors,
  getAdminAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,

  // Admin Categories
  getAdminCategories,
  getAdminCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,

  // Admin Publishers
  getAdminPublishers,
  getAdminPublisherById,
  createPublisher,
  updatePublisher,
  deletePublisher,
};

