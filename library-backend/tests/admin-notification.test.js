const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Notification, NotificationRead, User } = require('../app/models');
const notifyService = require('../app/services/notify.service');
const auditService = require('../app/services/audit.service');
const {
  adminNotificationsQuerySchema,
  createAdminNotificationSchema,
  updateAdminNotificationSchema,
} = require('../app/validators/admin-notification.validator');

const adminId = '507f1f77bcf86cd799439021';
const readerId = '507f1f77bcf86cd799439022';
const notificationId = '507f1f77bcf86cd799439023';

describe('BE-30: Admin notifications', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    notifyService.setIO(null);
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  afterEach(() => notifyService.setIO(null));

  describe('validators', () => {
    it('validates group and personal notification targets', () => {
      const group = { audience: 'all', type: 'system', title: 'Thông báo', content: 'Nội dung' };
      const personal = { ...group, audience: 'user', recipient: readerId };
      expect(createAdminNotificationSchema.validate(group).error).toBeUndefined();
      expect(createAdminNotificationSchema.validate(personal).error).toBeUndefined();
      expect(createAdminNotificationSchema.validate({ ...personal, recipient: 'bad-id' }).error).toBeDefined();
      expect(createAdminNotificationSchema.validate({ ...group, audience: 'unknown' }).error).toBeDefined();
    });

    it('validates filters, expiration, and non-empty updates', () => {
      expect(adminNotificationsQuerySchema.validate({ audience: 'readers', type: 'system' }).error).toBeUndefined();
      expect(updateAdminNotificationSchema.validate({ expiresAt: 'not-a-date' }).error).toBeDefined();
      expect(updateAdminNotificationSchema.validate({}).error).toBeDefined();
      expect(updateAdminNotificationSchema.validate({ title: 'Sửa tiêu đề' }).error).toBeUndefined();
    });
  });

  describe('notify service CRUD', () => {
    it('lists notifications with filters and pagination and reads a notification by id', async () => {
      const listQuery = {
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: notificationId }]),
      };
      jest.spyOn(Notification, 'find').mockReturnValue(listQuery);
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      const result = await notifyService.getAdminNotifications({ audience: 'all', q: 'a.b', page: 2, limit: 5 });
      expect(Notification.find).toHaveBeenCalledWith({ audience: 'all', $or: [{ title: /a\.b/i }, { content: /a\.b/i }] });
      expect(listQuery.skip).toHaveBeenCalledWith(5);
      expect(result.meta.total).toBe(1);

      const detailQuery = { lean: jest.fn().mockResolvedValue({ _id: notificationId }) };
      jest.spyOn(Notification, 'findById').mockReturnValue(detailQuery);
      await expect(notifyService.getAdminNotificationById(notificationId)).resolves.toMatchObject({ _id: notificationId });
    });

    it('creates a group notification, emits to its room, and audits the write', async () => {
      const notification = {
        _id: notificationId, audience: 'all', type: 'system', title: 'Thông báo',
        content: 'Nội dung', createdAt: new Date(), expiresAt: new Date(Date.now() + 60000),
      };
      jest.spyOn(Notification, 'create').mockResolvedValue(notification);
      const socket = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      notifyService.setIO(socket);

      const created = await notifyService.createAdminNotification(
        { audience: 'all', type: 'system', title: 'Thông báo', content: 'Nội dung' },
        { _id: adminId },
        { ip: '127.0.0.1' }
      );

      expect(created).toBe(notification);
      expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ audience: 'all', recipient: null, createdBy: adminId }));
      expect(socket.to).toHaveBeenCalledWith('all');
      expect(socket.emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({ _id: notificationId }));
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'notification.create', ip: '127.0.0.1' }));
    });

    it('creates personal notifications in the recipient room', async () => {
      const notification = { _id: notificationId, audience: 'user', recipient: readerId, type: 'system', title: 'Riêng', content: 'Nội dung' };
      jest.spyOn(Notification, 'create').mockResolvedValue(notification);
      const socket = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      notifyService.setIO(socket);

      await notifyService.createAdminNotification(
        { audience: 'user', recipient: readerId, type: 'system', title: 'Riêng', content: 'Nội dung' },
        { _id: adminId }
      );

      expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ audience: 'user', recipient: readerId }));
      expect(socket.to).toHaveBeenCalledWith(`user:${readerId}`);
    });

    it('includes all-audience notifications in reader listings and excludes expired items', async () => {
      const notification = { _id: notificationId, toString: () => notificationId, audience: 'all' };
      const notificationQuery = {
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([notification]),
      };
      const readQuery = { lean: jest.fn().mockResolvedValue([]) };
      jest.spyOn(Notification, 'find').mockReturnValue(notificationQuery);
      jest.spyOn(Notification, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(NotificationRead, 'find').mockReturnValue(readQuery);

      const result = await notifyService.getNotifications(readerId, 'reader');

      const filter = Notification.find.mock.calls[0][0];
      expect(filter.$and[0].$or).toContainEqual({ audience: { $in: ['all', 'readers'] } });
      expect(filter.$and[1].$or).toContainEqual({ expiresAt: { $gt: expect.any(Date) } });
      expect(result.notifications).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('updates, audits, and re-emits notifications', async () => {
      const notification = {
        _id: notificationId, audience: 'all', recipient: null, type: 'system', title: 'Cũ', content: 'Nội dung',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Notification, 'findById').mockResolvedValue(notification);
      const socket = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      notifyService.setIO(socket);

      await notifyService.updateAdminNotification(notificationId, { title: 'Mới' }, { _id: adminId });

      expect(notification.title).toBe('Mới');
      expect(notification.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'notification.update' }));
      expect(socket.to).toHaveBeenCalledWith('all');
      expect(socket.emit).toHaveBeenCalledWith('notification:updated', expect.objectContaining({ title: 'Mới' }));
    });

    it('deletes related read markers and audits deletion', async () => {
      jest.spyOn(Notification, 'findById').mockResolvedValue({
        _id: notificationId, audience: 'readers', recipient: null, type: 'system',
      });
      jest.spyOn(NotificationRead, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
      jest.spyOn(Notification, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      await notifyService.deleteAdminNotification(notificationId, { _id: adminId });

      expect(NotificationRead.deleteMany).toHaveBeenCalledWith({ notification: notificationId });
      expect(Notification.deleteOne).toHaveBeenCalledWith({ _id: notificationId });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'notification.delete' }));
    });
  });

  describe('admin routes', () => {
    const tokenFor = (userId, role) => jwt.sign({ userId, role }, config.jwt.accessSecret, { expiresIn: '15m' });
    const adminToken = tokenFor(adminId, 'admin');
    const readerToken = tokenFor(readerId, 'reader');

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => Promise.resolve({
        _id: id,
        role: id.toString() === adminId ? 'admin' : 'reader',
        status: 'active',
      }));
    });

    it('requires staff/admin authentication and validates create payloads', async () => {
      const noAuth = await request(app).get('/api/v1/admin/notifications');
      const readerForbidden = await request(app).get('/api/v1/admin/notifications').set('Authorization', `Bearer ${readerToken}`);
      const invalid = await request(app).post('/api/v1/admin/notifications').set('Authorization', `Bearer ${adminToken}`).send({ audience: 'all' });
      jest.spyOn(notifyService, 'createAdminNotification').mockResolvedValue({ _id: notificationId });
      const valid = await request(app).post('/api/v1/admin/notifications').set('Authorization', `Bearer ${adminToken}`).send({
        audience: 'all', type: 'system', title: 'Thông báo', content: 'Nội dung',
      });

      expect(noAuth.statusCode).toBe(401);
      expect(readerForbidden.statusCode).toBe(403);
      expect(invalid.statusCode).toBe(422);
      expect(valid.statusCode).toBe(201);
      expect(notifyService.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ audience: 'all' }), expect.any(Object), expect.any(Object));
    });

    it('routes list, detail, update, and delete operations', async () => {
      jest.spyOn(notifyService, 'getAdminNotifications').mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      jest.spyOn(notifyService, 'getAdminNotificationById').mockResolvedValue({ _id: notificationId });
      jest.spyOn(notifyService, 'updateAdminNotification').mockResolvedValue({ _id: notificationId, title: 'Mới' });
      jest.spyOn(notifyService, 'deleteAdminNotification').mockResolvedValue({ success: true });

      const list = await request(app).get('/api/v1/admin/notifications?type=system').set('Authorization', `Bearer ${adminToken}`);
      const detail = await request(app).get(`/api/v1/admin/notifications/${notificationId}`).set('Authorization', `Bearer ${adminToken}`);
      const update = await request(app).patch(`/api/v1/admin/notifications/${notificationId}`).set('Authorization', `Bearer ${adminToken}`).send({ title: 'Mới' });
      const deleted = await request(app).delete(`/api/v1/admin/notifications/${notificationId}`).set('Authorization', `Bearer ${adminToken}`);

      expect(list.statusCode).toBe(200);
      expect(detail.statusCode).toBe(200);
      expect(update.statusCode).toBe(200);
      expect(deleted.statusCode).toBe(200);
      expect(notifyService.getAdminNotifications).toHaveBeenCalledWith({ type: 'system' });
      expect(notifyService.updateAdminNotification).toHaveBeenCalledWith(notificationId, { title: 'Mới' }, expect.any(Object), expect.any(Object));
      expect(notifyService.deleteAdminNotification).toHaveBeenCalledWith(notificationId, expect.any(Object), expect.any(Object));
    });
  });
});
