const { User } = require('../app/models');
const cloudinaryUtil = require('../app/utils/cloudinary.util');
const userService = require('../app/services/user.service');
const uploadController = require('../app/controllers/upload.controller');
const userController = require('../app/controllers/user.controller');
const { upload, uploadSingle, uploadAvatar } = require('../app/middlewares/upload.middleware');

describe('Cloudinary & Image Upload Test Suite (BE-10)', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      headers: {},
      cookies: {},
      body: {},
      query: {},
      params: {},
      user: null,
      file: null,
      files: null,
      ...overrides,
    };
    const res = {
      statusCode: 200,
      jsonData: null,
      status: jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        res.jsonData = data;
        return res;
      }),
    };
    const next = jest.fn();
    return { req, res, next };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Cloudinary Util (cloudinary.util.js)', () => {
    it('isCloudinaryConfigured nhận diện đúng khi đang dùng placeholder', () => {
      // Mặc định env dùng your_cloudinary_* nên trả về false
      expect(cloudinaryUtil.isCloudinaryConfigured()).toBe(false);
    });

    it('uploadBuffer trả về url và publicId hợp lệ ở chế độ test fallback', async () => {
      const buffer = Buffer.from('fake-image-content');
      const result = await cloudinaryUtil.uploadBuffer(buffer, 'library/books');

      expect(result).toBeDefined();
      expect(result.url).toContain('https://res.cloudinary.com/');
      expect(result.publicId).toContain('library/books/');
    });

    it('destroy xử lý publicId hợp lệ an toàn', async () => {
      const res = await cloudinaryUtil.destroy('library/books/sample_id');
      expect(res).toEqual({ result: 'ok' });
    });

    it('destroy trả về null nếu không truyền publicId', async () => {
      const res = await cloudinaryUtil.destroy(null);
      expect(res).toBeNull();
    });
  });

  describe('2. Upload Middleware (upload.middleware.js)', () => {
    it('từ chối khi gửi tệp sai định dạng (không phải jpg, png, webp)', (done) => {
      const req = {
        headers: { 'content-type': 'multipart/form-data' },
      };
      const fakeFile = { mimetype: 'application/pdf', originalname: 'doc.pdf' };

      upload.fileFilter(req, fakeFile, (err, pass) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP');
        expect(pass).toBeUndefined();
        done();
      });
    });

    it('chấp nhận khi gửi tệp có định dạng jpg, png, webp', (done) => {
      const validMimes = ['image/jpeg', 'image/png', 'image/webp'];

      validMimes.forEach((mimetype) => {
        upload.fileFilter({}, { mimetype }, (err, pass) => {
          expect(err).toBeNull();
          expect(pass).toBe(true);
        });
      });
      done();
    });

    it('uploadAvatar gán req.file khi nhận được trường avatar hoặc file', () => {
      const { req, res, next } = createMockReqRes({
        files: {
          avatar: [{ originalname: 'avatar.png', buffer: Buffer.from('abc') }],
        },
      });

      uploadAvatar(req, res, next);
      expect(req.file).toBeDefined();
      expect(req.file.originalname).toBe('avatar.png');
    });

    it('uploadAvatar gán req.file khi nhận được trường file', () => {
      const { req, res, next } = createMockReqRes({
        files: {
          file: [{ originalname: 'avatar2.jpg', buffer: Buffer.from('def') }],
        },
      });

      uploadAvatar(req, res, next);
      expect(req.file).toBeDefined();
      expect(req.file.originalname).toBe('avatar2.jpg');
    });

    it('uploadSingle trả về hàm middleware', () => {
      const singleMw = uploadSingle('file');
      expect(typeof singleMw).toBe('function');
    });
  });

  describe('3. Upload Controller (upload.controller.js)', () => {
    it('uploadImage ném lỗi 400 nếu không có tệp đính kèm', async () => {
      const { req, res, next } = createMockReqRes({ file: null });

      await uploadController.uploadImage(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('chọn tệp hình ảnh');
    });

    it('uploadImage tải ảnh thành công và xử lý query folder có tiền tố library/', async () => {
      const uploadSpy = jest.spyOn(cloudinaryUtil, 'uploadBuffer').mockResolvedValue({
        url: 'https://res.cloudinary.com/test/image.jpg',
        publicId: 'library/authors/author_123',
      });

      const { req, res, next } = createMockReqRes({
        file: { buffer: Buffer.from('test-image') },
        query: { folder: 'authors' },
      });

      await uploadController.uploadImage(req, res, next);

      expect(uploadSpy).toHaveBeenCalledWith(expect.any(Buffer), 'library/authors');
      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.publicId).toBe('library/authors/author_123');
      expect(res.jsonData.data.url).toBe('https://res.cloudinary.com/test/image.jpg');
    });

    it('uploadImage dùng folder mặc định library/books nếu query không được cung cấp', async () => {
      const uploadSpy = jest.spyOn(cloudinaryUtil, 'uploadBuffer').mockResolvedValue({
        url: 'https://res.cloudinary.com/test/book.jpg',
        publicId: 'library/books/book_123',
      });

      const { req, res, next } = createMockReqRes({
        file: { buffer: Buffer.from('book-cover') },
        query: {},
      });

      await uploadController.uploadImage(req, res, next);

      expect(uploadSpy).toHaveBeenCalledWith(expect.any(Buffer), 'library/books');
      expect(res.statusCode).toBe(201);
    });
  });

  describe('4. User Avatar Service & Controller (user.service.js, user.controller.js)', () => {
    it('userService.updateAvatar ném lỗi 404 nếu không tìm thấy người dùng', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      await expect(
        userService.updateAvatar('non_existing_id', { buffer: Buffer.from('abc') })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy thông tin người dùng',
      });
    });

    it('userService.updateAvatar xóa avatar cũ nếu có publicId và cập nhật avatar mới', async () => {
      const destroySpy = jest.spyOn(cloudinaryUtil, 'destroy').mockResolvedValue({ result: 'ok' });
      jest.spyOn(cloudinaryUtil, 'uploadBuffer').mockResolvedValue({
        url: 'https://res.cloudinary.com/test/new-avatar.jpg',
        publicId: 'library/avatars/new_avatar_456',
      });

      const fakeUser = {
        _id: 'user_123',
        avatar: {
          url: 'https://res.cloudinary.com/test/old-avatar.jpg',
          publicId: 'library/avatars/old_avatar_123',
        },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const result = await userService.updateAvatar('user_123', {
        buffer: Buffer.from('avatar-buffer'),
      });

      expect(destroySpy).toHaveBeenCalledWith('library/avatars/old_avatar_123');
      expect(fakeUser.avatar.publicId).toBe('library/avatars/new_avatar_456');
      expect(fakeUser.save).toHaveBeenCalled();
      expect(result.url).toBe('https://res.cloudinary.com/test/new-avatar.jpg');
      expect(result.publicId).toBe('library/avatars/new_avatar_456');
      expect(result.avatar).toEqual(fakeUser.avatar);
    });

    it('userController.uploadAvatar ném lỗi 400 nếu không có req.file', async () => {
      const { req, res, next } = createMockReqRes({ file: null, user: { _id: 'user_123' } });

      await userController.uploadAvatar(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('chọn tệp hình ảnh');
    });

    it('userController.uploadAvatar gọi updateAvatar và trả về dữ liệu thành công', async () => {
      const updateAvatarSpy = jest.spyOn(userService, 'updateAvatar').mockResolvedValue({
        url: 'https://res.cloudinary.com/avatar.jpg',
        publicId: 'library/avatars/avatar_abc',
        avatar: {
          url: 'https://res.cloudinary.com/avatar.jpg',
          publicId: 'library/avatars/avatar_abc',
        },
      });

      const { req, res, next } = createMockReqRes({
        user: { _id: 'user_123' },
        file: { buffer: Buffer.from('avatar-data') },
      });

      await userController.uploadAvatar(req, res, next);

      expect(updateAvatarSpy).toHaveBeenCalledWith('user_123', req.file);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.url).toBe('https://res.cloudinary.com/avatar.jpg');
    });
  });
});
