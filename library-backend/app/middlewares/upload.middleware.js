const multer = require('multer');
const ApiError = require('../api-error');

// Lưu trữ tệp trên bộ nhớ RAM (Buffer) để stream trực tiếp lên Cloudinary
const storage = multer.memoryStorage();

// Các định dạng ảnh được phép tải lên
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Bộ lọc kiểm tra định dạng tệp ảnh
 */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP')
    );
  }
};

// Cấu hình multer cơ sở
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // Giới hạn kích thước tối đa 2MB
  },
  fileFilter,
});

/**
 * Middleware upload 1 tệp duy nhất theo tên trường (mặc định là 'file')
 * @param {string} fieldName - Tên trường trong multipart form-data
 */
const uploadSingle = (fieldName = 'file') => {
  const multerMiddleware = upload.single(fieldName);

  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) {
        return next();
      }

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('Kích thước tệp không được vượt quá 2MB'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            ApiError.badRequest(`Tên trường tệp không hợp lệ, vui lòng đặt tên trường là '${fieldName}'`)
          );
        }
        return next(ApiError.badRequest(`Lỗi tải lên tệp: ${err.message}`));
      }

      return next(err);
    });
  };
};

/**
 * Middleware upload ảnh đại diện linh hoạt (chấp nhận tên trường 'avatar' hoặc 'file')
 */
const uploadAvatar = (req, res, next) => {
  const multerFields = upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  multerFields(req, res, (err) => {
    if (!err) {
      if (req.files) {
        if (req.files.avatar && req.files.avatar[0]) {
          req.file = req.files.avatar[0];
        } else if (req.files.file && req.files.file[0]) {
          req.file = req.files.file[0];
        }
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('Kích thước tệp không được vượt quá 2MB'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          ApiError.badRequest(
            'Tên trường tệp không hợp lệ, vui lòng gửi với tên trường \'avatar\' hoặc \'file\''
          )
        );
      }
      return next(ApiError.badRequest(`Lỗi tải lên tệp: ${err.message}`));
    }

    return next(err);
  });
};

module.exports = {
  upload,
  uploadSingle,
  uploadAvatar,
};
