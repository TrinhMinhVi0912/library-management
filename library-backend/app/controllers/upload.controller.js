const ApiError = require('../api-error');
const { ok, asyncHandler } = require('../middlewares');
const cloudinaryUtil = require('../utils/cloudinary.util');

/**
 * Upload hình ảnh lên Cloudinary dành cho nhân viên / quản trị viên
 * POST /api/v1/admin/uploads?folder=books
 */
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('Vui lòng chọn tệp hình ảnh để tải lên');
  }

  // Tiền tố folder mặc định theo docs: library/books, library/avatars, library/authors...
  let targetFolder = 'library/books';
  if (req.query.folder && typeof req.query.folder === 'string') {
    const rawFolder = req.query.folder.trim().replace(/^\/+|\/+$/g, '');
    if (rawFolder) {
      targetFolder = rawFolder.startsWith('library/') ? rawFolder : `library/${rawFolder}`;
    }
  }

  const result = await cloudinaryUtil.uploadBuffer(req.file.buffer, targetFolder);

  return ok(
    res,
    {
      url: result.url,
      publicId: result.publicId,
    },
    null,
    201
  );
});

module.exports = {
  uploadImage,
};

