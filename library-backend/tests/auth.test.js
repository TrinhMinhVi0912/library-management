const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../app/config');
const { User, RefreshToken, Counter } = require('../app/models');
const authService = require('../app/services/auth.service');
const authController = require('../app/controllers/auth.controller');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../app/validators/auth.validator');
const { auth } = require('../app/middlewares');

describe('Auth Module Tests (BE-08)', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      headers: {},
      cookies: {},
      body: {},
      query: {},
      params: {},
      ...overrides,
    };
    const res = {
      statusCode: 200,
      jsonData: null,
      cookiesSet: {},
      cookiesCleared: {},
      cookie: jest.fn().mockImplementation((name, val, opts) => {
        res.cookiesSet[name] = { val, opts };
        return res;
      }),
      clearCookie: jest.fn().mockImplementation((name, opts) => {
        res.cookiesCleared[name] = opts;
        return res;
      }),
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

  describe('1. auth.validator unit tests', () => {
    it('registerSchema chấp nhận dữ liệu hợp lệ và mật khẩu mạnh', () => {
      const validPayload = {
        firstName: 'Nguyen',
        lastName: 'Van A',
        email: 'READER@Example.com',
        password: 'Password123',
        birthDate: '2000-01-01',
        gender: 'male',
        address: '123 Đường ABC, Hà Nội',
        phone: '0912345678',
      };

      const { value, error } = registerSchema.validate(validPayload);
      expect(error).toBeUndefined();
      expect(value.email).toBe('reader@example.com');
    });

    it('registerSchema từ chối mật khẩu yếu (< 8 ký tự hoặc không có số/chữ)', () => {
      const weak1 = {
        firstName: 'Nguyen',
        lastName: 'Van A',
        email: 'reader@example.com',
        password: 'short1', // < 8 ký tự
      };
      expect(registerSchema.validate(weak1).error).toBeDefined();

      const weak2 = {
        firstName: 'Nguyen',
        lastName: 'Van A',
        email: 'reader@example.com',
        password: 'onlylettershere', // không có chữ số
      };
      expect(registerSchema.validate(weak2).error).toBeDefined();

      const weak3 = {
        firstName: 'Nguyen',
        lastName: 'Van A',
        email: 'reader@example.com',
        password: '1234567890', // không có chữ cái
      };
      expect(registerSchema.validate(weak3).error).toBeDefined();
    });

    it('registerSchema từ chối khi thiếu trường bắt buộc', () => {
      expect(registerSchema.validate({}).error).toBeDefined();
      expect(registerSchema.validate({ firstName: 'A' }).error).toBeDefined();
    });

    it('loginSchema chấp nhận email và mật khẩu hợp lệ', () => {
      const { value, error } = loginSchema.validate({
        email: 'USER@example.com',
        password: 'MyPassword123',
      });
      expect(error).toBeUndefined();
      expect(value.email).toBe('user@example.com');
    });

    it('loginSchema từ chối khi thiếu email hoặc password', () => {
      expect(loginSchema.validate({ email: 'u@example.com' }).error).toBeDefined();
      expect(loginSchema.validate({ password: '123' }).error).toBeDefined();
    });

    it('refreshSchema cho phép chuỗi token', () => {
      expect(refreshSchema.validate({ refreshToken: 'abc' }).error).toBeUndefined();
      expect(refreshSchema.validate({}).error).toBeUndefined();
    });
  });

  describe('2. auth.service unit tests', () => {
    it('register thành công tạo user với mã DG..., bcrypt hash và session tokens', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ _id: 'user', seq: 1 });

      const mockSavedUser = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1',
        code: 'DG000001',
        email: 'reader@example.com',
        role: 'reader',
        firstName: 'Nguyen',
        lastName: 'Van A',
        status: 'active',
        toJSON: function () {
          return {
            _id: this._id,
            code: this.code,
            email: this.email,
            role: this.role,
            firstName: this.firstName,
            lastName: this.lastName,
            status: this.status,
          };
        },
      };

      jest.spyOn(User, 'create').mockResolvedValue(mockSavedUser);
      jest.spyOn(RefreshToken, 'create').mockResolvedValue({ _id: 'token_id_1' });

      const result = await authService.register({
        firstName: 'Nguyen',
        lastName: 'Van A',
        email: 'reader@example.com',
        password: 'Password123',
      });

      expect(result).toHaveProperty('user');
      expect(result.user.code).toBe('DG000001');
      expect(result.user.role).toBe('reader');
      expect(result.user.passwordHash).toBeUndefined();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');

      // Verify decoded access token payload
      const decodedAccess = jwt.verify(result.accessToken, config.jwt.accessSecret);
      expect(decodedAccess.id).toBe(mockSavedUser._id);
      expect(decodedAccess.role).toBe('reader');
      expect(decodedAccess.code).toBe('DG000001');
    });

    it('register báo lỗi conflict 409 khi email đã tồn tại', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({ _id: 'existing_id' });

      await expect(
        authService.register({
          firstName: 'Nguyen',
          lastName: 'Van A',
          email: 'reader@example.com',
          password: 'Password123',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email đã được đăng ký trong hệ thống',
      });
    });

    it('login thất bại 401 khi không tìm thấy user hoặc sai mật khẩu', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.login('notfound@example.com', 'Password123')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Email hoặc mật khẩu không chính xác',
      });

      const passwordHash = await bcrypt.hash('CorrectPassword123', 10);
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: 'user_id',
          email: 'user@example.com',
          passwordHash,
          status: 'active',
        }),
      });

      await expect(
        authService.login('user@example.com', 'WrongPassword123')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    });

    it('login thất bại 401 khi tài khoản bị khóa (locked)', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      const mockLockedUser = {
        _id: 'user_id',
        email: 'locked@example.com',
        passwordHash,
        status: 'locked',
        lockReason: 'Vi phạm quy chế mượn sách nhiều lần',
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockLockedUser),
      });

      await expect(
        authService.login('locked@example.com', 'Password123')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining('Tài khoản đã bị khóa'),
      });
    });

    it('login thành công cập nhật lastLoginAt và trả về session tokens', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      const mockUser = {
        _id: 'user_id_123',
        code: 'DG000001',
        email: 'reader@example.com',
        role: 'reader',
        passwordHash,
        status: 'active',
        lastLoginAt: null,
        save: jest.fn().mockResolvedValue(true),
        toJSON: function () {
          return {
            _id: this._id,
            code: this.code,
            email: this.email,
            role: this.role,
            status: this.status,
          };
        },
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      jest.spyOn(RefreshToken, 'create').mockResolvedValue({ _id: 'token_1' });

      const result = await authService.login('reader@example.com', 'Password123');
      expect(mockUser.lastLoginAt).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('refresh xoay vòng token: xóa token cũ và phát hành token mới khác biệt', async () => {
      const userId = '65f1a2b3c4d5e6f7a8b9c0d1';
      const rawRefreshToken = jwt.sign({ id: userId, jti: 'test-jti-old' }, config.jwt.refreshSecret, {
        expiresIn: '7d',
      });

      const tokenDoc = {
        _id: 'refresh_doc_id',
        user: userId,
        tokenHash: authService.hashToken(rawRefreshToken),
      };

      jest.spyOn(RefreshToken, 'findOne').mockResolvedValue(tokenDoc);
      jest.spyOn(RefreshToken, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(RefreshToken, 'create').mockResolvedValue({ _id: 'new_token_doc' });

      const mockUser = {
        _id: userId,
        code: 'DG000001',
        role: 'reader',
        status: 'active',
        toJSON: () => ({ _id: userId, code: 'DG000001', role: 'reader', status: 'active' }),
      };
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const result = await authService.refresh(rawRefreshToken);
      expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ _id: 'refresh_doc_id' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(rawRefreshToken);
    });

    it('refresh từ chối 401 khi token không tồn tại trong DB (đã bị thu hồi)', async () => {
      const rawRefreshToken = jwt.sign({ id: 'user_1' }, config.jwt.refreshSecret, {
        expiresIn: '7d',
      });

      jest.spyOn(RefreshToken, 'findOne').mockResolvedValue(null);

      await expect(authService.refresh(rawRefreshToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token không hợp lệ hoặc đã bị thu hồi',
      });
    });

    it('refresh từ chối 401 khi token không có hoặc bị lỗi format', async () => {
      await expect(authService.refresh(null)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token không được để trống',
      });

      await expect(authService.refresh('invalid.jwt.token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token không hợp lệ',
      });
    });

    it('logout thu hồi refresh token từ DB', async () => {
      const deleteSpy = jest.spyOn(RefreshToken, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const rawToken = 'sample_refresh_token';

      const res = await authService.logout(rawToken);
      expect(res).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith({
        tokenHash: authService.hashToken(rawToken),
      });
    });
  });

  describe('3. auth.controller unit tests', () => {
    it('register controller trả về 201 và set cookie refreshToken', async () => {
      const mockResult = {
        user: { code: 'DG000001', role: 'reader' },
        accessToken: 'access_tok_123',
        refreshToken: 'refresh_tok_123',
      };
      jest.spyOn(authService, 'register').mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: {
          firstName: 'Nguyen',
          lastName: 'Van A',
          email: 'reader@example.com',
          password: 'Password123',
        },
      });

      await authController.register(req, res, next);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user.code).toBe('DG000001');
      expect(res.jsonData.data.accessToken).toBe('access_tok_123');
      expect(res.cookiesSet.refreshToken.val).toBe('refresh_tok_123');
      expect(res.cookiesSet.refreshToken.opts.httpOnly).toBe(true);
    });

    it('login controller trả về 200, access token và set cookie refreshToken', async () => {
      const mockResult = {
        user: { code: 'DG000001', role: 'reader' },
        accessToken: 'access_tok_login',
        refreshToken: 'refresh_tok_login',
      };
      jest.spyOn(authService, 'login').mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: {
          email: 'reader@example.com',
          password: 'Password123',
        },
      });

      await authController.login(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.accessToken).toBe('access_tok_login');
      expect(res.cookiesSet.refreshToken.val).toBe('refresh_tok_login');
      expect(res.cookiesSet.refreshToken.opts.httpOnly).toBe(true);
    });

    it('refresh controller đọc token từ cookie, cập nhật cookie và trả về access token mới', async () => {
      const mockResult = {
        user: { code: 'DG000001', role: 'reader' },
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
      };
      jest.spyOn(authService, 'refresh').mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        cookies: {
          refreshToken: 'old_cookie_refresh_token',
        },
      });

      await authController.refresh(req, res, next);

      expect(authService.refresh).toHaveBeenCalledWith('old_cookie_refresh_token', '');
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.accessToken).toBe('new_access_token');
      expect(res.cookiesSet.refreshToken.val).toBe('new_refresh_token');
    });

    it('logout controller thu hồi token và clear cookie', async () => {
      jest.spyOn(authService, 'logout').mockResolvedValue(true);

      const { req, res, next } = createMockReqRes({
        cookies: {
          refreshToken: 'token_to_logout',
        },
      });

      await authController.logout(req, res, next);

      expect(authService.logout).toHaveBeenCalledWith('token_to_logout');
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.message).toBe('Đăng xuất thành công');
      expect(res.cookiesCleared.refreshToken).toBeDefined();
    });
  });

  describe('4. Token integration với auth middleware', () => {
    it('access token được cấp từ login cho phép truy cập route có auth middleware', async () => {
      const user = {
        _id: '65f1a2b3c4d5e6f7a8b9c0d1',
        code: 'DG000001',
        role: 'reader',
        status: 'active',
      };

      const accessToken = jwt.sign(
        { id: user._id, role: user.role, code: user.code },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessTtl }
      );

      jest.spyOn(User, 'findById').mockResolvedValue(user);

      const { req, res, next } = createMockReqRes({
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      await auth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.code).toBe('DG000001');
      expect(req.user.role).toBe('reader');
    });
  });
});
