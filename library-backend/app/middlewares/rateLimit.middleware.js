const rateLimit = require('express-rate-limit');

/**
 * Helper tạo phản hồi lỗi rate limit chuẩn hóa JSON
 * @param {string} message
 */
const createRateLimitHandler = (message) => (_req, res) => {
  return res.status(429).json({
    success: false,
    message,
  });
};

/**
 * Limiter chung cho toàn bộ API (15 phút, tối đa 1000 requests)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau ít phút.'
  ),
});

/**
 * Limiter nghiêm ngặt cho các endpoint xác thực /auth/* (15 phút, tối đa 20 requests)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Quá nhiều lượt thử xác thực từ địa chỉ IP này. Vui lòng thử lại sau 15 phút.'
  ),
});

/**
 * Limiter chống spam tạo bài viết/bình luận diễn đàn (1 phút, tối đa 5 requests)
 */
const forumPostLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Bạn đang thao tác quá nhanh trên diễn đàn. Vui lòng đợi 1 phút trước khi tiếp tục.'
  ),
});

module.exports = {
  generalLimiter,
  authLimiter,
  forumPostLimiter,
};

