const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Setting, AuditLog, User } = require('../app/models');
const settingsService = require('../app/services/settings.service');
const auditService = require('../app/services/audit.service');
const { settingsUpdateSchema, auditLogsQuerySchema } = require('../app/validators/settings.validator');

const adminId = '507f1f77bcf86cd799439021';
const staffId = '507f1f77bcf86cd799439022';

describe('BE-29: Settings and audit logs', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    settingsService.invalidate();
  });

  describe('validators', () => {
    it('accepts supported setting values and rejects empty or invalid updates', () => {
      expect(settingsUpdateSchema.validate({ loanDays: 21, lateFeePerDay: 0 }).error).toBeUndefined();
      expect(settingsUpdateSchema.validate({}).error).toBeDefined();
      expect(settingsUpdateSchema.validate({ loanDays: 0 }).error).toBeDefined();
      expect(settingsUpdateSchema.validate({ unknownSetting: 1 }).error).toBeDefined();
    });

    it('validates audit filters and pagination defaults', () => {
      const { error, value } = auditLogsQuerySchema.validate({ actor: staffId, action: 'loan.return', from: '2026-01-01' });
      expect(error).toBeUndefined();
      expect(value).toMatchObject({ actor: staffId, action: 'loan.return', page: 1, limit: 10 });
      expect(value.from).toBeInstanceOf(Date);
      expect(auditLogsQuerySchema.validate({ actor: 'bad-id' }).error).toBeDefined();
    });
  });

  describe('settings service', () => {
    it('updates settings, invalidates cache and records an audit entry', async () => {
      const setting = { _id: 'setting-id', loanDays: 14, save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(Setting, 'findOne').mockResolvedValue(setting);
      jest.spyOn(auditService, 'log').mockResolvedValue({});

      const updated = await settingsService.updateSettings({ loanDays: 21 }, { actor: adminId, ip: '127.0.0.1' });
      expect(updated.loanDays).toBe(21);
      expect(setting.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        actor: adminId, action: 'settings.update', detail: { fields: ['loanDays'] }, ip: '127.0.0.1',
      }));

      await settingsService.getSettings();
      await settingsService.getSettings();
      expect(Setting.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('audit log service', () => {
    it('filters by actor, action, and date range with pagination', async () => {
      const listQuery = {
        populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ action: 'loan.return' }]),
      };
      jest.spyOn(AuditLog, 'find').mockReturnValue(listQuery);
      jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(12);
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-31T00:00:00.000Z');

      const result = await auditService.getAuditLogs({ actor: staffId, action: 'loan.return', from, to, page: 2, limit: 5 });

      expect(AuditLog.find).toHaveBeenCalledWith({ actor: staffId, action: 'loan.return', createdAt: { $gte: from, $lte: to } });
      expect(listQuery.skip).toHaveBeenCalledWith(5);
      expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    });
  });

  describe('admin routes', () => {
    const tokenFor = (userId, role) => jwt.sign({ userId, role }, config.jwt.accessSecret, { expiresIn: '15m' });
    const adminToken = tokenFor(adminId, 'admin');
    const staffToken = tokenFor(staffId, 'staff');

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => Promise.resolve({
        _id: id,
        role: id.toString() === adminId ? 'admin' : 'staff',
        status: 'active',
      }));
    });

    it('restricts settings updates to admins and validates input', async () => {
      jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ loanDays: 14 });
      jest.spyOn(settingsService, 'updateSettings').mockResolvedValue({ loanDays: 21 });
      const staffResponse = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${staffToken}`);
      const invalidAdminResponse = await request(app).put('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`).send({ loanDays: 0 });
      const adminResponse = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`);
      const validUpdateResponse = await request(app).put('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`).send({ loanDays: 21 });

      expect(staffResponse.statusCode).toBe(403);
      expect(invalidAdminResponse.statusCode).toBe(422);
      expect(adminResponse.statusCode).toBe(200);
      expect(validUpdateResponse.statusCode).toBe(200);
      expect(settingsService.updateSettings).toHaveBeenCalledWith({ loanDays: 21 }, expect.objectContaining({ actor: adminId }));
      expect(settingsService.getSettings).toHaveBeenCalledTimes(1);
    });

    it('serves paginated audit logs to admin only', async () => {
      jest.spyOn(auditService, 'getAuditLogs').mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      const staffResponse = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', `Bearer ${staffToken}`);
      const adminResponse = await request(app).get('/api/v1/admin/audit-logs?action=loan.return').set('Authorization', `Bearer ${adminToken}`);

      expect(staffResponse.statusCode).toBe(403);
      expect(adminResponse.statusCode).toBe(200);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith({ action: 'loan.return' });
    });
  });
});
