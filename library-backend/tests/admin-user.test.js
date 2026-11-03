const { User, RefreshToken } = require('../app/models');
const userService = require('../app/services/user.service');
const auditService = require('../app/services/audit.service');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const config = require('../app/config');
const {
  adminUsersQuerySchema,
  updateAdminUserSchema,
  lockUserSchema,
  createStaffSchema,
  updateRoleSchema,
} = require('../app/validators/admin-user.validator');

const staffId = '507f1f77bcf86cd799439021';
const readerId = '507f1f77bcf86cd799439022';
const otherStaffId = '507f1f77bcf86cd799439023';
const admin = { _id: '507f1f77bcf86cd799439020', role: 'admin' };
const staff = { _id: staffId, role: 'staff' };

describe('BE-28: Admin user management', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  describe('validators', () => {
    it('validates filters and supplies pagination defaults', () => {
      const { error, value } = adminUsersQuerySchema.validate({ role: 'reader', status: 'locked' });
      expect(error).toBeUndefined();
      expect(value).toMatchObject({ role: 'reader', status: 'locked', page: 1, limit: 10 });
      expect(adminUsersQuerySchema.validate({ status: 'unknown' }).error).toBeDefined();
    });

    it('accepts editable fields and rejects empty updates', () => {
      expect(updateAdminUserSchema.validate({ firstName: 'An' }).error).toBeUndefined();
      expect(updateAdminUserSchema.validate({}).error).toBeDefined();
      expect(updateAdminUserSchema.validate({ role: 'admin' }).error).toBeDefined();
    });

    it('requires a non-empty lock reason', () => {
      expect(lockUserSchema.validate({}).error).toBeDefined();
      expect(lockUserSchema.validate({ reason: '  ' }).error).toBeDefined();
      expect(lockUserSchema.validate({ reason: 'Vi phạm quy định' }).error).toBeUndefined();
    });

    it('validates staff creation credentials and role updates', () => {
      const validStaff = { firstName: 'An', lastName: 'Nguyễn', email: 'AN@example.com', password: 'secret123' };
      expect(createStaffSchema.validate(validStaff).error).toBeUndefined();
      expect(createStaffSchema.validate({ ...validStaff, password: 'password' }).error).toBeDefined();
      expect(updateRoleSchema.validate({ role: 'admin' }).error).toBeUndefined();
      expect(updateRoleSchema.validate({ role: 'unknown' }).error).toBeDefined();
    });
  });

  describe('getAdminUsers', () => {
    it('forces staff queries to reader accounts and returns pagination metadata', async () => {
      const listQuery = {
        select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: readerId, role: 'reader' }]),
      };
      jest.spyOn(User, 'find').mockReturnValue(listQuery);
      jest.spyOn(User, 'countDocuments').mockResolvedValue(11);

      const result = await userService.getAdminUsers(staff, { role: 'admin', status: 'active', q: 'a.b', page: '2', limit: '5' });

      const [filter] = User.find.mock.calls[0];
      expect(filter.role).toBe('reader');
      expect(filter.status).toBe('active');
      expect(filter.$or[0].code).toEqual(/a\.b/i);
      expect(listQuery.skip).toHaveBeenCalledWith(5);
      expect(listQuery.limit).toHaveBeenCalledWith(5);
      expect(result.meta).toEqual({ page: 2, limit: 5, total: 11, totalPages: 3 });
    });
  });

  describe('permissions and writes', () => {
    it('forbids staff from editing another staff account', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: otherStaffId, role: 'staff' });
      await expect(userService.updateAdminUser(staff, otherStaffId, { firstName: 'Bình' }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows staff to update a reader and audits the changed fields', async () => {
      const reader = { _id: readerId, role: 'reader', save: jest.fn().mockResolvedValue(true), toJSON: () => ({ _id: readerId, firstName: 'An' }) };
      jest.spyOn(User, 'findById').mockResolvedValue(reader);
      await userService.updateAdminUser(staff, readerId, { firstName: 'An' }, { ip: '127.0.0.1' });
      expect(reader.firstName).toBe('An');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.update', ip: '127.0.0.1' }));
    });

    it('prevents self-locking and self-role changes', async () => {
      const findByIdSpy = jest.spyOn(User, 'findById');
      await expect(userService.lockUser(staff, staffId, 'Lý do')).rejects.toMatchObject({ statusCode: 403 });
      await expect(userService.updateUserRole(admin, admin._id, 'staff')).rejects.toMatchObject({ statusCode: 403 });
      expect(findByIdSpy).not.toHaveBeenCalled();
    });

    it('locks a user, revokes refresh tokens, and records the reason', async () => {
      const reader = { _id: readerId, role: 'reader', status: 'active', save: jest.fn().mockResolvedValue(true), toJSON: () => ({ _id: readerId, status: 'locked' }) };
      jest.spyOn(User, 'findById').mockResolvedValue(reader);
      jest.spyOn(RefreshToken, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

      await userService.lockUser(staff, readerId, 'Quá hạn lâu ngày', { ip: '127.0.0.1' });

      expect(reader.status).toBe('locked');
      expect(reader.lockReason).toBe('Quá hạn lâu ngày');
      expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ user: readerId });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.lock', detail: { reason: 'Quá hạn lâu ngày' } }));
    });

    it('limits staff creation and role changes to admin', async () => {
      await expect(userService.createStaff(staff, { email: 'x@example.com', password: 'secret123' }))
        .rejects.toMatchObject({ statusCode: 403 });
      await expect(userService.updateUserRole(staff, readerId, 'staff'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('HTTP authentication', () => {
    it('rejects an existing access token after the account is locked', async () => {
      const token = jwt.sign({ userId: readerId }, config.jwt.accessSecret, { expiresIn: '15m' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: readerId, role: 'reader', status: 'locked', lockReason: 'Quá hạn' });

      const response = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(401);
    });
  });
});
