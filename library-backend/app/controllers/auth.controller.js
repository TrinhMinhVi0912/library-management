const config = require('../config');
const { ok, asyncHandler } = require('../middlewares');
const authService = require('../services/auth.service');

/**
 * Cấu hình tùy chọn cookie cho refresh token
 */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  path: '/',
});

/**
 * Cấu hình xóa cookie
 */
const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: '/',
});

/**
 * Đăng ký tài khoản độc giả mới
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const result = await authService.register(req.body, userAgent);

  res.cookie('refreshToken', result.refreshToken, getCookieOptions());

  return ok(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    null,
    201
  );
});

/**
 * Đăng nhập tài khoản
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  const result = await authService.login(email, password, userAgent);

  res.cookie('refreshToken', result.refreshToken, getCookieOptions());

  return ok(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

/**
 * Làm mới access token bằng refresh token (Rotate)
 * POST /api/v1/auth/refresh
 */
const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const userAgent = req.headers['user-agent'] || '';
  const result = await authService.refresh(rawRefreshToken, userAgent);

  res.cookie('refreshToken', result.refreshToken, getCookieOptions());

  return ok(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

/**
 * Đăng xuất và thu hồi refresh token
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  await authService.logout(rawRefreshToken);

  res.clearCookie('refreshToken', getClearCookieOptions());

  return ok(res, {
    message: 'Đăng xuất thành công',
  });
});

/**
 * Quên mật khẩu - gửi email kèm link reset token
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  return ok(res, result);
});

/**
 * Đặt lại mật khẩu mới bằng token
 * POST /api/v1/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);
  return ok(res, result);
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};

