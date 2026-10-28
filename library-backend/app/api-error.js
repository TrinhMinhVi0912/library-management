class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Yêu cầu không hợp lệ', errors = null) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Chưa xác thực hoặc phiên đăng nhập hết hạn') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Không có quyền truy cập tài nguyên này') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Tài nguyên không tìm thấy') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Dữ liệu bị trùng lặp hoặc xung đột trạng thái') {
    return new ApiError(409, message);
  }

  static internal(message = 'Lỗi máy chủ nội bộ') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
