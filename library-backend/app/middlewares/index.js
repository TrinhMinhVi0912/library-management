const { ok, asyncHandler, notFoundHandler, errorHandler } = require('./errorHandler');
const auth = require('./auth.middleware');
const requireRole = require('./requireRole.middleware');
const validate = require('./validate.middleware');
const { generalLimiter, authLimiter, forumPostLimiter } = require('./rateLimit.middleware');

module.exports = {
  ok,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  auth,
  requireRole,
  validate,
  generalLimiter,
  authLimiter,
  forumPostLimiter,
};

