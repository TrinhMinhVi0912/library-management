const { Readable } = require('stream');
const { v2: cloudinary } = require('cloudinary');
const config = require('../config');

// Khởi tạo cấu hình Cloudinary từ biến môi trường
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

/**
 * Kiểm tra xem thông số cấu hình Cloudinary đã được thiết lập đầy đủ hay chưa
 */
const isCloudinaryConfigured = () => {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }
  if (
    cloudName.includes('your_cloudinary') ||
    apiKey.includes('your_cloudinary') ||
    apiSecret.includes('your_cloudinary')
  ) {
    return false;
  }
  return true;
};

/**
 * Tải tệp từ buffer lên Cloudinary thông qua upload_stream
 * @param {Buffer} buffer - Bộ đệm nhị phân của tệp ảnh
 * @param {string} [folder='library/books'] - Thư mục lưu trữ trên Cloudinary
 * @returns {Promise<{ url: string, publicId: string }>}
 */
const uploadBuffer = (buffer, folder = 'library/books') => {
  return new Promise((resolve, reject) => {
    // Nếu chưa cấu hình Cloudinary (ở môi trường test/dev), trả về dữ liệu mẫu để test không bị lỗi
    if (!isCloudinaryConfigured()) {
      if (config.env === 'test' || config.env === 'development') {
        const mockPublicId = `${folder}/mock_${Date.now()}`;
        return resolve({
          url: `https://res.cloudinary.com/demo/image/upload/${mockPublicId}.jpg`,
          publicId: mockPublicId,
        });
      }
      return reject(new Error('Cloudinary chưa được cấu hình (thiếu CLOUDINARY_*)'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * Xóa một ảnh khỏi Cloudinary theo publicId
 * @param {string} publicId - Mã định danh tệp trên Cloudinary
 * @returns {Promise<object|null>}
 */
const destroy = async (publicId) => {
  if (!publicId) {
    return null;
  }

  if (!isCloudinaryConfigured()) {
    return { result: 'ok' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`[Cloudinary Destroy Error] Không thể xóa publicId="${publicId}":`, error.message);
    // Trả về null thay vì quăng lỗi để không làm gãy luồng xử lý chính
    return null;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadBuffer,
  destroy,
};
