const bcrypt = require('bcryptjs');
const ApiError = require('../api-error');
const { User } = require('../models');
const cloudinaryUtil = require('../utils/cloudinary.util');

/**
 * Lấy thông tin hồ sơ của người dùng hiện tại
 * @param {string} userId
 */
const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Không tìm thấy thông tin người dùng');
  }
  return user.toJSON();
};

/**
 * Cập nhật thông tin hồ sơ người dùng
 * Nghiêm ngặt: không cho phép sửa role, status, code, email, unpaidFineTotal...
 *
 * @param {string} userId
 * @param {object} updateData
 */
const updateProfile = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Không tìm thấy thông tin người dùng');
  }

  // Danh sách các trường hồ sơ được phép cập nhật
  if (updateData.firstName !== undefined) {
    user.firstName = updateData.firstName.trim();
  }
  if (updateData.lastName !== undefined) {
    user.lastName = updateData.lastName.trim();
  }
  if (updateData.birthDate !== undefined) {
    user.birthDate = updateData.birthDate ? new Date(updateData.birthDate) : undefined;
  }
  if (updateData.gender !== undefined) {
    user.gender = updateData.gender || undefined;
  }
  if (updateData.address !== undefined) {
    user.address = updateData.address ? updateData.address.trim() : undefined;
  }
  if (updateData.phone !== undefined) {
    user.phone = updateData.phone ? updateData.phone.trim() : undefined;
  }

  await user.save();
  return user.toJSON();
};

/**
 * Đổi mật khẩu cá nhân
 * Bắt buộc xác thực mật khẩu hiện tại
 *
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.notFound('Không tìm thấy thông tin người dùng');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw ApiError.badRequest('Mật khẩu hiện tại không chính xác');
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('Mật khẩu mới không được trùng với mật khẩu hiện tại');
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  await user.save();

  return true;
};

/**
 * Cập nhật ảnh đại diện người dùng
 * - Tự động xóa ảnh cũ trên Cloudinary nếu có publicId
 * - Upload ảnh mới vào thư mục 'library/avatars'
 *
 * @param {string} userId
 * @param {Express.Multer.File} file
 */
const updateAvatar = async (userId, file) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Không tìm thấy thông tin người dùng');
  }

  // Nếu người dùng đã có avatar cũ với publicId, xóa trên Cloudinary
  if (user.avatar && user.avatar.publicId) {
    await cloudinaryUtil.destroy(user.avatar.publicId);
  }

  // Tải ảnh mới lên Cloudinary
  const uploadResult = await cloudinaryUtil.uploadBuffer(file.buffer, 'library/avatars');

  user.avatar = {
    url: uploadResult.url,
    publicId: uploadResult.publicId,
  };
  await user.save();

  return {
    url: user.avatar.url,
    publicId: user.avatar.publicId,
    avatar: user.avatar,
  };
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  updateAvatar,
};

