const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const ApiError = require('../api-error');
const { User, RefreshToken } = require('../models');
const { nextCode } = require('../utils/code.util');
const googleTokenUtil = require('../utils/google-token.util');
const shelfService = require('./shelf.service');

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

  await shelfService.ensureDefaultShelves(user._id);

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
 * Authenticate a reader with a Google ID token. Existing password accounts are never linked automatically.
 * @param {string} idToken
 * @param {string} [userAgent]
 */
const loginWithGoogle = async (idToken, userAgent = '') => {
  let identity;
  try {
    identity = await googleTokenUtil.verifyGoogleIdToken(idToken);
  } catch (error) {
    if (error.code === 'GOOGLE_NOT_CONFIGURED') {
      throw new ApiError(503, 'Đăng nhập Google chưa được cấu hình trên máy chủ');
    }
    throw new ApiError(503, 'Không thể xác minh tài khoản Google lúc này');
  }

  if (!identity) throw ApiError.unauthorized('Google ID token không hợp lệ hoặc đã hết hạn');

  const normalizedEmail = identity.email.toLowerCase().trim();
  let user = await User.findOne({ googleId: identity.sub });
  let created = false;

  if (user) {
    if (user.role !== 'reader') throw ApiError.forbidden('Đăng nhập Google chỉ dành cho độc giả');
    if (user.status !== 'active') {
      const lockMsg = user.lockReason
        ? `Tài khoản đã bị khóa. Lý do: ${user.lockReason}`
        : 'Tài khoản đã bị khóa';
      throw ApiError.unauthorized(lockMsg);
    }
  } else {
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      throw ApiError.conflict('Email này đã có tài khoản. Hãy đăng nhập bằng email và mật khẩu trước; hệ thống không tự liên kết tài khoản Google.');
    }

    const fullName = String(identity.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = String(identity.given_name || fullName.slice(0, -1).join(' ') || normalizedEmail.split('@')[0] || 'Độc giả')
      .trim().slice(0, 50);
    const lastName = String(identity.family_name || fullName.at(-1) || 'Độc giả').trim().slice(0, 50);
    const randomPassword = crypto.randomBytes(48).toString('base64url');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    let code;
    try {
      code = await nextCode('user');
      user = await User.create({
        code,
        email: normalizedEmail,
        passwordHash,
        googleId: identity.sub,
        role: 'reader',
        firstName,
        lastName,
        status: 'active',
      });
      created = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await User.findOne({ googleId: identity.sub });
      if (!user) {
        throw ApiError.conflict('Email này đã có tài khoản. Hãy đăng nhập bằng email và mật khẩu trước; hệ thống không tự liên kết tài khoản Google.');
      }
      if (user.role !== 'reader') throw ApiError.forbidden('Đăng nhập Google chỉ dành cho độc giả');
      if (user.status !== 'active') throw ApiError.unauthorized('Tài khoản đã bị khóa');
    }

    if (created) await shelfService.ensureDefaultShelves(user._id);
  }

  user.lastLoginAt = new Date();
  await user.save();
  const { accessToken, refreshToken } = await createSession(user, userAgent);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
    created,
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

/**
 * Tạo mã đặt lại mật khẩu dùng một lần. Chỉ trả mã thô cho nhân viên đã
 * xác minh danh tính độc giả trực tiếp; database chỉ lưu SHA-256.
 * @param {object} user Tài khoản đã được kiểm tra quyền và trạng thái
 */
const issuePasswordResetCode = async (user) => {
  const rawCode = crypto.randomBytes(16).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(rawCode).digest('hex');
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  return {
    code: rawCode,
    expiresAt: user.passwordResetExpires,
  };
};

/**
 * Đặt lại mật khẩu bằng mã do nhân viên cấp trực tiếp (dùng một lần)
 * @param {string} code Mã thô chưa băm
 * @param {string} newPassword Mật khẩu mới
 */
const resetPassword = async (code, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);
  const user = await User.findOneAndUpdate(
    {
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
      status: 'active',
    },
    {
      $set: { passwordHash },
      $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
    },
    { new: true }
  );

  if (!user) {
    throw ApiError.badRequest('Mã khôi phục mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  // Thu hồi toàn bộ refresh token cũ của user này để bảo vệ phiên
  await RefreshToken.deleteMany({ user: user._id });

  return {
    message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
  };
};

module.exports = {
  hashToken,
  createSession,
  register,
  login,
  loginWithGoogle,
  refresh,
  logout,
  issuePasswordResetCode,
  resetPassword,
};
