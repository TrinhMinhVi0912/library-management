const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, RefreshToken } = require('../app/models');
const userService = require('../app/services/user.service');
const authService = require('../app/services/auth.service');
const userController = require('../app/controllers/user.controller');
const authController = require('../app/controllers/auth.controller');
const mailer = require('../app/utils/mailer.util');
const {
  updateProfileSchema,
  changePasswordSchema,
} = require('../app/validators/user.validator');
const {
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../app/validators/auth.validator');

describe('Profile & Password Management Test Suite (BE-09)', () => {
  const createMockReqRes = (overrides = {}) => {
    const req = {
      headers: {},
      cookies: {},
      body: {},
      query: {},
      params: {},
      user: null,
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

  describe('1. Validators (user & auth)', () => {
    it('updateProfileSchema cho phép cập nhật thông tin cá nhân hợp lệ', () => {
      const valid = {
        firstName: 'Nguyễn',
        lastName: 'Văn B',
        gender: 'female',
        phone: '0987654321',
        address: 'Hà Nội',
        birthDate: '1995-12-10',
      };
      const { value, error } = updateProfileSchema.validate(valid);
      expect(error).toBeUndefined();
      expect(value.firstName).toBe('Nguyễn');
    });

    it('updateProfileSchema từ chối khi không có trường nào để cập nhật', () => {
      const { error } = updateProfileSchema.validate({});
      expect(error).toBeDefined();
    });

    it('changePasswordSchema yêu cầu mật khẩu mới đủ mạnh', () => {
      const weak = {
        currentPassword: 'OldPassword123',
        newPassword: 'short',
      };
      expect(changePasswordSchema.validate(weak).error).toBeDefined();

      const valid = {
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword456',
      };
      expect(changePasswordSchema.validate(valid).error).toBeUndefined();
    });

    it('forgotPasswordSchema & resetPasswordSchema validate đúng định dạng', () => {
      expect(forgotPasswordSchema.validate({ email: 'bad' }).error).toBeDefined();
      expect(forgotPasswordSchema.validate({ email: 'user@example.com' }).error).toBeUndefined();

      expect(resetPasswordSchema.validate({ token: 'tok', newPassword: '123' }).error).toBeDefined();
      expect(resetPasswordSchema.validate({ token: 'tok', newPassword: 'NewSecurePass123' }).error).toBeUndefined();
    });
  });

  describe('2. mailer.util', () => {
    it('gửi email giả lập khi thiếu cấu hình SMTP (log console ở dev)', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await mailer.sendPasswordResetEmail(
        'reader@example.com',
        'raw_reset_token_123',
        'Nam'
      );

      expect(result).toHaveProperty('simulated', true);
      expect(logSpy).toHaveBeenCalled();
      const logOutput = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logOutput).toContain('reader@example.com');
      expect(logOutput).toContain('raw_reset_token_123');
    });
  });

  describe('3. user.service (/me)', () => {
    it('getProfile trả về thông tin người dùng không chứa passwordHash', async () => {
      const mockUser = {
        _id: 'user_1',
        code: 'DG000001',
        email: 'reader@example.com',
        role: 'reader',
        toJSON: () => ({
          _id: 'user_1',
          code: 'DG000001',
          email: 'reader@example.com',
          role: 'reader',
        }),
      };
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const profile = await userService.getProfile('user_1');
      expect(profile.code).toBe('DG000001');
      expect(profile.role).toBe('reader');
      expect(profile.passwordHash).toBeUndefined();
    });

    it('updateProfile không cho phép sửa role, status, code, email', async () => {
      const mockUser = {
        _id: 'user_1',
        code: 'DG000001',
        email: 'reader@example.com',
        role: 'reader',
        status: 'active',
        firstName: 'OldFirst',
        lastName: 'OldLast',
        phone: '0900000000',
        save: jest.fn().mockResolvedValue(true),
        toJSON: function () {
          return {
            _id: this._id,
            code: this.code,
            email: this.email,
            role: this.role,
            status: this.status,
            firstName: this.firstName,
            lastName: this.lastName,
            phone: this.phone,
          };
        },
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const updateData = {
        firstName: 'NewFirst',
        phone: '0912345678',
        role: 'admin', // cố tình sửa role
        status: 'locked', // cố tình sửa status
        code: 'DG999999', // cố tình sửa code
        email: 'hacked@example.com', // cố tình sửa email
      };

      const result = await userService.updateProfile('user_1', updateData);

      expect(mockUser.save).toHaveBeenCalled();
      expect(result.firstName).toBe('NewFirst');
      expect(result.phone).toBe('0912345678');
      expect(result.role).toBe('reader'); // Vẫn là reader
      expect(result.code).toBe('DG000001'); // Vẫn là DG000001
      expect(result.email).toBe('reader@example.com'); // Vẫn là reader@example.com
      expect(result.status).toBe('active'); // Vẫn là active
    });

    it('changePassword từ chối khi mật khẩu cũ không đúng', async () => {
      const currentPasswordHash = await bcrypt.hash('CorrectPass123', 10);
      const mockUser = {
        _id: 'user_1',
        passwordHash: currentPasswordHash,
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        userService.changePassword('user_1', 'WrongPass123', 'NewPass1234')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Mật khẩu hiện tại không chính xác',
      });
    });

    it('changePassword từ chối khi mật khẩu mới trùng với mật khẩu cũ', async () => {
      const currentPasswordHash = await bcrypt.hash('SamePassword123', 10);
      const mockUser = {
        _id: 'user_1',
        passwordHash: currentPasswordHash,
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        userService.changePassword('user_1', 'SamePassword123', 'SamePassword123')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      });
    });

    it('changePassword thành công cập nhật passwordHash mới', async () => {
      const oldPasswordHash = await bcrypt.hash('OldPassword123', 10);
      const mockUser = {
        _id: 'user_1',
        passwordHash: oldPasswordHash,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await userService.changePassword('user_1', 'OldPassword123', 'NewPassword123');
      expect(res).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      const isNewMatch = await bcrypt.compare('NewPassword123', mockUser.passwordHash);
      expect(isNewMatch).toBe(true);
    });
  });

  describe('4. auth.service (forgot-password & reset-password)', () => {
    it('forgotPassword luôn trả về thông báo 200 chung dù email không tồn tại', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await authService.forgotPassword('nonexistent@example.com');
      expect(res).toHaveProperty('message');
      expect(res.message).toContain('Nếu email tồn tại trong hệ thống');
    });

    it('forgotPassword lưu token băm, hạn 30 phút và gọi mailer khi email hợp lệ', async () => {
      const mockUser = {
        _id: 'user_1',
        email: 'reader@example.com',
        firstName: 'An',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);
      const mailerSpy = jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue({ simulated: true });

      const res = await authService.forgotPassword('reader@example.com');
      expect(res.message).toContain('Nếu email tồn tại trong hệ thống');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.passwordResetToken).toBeDefined();
      expect(mockUser.passwordResetExpires).toBeInstanceOf(Date);
      expect(mailerSpy).toHaveBeenCalledWith(
        'reader@example.com',
        expect.any(String),
        'An'
      );
    });

    it('resetPassword từ chối khi token sai hoặc hết hạn', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.resetPassword('invalid_token', 'NewPassword123')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Mã khôi phục mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    });

    it('resetPassword thành công cập nhật mật khẩu, xóa token và thu hồi tất cả refresh token', async () => {
      const rawToken = 'valid_raw_token_12345';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const mockUser = {
        _id: 'user_123',
        status: 'active',
        passwordResetToken: tokenHash,
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
        passwordHash: 'old_hash',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      const deleteTokensSpy = jest.spyOn(RefreshToken, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

      const res = await authService.resetPassword(rawToken, 'BrandNewPass123');

      expect(res.message).toContain('Đặt lại mật khẩu thành công');
      expect(mockUser.passwordResetToken).toBeUndefined();
      expect(mockUser.passwordResetExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(deleteTokensSpy).toHaveBeenCalledWith({ user: 'user_123' });

      const isNewMatch = await bcrypt.compare('BrandNewPass123', mockUser.passwordHash);
      expect(isNewMatch).toBe(true);
    });
  });

  describe('5. Controllers (/me và auth)', () => {
    it('userController.getProfile trả về 200 kèm dữ liệu', async () => {
      jest.spyOn(userService, 'getProfile').mockResolvedValue({ code: 'DG000001' });

      const { req, res, next } = createMockReqRes({
        user: { _id: 'user_1' },
      });

      await userController.getProfile(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.code).toBe('DG000001');
    });

    it('userController.updateProfile trả về 200 kèm dữ liệu cập nhật', async () => {
      jest.spyOn(userService, 'updateProfile').mockResolvedValue({ code: 'DG000001', firstName: 'Mới' });

      const { req, res, next } = createMockReqRes({
        user: { _id: 'user_1' },
        body: { firstName: 'Mới' },
      });

      await userController.updateProfile(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.firstName).toBe('Mới');
    });

    it('userController.changePassword trả về 200 thông báo thành công', async () => {
      jest.spyOn(userService, 'changePassword').mockResolvedValue(true);

      const { req, res, next } = createMockReqRes({
        user: { _id: 'user_1' },
        body: { currentPassword: 'Old', newPassword: 'New' },
      });

      await userController.changePassword(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.message).toBe('Đổi mật khẩu thành công');
    });

    it('authController.forgotPassword trả về 200 generic message', async () => {
      jest.spyOn(authService, 'forgotPassword').mockResolvedValue({
        message: 'Nếu email tồn tại...',
      });

      const { req, res, next } = createMockReqRes({
        body: { email: 'test@example.com' },
      });

      await authController.forgotPassword(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.message).toContain('Nếu email tồn tại');
    });

    it('authController.resetPassword trả về 200 thông báo thành công', async () => {
      jest.spyOn(authService, 'resetPassword').mockResolvedValue({
        message: 'Đặt lại mật khẩu thành công',
      });

      const { req, res, next } = createMockReqRes({
        body: { token: 'tok', newPassword: 'pass' },
      });

      await authController.resetPassword(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.message).toBe('Đặt lại mật khẩu thành công');
    });
  });
});

