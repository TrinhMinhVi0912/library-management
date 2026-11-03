const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const requestHttp = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Loan, RenewalRequest, Reservation, User } = require('../app/models');
const renewalService = require('../app/services/renewal.service');
const settingsService = require('../app/services/settings.service');
const notifyService = require('../app/services/notify.service');
const countersService = require('../app/services/counters.service');
const auditService = require('../app/services/audit.service');
const { adminRenewalsQuerySchema, rejectRenewalSchema } = require('../app/validators/renewal.validator');

const requestId = '507f1f77bcf86cd799439021';
const loanId = '507f1f77bcf86cd799439022';
const bookId = '507f1f77bcf86cd799439023';
const readerId = '507f1f77bcf86cd799439024';
const staffId = '507f1f77bcf86cd799439025';
const adminId = '507f1f77bcf86cd799439026';
const otherReaderId = '507f1f77bcf86cd799439027';

describe('BE-25: Admin renewal decisions', () => {
  let session;
  let item;
  let loan;
  let renewal;

  const queryWithSession = (value) => ({ session: jest.fn().mockResolvedValue(value) });

  beforeEach(() => {
    jest.restoreAllMocks();
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    item = {
      book: { toString: () => bookId },
      status: 'borrowing',
      dueDate: new Date(Date.now() + 3 * 86400000),
      renewCount: 0,
      renewals: [],
    };
    loan = {
      _id: loanId,
      reader: { toString: () => readerId },
      status: 'borrowing',
      items: [item],
      save: jest.fn().mockResolvedValue(true),
    };
    renewal = {
      _id: requestId,
      loan: { toString: () => loanId },
      book: { toString: () => bookId },
      reader: { toString: () => readerId },
      status: 'pending',
      currentDueDate: item.dueDate,
      requestedDueDate: new Date(item.dueDate.getTime() + 7 * 86400000),
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(RenewalRequest, 'findById').mockReturnValue(queryWithSession(renewal));
    jest.spyOn(Loan, 'findById').mockReturnValue(queryWithSession(loan));
    jest.spyOn(Reservation, 'exists').mockReturnValue(queryWithSession(null));
    jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ maxRenewals: 2, renewDays: 7 });
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(notifyService, 'emitRenewalUpdated').mockReturnValue();
    jest.spyOn(notifyService, 'emitLoanUpdated').mockReturnValue();
    jest.spyOn(countersService, 'emitStaffCounters').mockResolvedValue({});
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  describe('Validators', () => {
    it('accepts known renewal filters and defaults pagination', () => {
      const { error, value } = adminRenewalsQuerySchema.validate({ status: 'pending' });
      expect(error).toBeUndefined();
      expect(value).toMatchObject({ status: 'pending', page: 1, limit: 10 });
    });

    it('requires a non-empty rejection reason', () => {
      expect(rejectRenewalSchema.validate({}).error).toBeDefined();
      expect(rejectRenewalSchema.validate({ reason: '  ' }).error).toBeDefined();
      expect(rejectRenewalSchema.validate({ reason: 'Không đủ điều kiện' }).error).toBeUndefined();
    });
  });

  describe('getAdminRenewals', () => {
    it('returns reader, book, due dates, renew count and waiting reservation flag', async () => {
      const book = { _id: bookId, title: 'Sách mẫu' };
      const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{
          _id: requestId,
          reader: { _id: readerId, firstName: 'An' },
          book,
          loan: { _id: loanId, items: [{ book: bookId, dueDate: item.dueDate, renewCount: 1 }] },
          currentDueDate: item.dueDate,
          requestedDueDate: renewal.requestedDueDate,
        }]),
      };
      jest.spyOn(RenewalRequest, 'find').mockReturnValue(query);
      jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(1);
      const reservationQuery = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ book: { toString: () => bookId } }]),
      };
      jest.spyOn(Reservation, 'find').mockReturnValue(reservationQuery);

      const result = await renewalService.getAdminRenewals({ status: 'pending' });

      expect(RenewalRequest.find).toHaveBeenCalledWith({ status: 'pending' });
      expect(result.items[0]).toMatchObject({ renewCount: 1, hasWaitingReservation: true });
      expect(result.items[0].currentDueDate).toEqual(item.dueDate);
      expect(result.items[0].requestedDueDate).toEqual(renewal.requestedDueDate);
      expect(result.items[0].reader.firstName).toBe('An');
      expect(result.items[0].book.title).toBe('Sách mẫu');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('approveRenewal', () => {
    it('extends due date and appends history in the same transaction', async () => {
      const oldDue = new Date(item.dueDate);
      const result = await renewalService.approveRenewal(requestId, staffId, { ip: '127.0.0.1' });

      expect(item.dueDate.getTime()).toBe(oldDue.getTime() + 7 * 86400000);
      expect(item.renewCount).toBe(1);
      expect(item.renewals).toHaveLength(1);
      expect(item.renewals[0]).toMatchObject({ oldDue, newDue: item.dueDate, approvedBy: staffId });
      expect(loan.save).toHaveBeenCalledWith({ session });
      expect(renewal.status).toBe('approved');
      expect(renewal.decidedBy).toBe(staffId);
      expect(renewal.decidedAt).toBeInstanceOf(Date);
      expect(renewal.save).toHaveBeenCalledWith({ session });
      expect(notifyService.notifyUser).toHaveBeenCalledWith(readerId, expect.objectContaining({ type: 'renewal' }));
      expect(notifyService.emitRenewalUpdated).toHaveBeenCalledWith(readerId, requestId, 'approved');
      expect(notifyService.emitLoanUpdated).toHaveBeenCalledWith(readerId, loanId, 'borrowing');
      expect(countersService.emitStaffCounters).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'renewal.approve', ip: '127.0.0.1' }));
      expect(session.endSession).toHaveBeenCalled();
      expect(result).toBe(renewal);
    });

    it('rechecks overdue status when staff approves', async () => {
      item.dueDate = new Date(Date.now() - 1000);

      await expect(renewalService.approveRenewal(requestId, staffId)).rejects.toMatchObject({
        statusCode: 409,
        errorCode: 'RENEW_OVERDUE',
      });
      expect(renewal.save).not.toHaveBeenCalled();
      expect(notifyService.notifyUser).not.toHaveBeenCalled();
    });

    it('rechecks the renewal limit when staff approves', async () => {
      item.renewCount = 2;

      await expect(renewalService.approveRenewal(requestId, staffId)).rejects.toMatchObject({
        statusCode: 409,
        errorCode: 'RENEW_LIMIT_REACHED',
      });
    });

    it('rechecks item status when staff approves', async () => {
      item.status = 'returned';

      await expect(renewalService.approveRenewal(requestId, staffId)).rejects.toMatchObject({
        statusCode: 409,
        errorCode: 'RENEW_ITEM_NOT_BORROWING',
      });
    });

    it('rechecks reservations that appeared after the request', async () => {
      Reservation.exists.mockReturnValue(queryWithSession({ _id: 'reservation-id' }));

      await expect(renewalService.approveRenewal(requestId, staffId)).rejects.toMatchObject({
        statusCode: 409,
        errorCode: 'RENEW_RESERVED',
      });
    });

    it('does not decide a request that is no longer pending', async () => {
      renewal.status = 'cancelled';

      await expect(renewalService.approveRenewal(requestId, staffId)).rejects.toMatchObject({
        statusCode: 409,
        errorCode: 'RENEW_NOT_PENDING',
      });
      expect(loan.save).not.toHaveBeenCalled();
    });
  });

  describe('rejectRenewal', () => {
    it('stores reason and decision metadata, then notifies the reader', async () => {
      const result = await renewalService.rejectRenewal(requestId, staffId, 'Có người đặt trước');

      expect(renewal.status).toBe('rejected');
      expect(renewal.rejectReason).toBe('Có người đặt trước');
      expect(renewal.decidedBy).toBe(staffId);
      expect(renewal.decidedAt).toBeInstanceOf(Date);
      expect(renewal.save).toHaveBeenCalledWith({ session });
      expect(notifyService.notifyUser).toHaveBeenCalledWith(readerId, expect.objectContaining({
        title: expect.stringContaining('từ chối'),
        content: expect.stringContaining('Có người đặt trước'),
      }));
      expect(notifyService.emitRenewalUpdated).toHaveBeenCalledWith(readerId, requestId, 'rejected');
      expect(notifyService.emitLoanUpdated).toHaveBeenCalledWith(readerId, loanId, 'borrowing');
      expect(countersService.emitStaffCounters).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'renewal.reject' }));
      expect(result).toBe(renewal);
    });
  });

  describe('HTTP routes and access control', () => {
    const tokenFor = (userId, role) => jwt.sign({ userId, role, email: `${role}@test.com` }, config.jwt.accessSecret, { expiresIn: '15m' });
    const staffToken = tokenFor(staffId, 'staff');
    const adminToken = tokenFor(adminId, 'admin');
    const readerToken = tokenFor(otherReaderId, 'reader');

    beforeEach(() => {
      jest.spyOn(User, 'findById').mockImplementation((id) => {
        const users = {
          [staffId]: { _id: staffId, role: 'staff', status: 'active' },
          [adminId]: { _id: adminId, role: 'admin', status: 'active' },
          [otherReaderId]: { _id: otherReaderId, role: 'reader', status: 'active' },
        };
        return Promise.resolve(users[id.toString()] || null);
      });
    });

    it('requires staff/admin role to read renewal queue', async () => {
      const noAuth = await requestHttp(app).get('/api/v1/admin/renewals');
      const forbidden = await requestHttp(app).get('/api/v1/admin/renewals').set('Authorization', `Bearer ${readerToken}`);
      expect(noAuth.statusCode).toBe(401);
      expect(forbidden.statusCode).toBe(403);
    });

    it('serves renewal queue to staff', async () => {
      jest.spyOn(renewalService, 'getAdminRenewals').mockResolvedValue({ items: [renewal], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });

      const response = await requestHttp(app).get('/api/v1/admin/renewals?status=pending').set('Authorization', `Bearer ${staffToken}`);

      expect(response.statusCode).toBe(200);
      expect(renewalService.getAdminRenewals).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });

    it('also allows admin to access renewal queue', async () => {
      jest.spyOn(renewalService, 'getAdminRenewals').mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      const response = await requestHttp(app).get('/api/v1/admin/renewals').set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
    });

    it('requires rejection reason and accepts a valid rejection', async () => {
      const invalid = await requestHttp(app).post(`/api/v1/admin/renewals/${requestId}/reject`).set('Authorization', `Bearer ${staffToken}`).send({});
      jest.spyOn(renewalService, 'rejectRenewal').mockResolvedValue({ ...renewal, status: 'rejected' });
      const valid = await requestHttp(app).post(`/api/v1/admin/renewals/${requestId}/reject`).set('Authorization', `Bearer ${staffToken}`).send({ reason: 'Đã hết lượt' });

      expect(invalid.statusCode).toBe(422);
      expect(valid.statusCode).toBe(200);
      expect(renewalService.rejectRenewal).toHaveBeenCalledWith(requestId, staffId, 'Đã hết lượt', expect.any(Object));
    });

    it('allows staff to approve a valid renewal request', async () => {
      jest.spyOn(renewalService, 'approveRenewal').mockResolvedValue({ ...renewal, status: 'approved' });

      const response = await requestHttp(app).post(`/api/v1/admin/renewals/${requestId}/approve`).set('Authorization', `Bearer ${staffToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.status).toBe('approved');
    });
  });
});
