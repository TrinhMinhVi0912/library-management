const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('../api-error');
const { asyncHandler } = require('./errorHandler');
const { User } = require('../models');

/**
 * Middleware xác thực người dùng qua JWT access token trong header Authorization
 */
const auth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Chưa cung cấp mã xác thực hợp lệ');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw ApiError.unauthorized('Mã xác thực không được để trống');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Mã xác thực đã hết hạn');
    }
    throw ApiError.unauthorized('Mã xác thực không hợp lệ');
  }

  const userId = decoded.id || decoded._id || decoded.userId;
  if (!userId) {
    throw ApiError.unauthorized('Mã xác thực không hợp lệ');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.unauthorized('Tài khoản không tồn tại hoặc đã bị xóa');
  }

  if (user.status !== 'active') {
    const lockMsg = user.lockReason
      ? `Tài khoản đã bị khóa. Lý do: ${user.lockReason}`
      : 'Tài khoản đã bị khóa';
    throw ApiError.unauthorized(lockMsg);
  }

  req.user = user;
  next();
});

/**
 * Middleware tùy chọn: nếu có token thì nạp user, nếu không có vẫn cho qua (req.user = null)
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const userId = decoded.id || decoded._id || decoded.userId;
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.status === 'active') {
        req.user = user;
        return next();
      }
    }
  } catch {
    // Bỏ qua lỗi token trong optionalAuth
  }

  req.user = null;
  next();
});

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
