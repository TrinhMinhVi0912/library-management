const bcrypt = require('bcryptjs');
const ApiError = require('../api-error');
const { User } = require('../models');
const cloudinaryUtil = require('../utils/cloudinary.util');
const { RefreshToken } = require('../models');
const { nextCode } = require('../utils/code.util');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');
const auditService = require('./audit.service');
const authService = require('./auth.service');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ensureCanManage = (actor, target) => {
  if (actor.role === 'staff' && target.role !== 'reader') {
    throw ApiError.forbidden('Nhân viên chỉ được quản lý tài khoản độc giả');
  }
};

const getAdminUsers = async (actor, query = {}) => {
  const { page, limit, skip, sort } = parsePagination(query, { defaultLimit: 10 });
  const filter = {};
  if (actor.role === 'staff') filter.role = 'reader';
  else if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ code: pattern }, { email: pattern }, { firstName: pattern }, { lastName: pattern }, { phone: pattern }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).select('-passwordHash -passwordResetToken -passwordResetExpires')
      .sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
};

const getAdminUserById = async (actor, targetId) => {
  const user = await User.findById(targetId).select('-passwordHash -passwordResetToken -passwordResetExpires').lean();
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  ensureCanManage(actor, user);
  return user;
};

const updateAdminUser = async (actor, targetId, data, options = {}) => {
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  ensureCanManage(actor, user);
  const fields = ['firstName', 'lastName', 'birthDate', 'gender', 'address', 'phone', 'position'];
  for (const field of fields) {
    if (data[field] !== undefined) user[field] = data[field] || undefined;
  }
  await user.save();
  await auditService.log({ actor: actor._id, action: 'user.update', targetType: 'User', targetId: user._id, detail: { fields: Object.keys(data) }, ip: options.ip || null });
  return user.toJSON();
};

const lockUser = async (actor, targetId, reason, options = {}) => {
  if (actor._id.toString() === targetId.toString()) throw ApiError.forbidden('Không thể tự khóa tài khoản của mình');
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  ensureCanManage(actor, user);
  if (user.status === 'locked') throw ApiError.conflict('Tài khoản đã bị khóa');
  user.status = 'locked';
  user.lockReason = reason;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  await auditService.log({ actor: actor._id, action: 'user.lock', targetType: 'User', targetId: user._id, detail: { reason }, ip: options.ip || null });
  return user.toJSON();
};

const unlockUser = async (actor, targetId, options = {}) => {
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  ensureCanManage(actor, user);
  user.status = 'active';
  user.lockReason = undefined;
  await user.save();
  await auditService.log({ actor: actor._id, action: 'user.unlock', targetType: 'User', targetId: user._id, ip: options.ip || null });
  return user.toJSON();
};

const createStaff = async (actor, data, options = {}) => {
  if (actor.role !== 'admin') throw ApiError.forbidden('Chỉ admin được tạo tài khoản nhân viên');
  const email = data.email.toLowerCase().trim();
  if (await User.findOne({ email })) throw ApiError.conflict('Email đã được sử dụng');
  const passwordHash = await bcrypt.hash(data.password, await bcrypt.genSalt(10));
  const user = await User.create({
    code: await nextCode('user'), email, passwordHash, role: 'staff', status: 'active',
    firstName: data.firstName.trim(), lastName: data.lastName.trim(),
    position: data.position?.trim(), phone: data.phone?.trim(), address: data.address?.trim(),
  });
  await auditService.log({ actor: actor._id, action: 'user.create_staff', targetType: 'User', targetId: user._id, detail: { code: user.code, email: user.email }, ip: options.ip || null });
  return user.toJSON();
};

const updateUserRole = async (actor, targetId, role, options = {}) => {
  if (actor.role !== 'admin') throw ApiError.forbidden('Chỉ admin được đổi vai trò người dùng');
  if (actor._id.toString() === targetId.toString()) throw ApiError.forbidden('Không thể tự đổi vai trò của mình');
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  const previousRole = user.role;
  user.role = role;
  await user.save();
  await auditService.log({ actor: actor._id, action: 'user.role_update', targetType: 'User', targetId: user._id, detail: { from: previousRole, to: role }, ip: options.ip || null });
  return user.toJSON();
};

const requestPasswordReset = async (actor, targetId, options = {}) => {
  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  ensureCanManage(actor, user);
  if (user.status !== 'active') throw ApiError.conflict('Chỉ cấp mã khôi phục cho tài khoản đang hoạt động');

  const recovery = await authService.issuePasswordResetCode(user);
  await auditService.log({
    actor: actor._id,
    action: 'user.password_reset_code_issued',
    targetType: 'User',
    targetId: user._id,
    ip: options.ip || null,
  });
  return {
    message: 'Đã tạo mã khôi phục. Chỉ cung cấp trực tiếp sau khi xác minh danh tính độc giả.',
    resetCode: recovery.code,
    expiresAt: recovery.expiresAt,
  };
};

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
  getAdminUsers,
  getAdminUserById,
  updateAdminUser,
  lockUser,
  unlockUser,
  createStaff,
  updateUserRole,
  requestPasswordReset,
};

