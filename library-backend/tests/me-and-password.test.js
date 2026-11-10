const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, RefreshToken } = require('../app/models');
const userService = require('../app/services/user.service');
const authService = require('../app/services/auth.service');
const userController = require('../app/controllers/user.controller');
const authController = require('../app/controllers/auth.controller');
const {
  updateProfileSchema,
  changePasswordSchema,
} = require('../app/validators/user.validator');
const {
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

    it('resetPasswordSchema yêu cầu mã 32 ký tự hex và mật khẩu đủ mạnh', () => {
      expect(resetPasswordSchema.validate({ code: 'bad', newPassword: 'NewSecurePass123' }).error).toBeDefined();
      expect(resetPasswordSchema.validate({ code: 'a'.repeat(32), newPassword: '123' }).error).toBeDefined();
      expect(resetPasswordSchema.validate({ code: 'a'.repeat(32), newPassword: 'NewSecurePass123' }).error).toBeUndefined();
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

  describe('4. auth.service (reset-password)', () => {
    it('issuePasswordResetCode returns a 128-bit code while persisting only its SHA-256 hash for 30 minutes', async () => {
      const mockUser = { save: jest.fn().mockResolvedValue(true) };

      const result = await authService.issuePasswordResetCode(mockUser);

      expect(result.code).toMatch(/^[\da-f]{32}$/);
      expect(mockUser.passwordResetToken).toBe(crypto.createHash('sha256').update(result.code).digest('hex'));
      expect(mockUser.passwordResetToken).not.toBe(result.code);
      expect(mockUser.passwordResetExpires.getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
      expect(mockUser.passwordResetExpires.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60 * 1000);
      expect(result.expiresAt).toEqual(mockUser.passwordResetExpires);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });

    it('resetPassword từ chối khi token sai hoặc hết hạn', async () => {
      jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid_code', 'NewPassword123')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Mã khôi phục mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    });

    it('resetPassword thành công cập nhật mật khẩu, xóa token và thu hồi tất cả refresh token', async () => {
      const rawCode = 'a'.repeat(32);
      const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');

      const mockUser = {
        _id: 'user_123',
        status: 'active',
        passwordResetToken: tokenHash,
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
        passwordHash: 'old_hash',
        save: jest.fn().mockResolvedValue(true),
      };

      const updateUserSpy = jest.spyOn(User, 'findOneAndUpdate').mockImplementation(async (_filter, update) => {
        mockUser.passwordHash = update.$set.passwordHash;
        return mockUser;
      });
      const deleteTokensSpy = jest.spyOn(RefreshToken, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

      const res = await authService.resetPassword(rawCode, 'BrandNewPass123');

      expect(res.message).toContain('Đặt lại mật khẩu thành công');
      expect(updateUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({ passwordResetToken: tokenHash, status: 'active' }),
        expect.objectContaining({
          $set: { passwordHash: expect.any(String) },
          $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
        }),
        { new: true }
      );
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

    it('authController.resetPassword trả về 200 thông báo thành công', async () => {
      jest.spyOn(authService, 'resetPassword').mockResolvedValue({
        message: 'Đặt lại mật khẩu thành công',
      });

      const { req, res, next } = createMockReqRes({
        body: { code: 'a'.repeat(32), newPassword: 'pass' },
      });

      await authController.resetPassword(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.jsonData.data.message).toBe('Đặt lại mật khẩu thành công');
    });
  });
});

