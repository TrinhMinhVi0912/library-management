const { ok, asyncHandler } = require('../middlewares');
const userService = require('../services/user.service');

/**
 * Xem thông tin hồ sơ của người dùng đang đăng nhập
 * GET /api/v1/me
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user._id);
  return ok(res, profile);
});

/**
 * Cập nhật thông tin hồ sơ của người dùng đang đăng nhập
 * PATCH /api/v1/me
 */
const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await userService.updateProfile(req.user._id, req.body);
  return ok(res, updatedUser);
});

/**
 * Đổi mật khẩu cá nhân
 * PATCH /api/v1/me/password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(req.user._id, currentPassword, newPassword);
  return ok(res, {
    message: 'Đổi mật khẩu thành công',
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};

