const ApiError = require('../api-error');
const { ok, asyncHandler } = require('../middlewares');
const userService = require('../services/user.service');

const getAdminUsers = asyncHandler(async (req, res) => {
  const result = await userService.getAdminUsers(req.user, req.query);
  return ok(res, result.items, result.meta);
});

const getAdminUserById = asyncHandler(async (req, res) => {
  return ok(res, await userService.getAdminUserById(req.user, req.params.id));
});

const updateAdminUser = asyncHandler(async (req, res) => {
  return ok(res, await userService.updateAdminUser(req.user, req.params.id, req.body, { ip: req.ip }));
});

const lockUser = asyncHandler(async (req, res) => {
  return ok(res, await userService.lockUser(req.user, req.params.id, req.body.reason, { ip: req.ip }));
});

const unlockUser = asyncHandler(async (req, res) => {
  return ok(res, await userService.unlockUser(req.user, req.params.id, { ip: req.ip }));
});

const createStaff = asyncHandler(async (req, res) => {
  return ok(res, await userService.createStaff(req.user, req.body, { ip: req.ip }), null, 201);
});

const updateUserRole = asyncHandler(async (req, res) => {
  return ok(res, await userService.updateUserRole(req.user, req.params.id, req.body.role, { ip: req.ip }));
});

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

/**
 * Cập nhật ảnh đại diện người dùng
 * POST /api/v1/me/avatar
 */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('Vui lòng chọn tệp hình ảnh để tải lên');
  }

  const result = await userService.updateAvatar(req.user._id, req.file);
  return ok(res, result);
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getAdminUsers,
  getAdminUserById,
  updateAdminUser,
  lockUser,
  unlockUser,
  createStaff,
  updateUserRole,
};

