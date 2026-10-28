const { ok, asyncHandler, notFoundHandler, errorHandler } = require('./errorHandler');
const auth = require('./auth.middleware');
const requireRole = require('./requireRole.middleware');
const validate = require('./validate.middleware');
const { generalLimiter, authLimiter, forumPostLimiter } = require('./rateLimit.middleware');
const { uploadSingle, uploadAvatar } = require('./upload.middleware');

module.exports = {
  ok,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  auth,
  optionalAuth: auth.optionalAuth,
  requireRole,
  validate,
  generalLimiter,
  authLimiter,
  forumPostLimiter,
  uploadSingle,
  uploadAvatar,
};

