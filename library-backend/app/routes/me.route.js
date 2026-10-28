const express = require('express');
const { auth, validate } = require('../middlewares');
const {
  updateProfileSchema,
  changePasswordSchema,
} = require('../validators/user.validator');
const userController = require('../controllers/user.controller');

const router = express.Router();

// Tất cả các route /me đều yêu cầu người dùng phải đăng nhập hợp lệ
router.use(auth);

/**
 * @route   GET /api/v1/me
 * @desc    Xem thông tin hồ sơ của tôi
 * @access  Đăng nhập
 */
router.get('/', userController.getProfile);

/**
 * @route   PATCH /api/v1/me
 * @desc    Cập nhật thông tin hồ sơ của tôi (họ tên, ngày sinh, giới tính, địa chỉ, sđt)
 * @access  Đăng nhập
 */
router.patch('/', validate(updateProfileSchema), userController.updateProfile);

/**
 * @route   PATCH /api/v1/me/password
 * @desc    Đổi mật khẩu người dùng hiện tại
 * @access  Đăng nhập
 */
router.patch('/password', validate(changePasswordSchema), userController.changePassword);

module.exports = router;

