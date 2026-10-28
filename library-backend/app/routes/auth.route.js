const express = require('express');
const { authLimiter, validate, optionalAuth } = require('../middlewares');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Áp dụng authLimiter nghiêm ngặt cho toàn bộ route xác thực
router.use(authLimiter);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Đăng ký tài khoản độc giả mới
 * @access  Khách
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập tài khoản
 * @access  Khách
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Cấp access token mới và rotate refresh token
 * @access  Khách có refresh token (cookie / body)
 */
router.post('/refresh', validate(refreshSchema), authController.refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Đăng xuất và thu hồi refresh token
 * @access  Đăng nhập / Khách có refresh token
 */
router.post('/logout', optionalAuth, authController.logout);

module.exports = router;

