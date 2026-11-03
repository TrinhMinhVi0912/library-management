class ApiError extends Error {
  constructor(statusCode, message, errors = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.errorCode = code;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Yêu cầu không hợp lệ', errors = null, code = null) {
    return new ApiError(400, message, errors, code);
  }

  static unauthorized(message = 'Chưa xác thực hoặc phiên đăng nhập hết hạn') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Không có quyền truy cập tài nguyên này') {
    return new ApiError(403, message);
  }

  static unprocessableEntity(message = 'Dữ liệu không hợp lệ', errors = null) {
    return new ApiError(422, message, errors);
  }

  static notFound(message = 'Tài nguyên không tìm thấy', errors = null, code = null) {
    return new ApiError(404, message, errors, code);
  }

  static conflict(message = 'Dữ liệu bị trùng lặp hoặc xung đột trạng thái', errors = null, code = null) {
    return new ApiError(409, message, errors, code);
  }

  static internal(message = 'Lỗi máy chủ nội bộ') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
