const mongoose = require('mongoose');
const { Loan, RenewalRequest, Reservation } = require('../app/models');
const renewalService = require('../app/services/renewal.service');
const settingsService = require('../app/services/settings.service');
const notifyService = require('../app/services/notify.service');
const countersService = require('../app/services/counters.service');

const loanId = '507f1f77bcf86cd799439011';
const bookId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439013';
const requestId = '507f1f77bcf86cd799439014';

describe('BE-24: Renewal requests from readers', () => {
  let session;
  let loan;
  let item;
  let renewal;

  const existsQuery = (value) => ({ session: jest.fn().mockResolvedValue(value) });

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
      dueDate: new Date(Date.now() + 5 * 86400000),
      renewCount: 0,
    };
    loan = { _id: loanId, reader: userId, items: [item] };
    renewal = {
      _id: requestId,
      requestedDueDate: new Date(item.dueDate.getTime() + 7 * 86400000),
      status: 'pending',
    };
    jest.spyOn(Loan, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(loan) });
    jest.spyOn(settingsService, 'getSettings').mockResolvedValue({ maxRenewals: 2, renewDays: 7 });
    jest.spyOn(Reservation, 'exists').mockReturnValue(existsQuery(null));
    jest.spyOn(RenewalRequest, 'exists').mockReturnValue(existsQuery(null));
    jest.spyOn(RenewalRequest, 'create').mockResolvedValue([renewal]);
    jest.spyOn(notifyService, 'notifyStaff').mockResolvedValue({});
    jest.spyOn(countersService, 'emitStaffCounters').mockResolvedValue({});
  });

  it('creates request with current and requested due dates, then notifies staff', async () => {
    const result = await renewalService.requestRenewal(loanId, bookId, userId, 'Đi công tác');

    expect(result).toBe(renewal);
    expect(RenewalRequest.create).toHaveBeenCalledWith([
      expect.objectContaining({
        loan: loanId,
        book: item.book,
        reader: userId,
        currentDueDate: item.dueDate,
        requestedDueDate: new Date(item.dueDate.getTime() + 7 * 86400000),
        reason: 'Đi công tác',
        status: 'pending',
      }),
    ], { session });
    expect(notifyService.notifyStaff).toHaveBeenCalled();
    expect(countersService.emitStaffCounters).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it('returns a clear code when loan is not owned or does not exist', async () => {
    Loan.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

    await expect(renewalService.requestRenewal(loanId, bookId, userId)).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'RENEW_LOAN_NOT_FOUND',
    });
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rejects overdue items with RENEW_OVERDUE', async () => {
    item.dueDate = new Date(Date.now() - 1000);

    await expect(renewalService.requestRenewal(loanId, bookId, userId)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'RENEW_OVERDUE',
    });
  });

  it('rejects when renewal limit has been reached', async () => {
    item.renewCount = 2;

    await expect(renewalService.requestRenewal(loanId, bookId, userId)).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'RENEW_LIMIT_REACHED',
    });
  });

  it('rejects when a waiting reservation exists', async () => {
    Reservation.exists.mockReturnValue(existsQuery({ _id: 'reservation-id' }));

    await expect(renewalService.requestRenewal(loanId, bookId, userId)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'RENEW_RESERVED',
    });
  });

  it('rejects a second pending request with 409', async () => {
    RenewalRequest.exists.mockReturnValue(existsQuery({ _id: requestId }));

    await expect(renewalService.requestRenewal(loanId, bookId, userId)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'RENEW_PENDING',
    });
  });

  it('lists only the reader requests with optional status and pagination', async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([renewal]),
    };
    jest.spyOn(RenewalRequest, 'find').mockReturnValue(query);
    jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(1);

    const result = await renewalService.getMyRenewals(userId, { status: 'pending', page: 2, limit: 5 });

    expect(RenewalRequest.find).toHaveBeenCalledWith({ reader: userId, status: 'pending' });
    expect(query.skip).toHaveBeenCalledWith(5);
    expect(result.items).toEqual([renewal]);
    expect(result.meta).toMatchObject({ page: 2, limit: 5, total: 1 });
  });

  it('cancels only the reader own pending request and emits updates', async () => {
    jest.spyOn(RenewalRequest, 'findOneAndUpdate').mockResolvedValue({ _id: requestId, status: 'cancelled' });
    jest.spyOn(notifyService, 'emitRenewalUpdated').mockReturnValue();

    const result = await renewalService.cancelRenewal(requestId, userId);

    expect(RenewalRequest.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: requestId, reader: userId, status: 'pending' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) }),
      { new: true }
    );
    expect(notifyService.emitRenewalUpdated).toHaveBeenCalledWith(userId, requestId, 'cancelled');
    expect(countersService.emitStaffCounters).toHaveBeenCalled();
    expect(result.status).toBe('cancelled');
  });
});
