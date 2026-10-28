const ApiError = require('../api-error');
const config = require('../config');

/**
 * Helper chuẩn hóa phản hồi thành công
 * @param {import('express').Response} res
 * @param {any} data
 * @param {object} [meta]
 * @param {number} [statusCode=200]
 */
const ok = (res, data = null, meta = null, statusCode = 200) => {
  const payload = { success: true, data };
  if (meta) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
};

/**
 * Wrapper bắt lỗi cho async route handler / middleware
 * @param {Function} fn
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware xử lý 404 cho các route không tồn tại
 */
const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Đường dẫn không tồn tại: ${req.method} ${req.originalUrl}`));
};

/**
 * Middleware tập trung xử lý lỗi của toàn bộ ứng dụng
 */
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let errors = err.errors || null;

  // Xử lý lỗi từ Multer (nếu chưa được wrap chuyển đổi)
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Kích thước tệp không được vượt quá 2MB';
    } else {
      message = `Lỗi tải lên tệp: ${err.message}`;
    }
  }

  // Xử lý lỗi CastError từ Mongoose (ID không hợp lệ)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `ID hoặc trường dữ liệu '${err.path}' không hợp lệ`;
  }

  // Xử lý lỗi ValidationError từ Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Dữ liệu không hợp lệ';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Xử lý lỗi trùng lặp Unique Index từ MongoDB (mã lỗi 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedFields = Object.keys(err.keyValue || {});
    message = `Dữ liệu bị trùng lặp ở trường: ${duplicatedFields.join(', ')}`;
  }

  // Xử lý lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Mã xác thực không hợp lệ';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Mã xác thực đã hết hạn';
  }

  // Log lỗi nếu là lỗi máy chủ 500
  if (statusCode >= 500) {
    console.error('[Unhandled Error]', err);
  }

  const responseBody = {
    success: false,
    message,
    ...(errors ? { errors } : {}),
  };

  if (config.env === 'development' && statusCode >= 500) {
    responseBody.stack = err.stack;
  }

  return res.status(statusCode).json(responseBody);
};

module.exports = {
  ok,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
