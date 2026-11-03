const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const config = require('../app/config');
const { Loan, Book, Notification, NotificationRead, RefreshToken } = require('../app/models');
const notifyService = require('../app/services/notify.service');
const reservationService = require('../app/services/reservation.service');
const auditService = require('../app/services/audit.service');
const { jobs } = require('../app/jobs');
const systemRouter = require('../app/routes/system.route');

const app = express();
app.use(express.json());
app.use('/jobs', systemRouter);

const query = (value) => ({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(value) });

describe('BE-32: scheduled jobs and manual endpoint', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    config.jobs.secret = 'test-jobs-secret';
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(auditService, 'log').mockResolvedValue({});
    jest.spyOn(reservationService, 'reserveReturnedCopy').mockResolvedValue(null);
  });

  describe('expirePickup', () => {
    it('restores stock and notifies once when invoked twice', async () => {
      const loan = { _id: 'loan-1', reader: 'reader-1', code: 'LN-1', items: [{ book: 'book-1' }] };
      let status = 'approved';
      jest.spyOn(Loan, 'find').mockReturnValue(query([{ _id: loan._id }]));
      jest.spyOn(Loan, 'findOneAndUpdate').mockImplementation(async () => {
        if (status !== 'approved') return null;
        status = 'expired';
        return loan;
      });
      const updateBook = jest.spyOn(Book, 'updateOne').mockResolvedValue({ matchedCount: 1 });
      jest.spyOn(mongoose, 'startSession').mockResolvedValue({
        withTransaction: async (callback) => callback(),
        endSession: jest.fn().mockResolvedValue(undefined),
      });

      expect(await jobs.expirePickup.run()).toEqual({ expiredCount: 1 });
      expect(await jobs.expirePickup.run()).toEqual({ expiredCount: 0 });
      expect(updateBook).toHaveBeenCalledTimes(1);
      expect(notifyService.notifyUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('markOverdue', () => {
    it('changes borrowing loans once and notifies only on transition', async () => {
      jest.spyOn(Loan, 'find').mockReturnValue(query([{ _id: 'loan-2' }]));
      jest.spyOn(Loan, 'findOneAndUpdate').mockResolvedValueOnce({ _id: 'loan-2', reader: 'reader-1', code: 'LN-2' }).mockResolvedValueOnce(null);
      expect(await jobs.markOverdue.run()).toEqual({ overdueCount: 1 });
      expect(await jobs.markOverdue.run()).toEqual({ overdueCount: 0 });
      expect(notifyService.notifyUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('dueReminder', () => {
    it('creates at most one reminder for a reader on the same day', async () => {
      jest.spyOn(Loan, 'find').mockReturnValue(query([{ _id: 'loan-3', reader: 'reader-1', code: 'LN-3', items: [] }]));
      let created = false;
      jest.spyOn(Notification, 'exists').mockImplementation(async () => created);
      jest.spyOn(notifyService, 'notifyUser').mockImplementation(async (_reader, payload) => {
        created = true;
        expect(payload.jobKey).toContain('dueReminder:reader-1:');
        return {};
      });
      expect(await jobs.dueReminder.run()).toEqual({ reminderCount: 1 });
      expect(await jobs.dueReminder.run()).toEqual({ reminderCount: 0 });
      expect(notifyService.notifyUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('deletes read markers, expired notifications and refresh tokens', async () => {
      jest.spyOn(Notification, 'find').mockReturnValue(query([{ _id: 'notification-1' }]));
      jest.spyOn(NotificationRead, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(Notification, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(RefreshToken, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
      expect(await jobs.cleanup.run()).toEqual({ notificationsDeleted: 1, refreshTokensDeleted: 2 });
      expect(NotificationRead.deleteMany).toHaveBeenCalledWith({ notification: { $in: ['notification-1'] } });
    });
  });

  describe('manual endpoint', () => {
    it('rejects missing and incorrect secrets, then accepts a valid one', async () => {
      jest.spyOn(jobs.cleanup, 'run').mockResolvedValue({ notificationsDeleted: 0, refreshTokensDeleted: 0 });
      await request(app).post('/jobs/cleanup').expect(401);
      await request(app).post('/jobs/cleanup').set('x-jobs-secret', 'wrong').expect(401);
      const response = await request(app).post('/jobs/cleanup').set('x-jobs-secret', 'test-jobs-secret').expect(200);
      expect(response.body.data).toMatchObject({ name: 'cleanup', result: { notificationsDeleted: 0 } });
      expect(jobs.cleanup.run).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for an unknown job with a valid secret', async () => {
      await request(app).post('/jobs/unknown').set('x-jobs-secret', 'test-jobs-secret').expect(404);
    });
  });
});
