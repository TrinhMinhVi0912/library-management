const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const ApiError = require('../api-error');
const { User, RefreshToken } = require('../models');
const { nextCode } = require('../utils/code.util');

/**
 * Băm refresh token bằng thuật toán SHA-256 trước khi lưu hoặc tra cứu trong DB
 * @param {string} token
 * @returns {string} Chuỗi hash hex
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Tạo cặp access token (15m) và refresh token (7 ngày), lưu hash vào DB
 * @param {import('../models/user.model')} user
 * @param {string} [userAgent]
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: Date }>}
 */
const createSession = async (user, userAgent = '') => {
  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
      code: user.code,
    },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessTtl,
    }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      jti: crypto.randomUUID(),
    },
    config.jwt.refreshSecret,
    {
      expiresIn: `${config.jwt.refreshTtlDays}d`,
    }
  );

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
    userAgent: userAgent || '',
  });

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
};

/**
 * Đăng ký tài khoản độc giả mới (role 'reader', mã DG...)
 * @param {object} userData
 * @param {string} [userAgent]
 */
const register = async (userData, userAgent = '') => {
  const normalizedEmail = userData.email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw ApiError.conflict('Email đã được đăng ký trong hệ thống');
  }

  const code = await nextCode('user');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(userData.password, salt);

  const user = await User.create({
    code,
    email: normalizedEmail,
    passwordHash,
    role: 'reader',
    firstName: userData.firstName.trim(),
    lastName: userData.lastName.trim(),
    birthDate: userData.birthDate ? new Date(userData.birthDate) : undefined,
    gender: userData.gender || undefined,
    address: userData.address ? userData.address.trim() : undefined,
    phone: userData.phone ? userData.phone.trim() : undefined,
    status: 'active',
  });

  const { accessToken, refreshToken } = await createSession(user, userAgent);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

/**
 * Đăng nhập tài khoản bằng email và mật khẩu
 * @param {string} email
 * @param {string} password
 * @param {string} [userAgent]
 */
const login = async (email, password, userAgent = '') => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không chính xác');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không chính xác');
  }

  if (user.status !== 'active') {
    const lockMsg = user.lockReason
      ? `Tài khoản đã bị khóa. Lý do: ${user.lockReason}`
      : 'Tài khoản đã bị khóa';
    throw ApiError.unauthorized(lockMsg);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = await createSession(user, userAgent);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

/**
 * Cấp lại access token mới qua Refresh Token xoay vòng (Rotate)
 * Thu hồi token cũ và phát hành token mới
 * @param {string} rawRefreshToken
 * @param {string} [userAgent]
 */
const refresh = async (rawRefreshToken, userAgent = '') => {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token không được để trống');
  }

  let decoded;
  try {
    decoded = jwt.verify(rawRefreshToken, config.jwt.refreshSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token đã hết hạn');
    }
    throw ApiError.unauthorized('Refresh token không hợp lệ');
  }

  const userId = decoded.id || decoded._id || decoded.userId;
  if (!userId) {
    throw ApiError.unauthorized('Refresh token không hợp lệ');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({
    tokenHash,
    user: userId,
  });

  if (!tokenDoc) {
    throw ApiError.unauthorized('Refresh token không hợp lệ hoặc đã bị thu hồi');
  }

  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    await RefreshToken.deleteOne({ _id: tokenDoc._id });
    const lockMsg = user?.lockReason
      ? `Tài khoản đã bị khóa. Lý do: ${user.lockReason}`
      : 'Tài khoản đã bị khóa hoặc không tồn tại';
    throw ApiError.unauthorized(lockMsg);
  }

  // Rotate: Xóa refresh token cũ
  await RefreshToken.deleteOne({ _id: tokenDoc._id });

  // Cấp cặp token mới
  const { accessToken, refreshToken } = await createSession(user, userAgent);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
};

/**
 * Thu hồi refresh token khi đăng xuất
 * @param {string} rawRefreshToken
 */
const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.deleteOne({ tokenHash });
  }
  return true;
};

module.exports = {
  hashToken,
  createSession,
  register,
  login,
  refresh,
  logout,
};
