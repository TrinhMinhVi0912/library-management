const ApiError = require('../api-error');

/**
 * Middleware kiểm tra vai trò người dùng (yêu cầu đi sau auth.middleware)
 * @param {...string|string[]} roles Danh sách vai trò được phép (e.g. 'admin', 'staff')
 */
const requireRole = (...roles) => {
  const allowedRoles = roles.flat();

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Chưa xác thực người dùng'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Bạn không có quyền thực hiện hành động này'));
    }

    next();
  };
};

module.exports = requireRole;
module.exports.requireRole = requireRole;

