const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const { Book, Reservation, Loan } = require('../app/models');
const reservationService = require('../app/services/reservation.service');
const settingsService = require('../app/services/settings.service');
const notifyService = require('../app/services/notify.service');
const auditService = require('../app/services/audit.service');
const expireReservationJob = require('../app/jobs/expireReservation.job');
const {
  reservationBookParamSchema,
  reservationIdParamSchema,
  myReservationsQuerySchema,
} = require('../app/validators/reservation.validator');

const readerId = '507f1f77bcf86cd799439011';
const staffId = '507f1f77bcf86cd799439012';
const bookId = '507f1f77bcf86cd799439013';
const reservationId = '507f1f77bcf86cd799439014';

describe('BE-35: reservations FIFO', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ reservationHoldDays: 3 });
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(auditService, 'log').mockResolvedValue({});
    jest.spyOn(reservationService, 'notifyAvailable').mockResolvedValue({});
  });

  describe('validators and endpoints', () => {
    it('validates ObjectIds, status filters and pagination', () => {
      expect(reservationBookParamSchema.validate({ bookId }).error).toBeUndefined();
      expect(reservationBookParamSchema.validate({ bookId: 'bad' }).error).toBeDefined();
      expect(reservationIdParamSchema.validate({ id: reservationId }).error).toBeUndefined();
      expect(myReservationsQuerySchema.validate({ status: 'waiting', page: '2' }).error).toBeUndefined();
      expect(myReservationsQuerySchema.validate({ status: 'bad' }).error).toBeDefined();
    });

    it('requires reader authentication for reservation endpoints', async () => {
      await request(app).post(`/api/v1/books/${bookId}/reservations`).expect(401);
      await request(app).get('/api/v1/me/reservations').expect(401);
    });
  });

  describe('reservation service', () => {
    it('creates a waiting reservation only when no public copy is available', async () => {
      jest.spyOn(Book, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue({ status: 'active', availableCopies: 0 }) });
      jest.spyOn(Reservation, 'create').mockResolvedValue([{ _id: reservationId, book: bookId, reader: readerId, status: 'waiting' }]);
      const reservation = await reservationService.createReservation(readerId, bookId);
      expect(reservation.status).toBe('waiting');
      expect(Reservation.create).toHaveBeenCalledWith([{ reader: readerId, book: bookId, status: 'waiting' }]);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reservation.create' }));
    });

    it('rejects a reservation while public stock is available', async () => {
      jest.spyOn(Book, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue({ status: 'active', availableCopies: 2 }) });
      const createReservation = jest.spyOn(Reservation, 'create');
      await expect(reservationService.createReservation(readerId, bookId)).rejects.toMatchObject({ statusCode: 409 });
      expect(createReservation).not.toHaveBeenCalled();
    });

    it('keeps the oldest waiting reader first and removes the offered copy from public stock', async () => {
      const offered = { _id: reservationId, book: bookId, reader: readerId, status: 'available' };
      jest.spyOn(Reservation, 'findOneAndUpdate').mockResolvedValue(offered);
      const stockUpdate = jest.spyOn(Book, 'updateOne').mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
      const session = {};
      await expect(reservationService.reserveReturnedCopy(bookId, { now: new Date('2026-11-03T00:00:00Z'), session })).resolves.toBe(offered);
      expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
        { book: bookId, status: 'waiting' },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'available' }) }),
        { new: true, sort: { createdAt: 1, _id: 1 }, session }
      );
      expect(stockUpdate).toHaveBeenCalledWith({ _id: bookId, availableCopies: { $gte: 1 } }, { $inc: { availableCopies: -1 } }, { session });
    });

    it('passes an expired held copy to the next waiter or releases it when the queue is empty', async () => {
      jest.spyOn(Reservation, 'findOneAndUpdate')
        .mockResolvedValueOnce({ _id: 'next-reservation', reader: staffId, book: bookId, status: 'available' })
        .mockResolvedValueOnce(null);
      const updateStock = jest.spyOn(Book, 'updateOne').mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
      const session = {};
      const now = new Date('2026-11-03T00:00:00Z');
      const next = await reservationService.passHeldCopy(bookId, { now, session });
      expect(next.reader).toBe(staffId);
      expect(await reservationService.passHeldCopy(bookId, { now, session })).toBeNull();
      expect(updateStock).toHaveBeenCalledTimes(1);
      expect(updateStock).toHaveBeenCalledWith({ _id: bookId }, { $inc: { availableCopies: 1 } }, { session });
    });

    it('cancels an available reservation and transfers its held copy', async () => {
      const session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn() };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
      const held = { _id: reservationId, reader: readerId, book: bookId, status: 'available', save: jest.fn().mockResolvedValue(true) };
      jest.spyOn(Reservation, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(held) });
      jest.spyOn(Book, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ title: 'Sách đặt trước' }) }),
      });
      const next = { _id: 'next', reader: staffId, book: bookId, status: 'available' };
      jest.spyOn(Reservation, 'findOneAndUpdate').mockResolvedValue(next);
      const result = await reservationService.cancelReservation(reservationId, readerId);
      expect(result.cancelled).toBe(true);
      expect(held.status).toBe('cancelled');
      expect(notifyService.notifyUser).toHaveBeenCalledWith(staffId, expect.objectContaining({ type: 'reservation' }));
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reservation.cancel' }));
      expect(session.endSession).toHaveBeenCalled();
    });
  });

  describe('expireReservation job', () => {
    it('expires the held spot, offers the copy to the next reader and notifies once', async () => {
      const now = new Date('2026-11-03T00:00:00Z');
      const session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn() };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
      const expired = {
        _id: reservationId, reader: readerId, book: bookId, status: 'available',
        holdUntil: new Date('2026-11-02T00:00:00Z'), save: jest.fn().mockResolvedValue(true),
      };
      const findQuery = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: reservationId }]) };
      jest.spyOn(Reservation, 'find').mockReturnValue(findQuery);
      jest.spyOn(Reservation, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValueOnce(expired).mockResolvedValueOnce(null) });
      jest.spyOn(Loan, 'exists').mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      const offered = { _id: 'next-reservation', reader: staffId, book: bookId, status: 'available' };
      jest.spyOn(reservationService, 'passHeldCopy').mockResolvedValue(offered);

      const result = await expireReservationJob.run({ now });
      expect(result).toEqual({ expiredCount: 1, offeredCount: 1 });
      expect(expired.status).toBe('expired');
      expect(reservationService.passHeldCopy).toHaveBeenCalledWith(bookId, { now, session });
      expect(reservationService.notifyAvailable).toHaveBeenCalledWith(offered);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'reservation.expire' }));
    });
  });
});
