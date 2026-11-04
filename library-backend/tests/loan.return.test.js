const mongoose = require('mongoose');
const { Loan, Book, User, RenewalRequest } = require('../app/models');
const loanService = require('../app/services/loan.service');
const reservationService = require('../app/services/reservation.service');
const fineService = require('../app/services/fine.service');
const settingsService = require('../app/services/settings.service');
const notifyService = require('../app/services/notify.service');
const auditService = require('../app/services/audit.service');

const loanId = '507f1f77bcf86cd799439011';
const readerId = '507f1f77bcf86cd799439012';
const staffId = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439014';

describe('BE-36: return loan business rules', () => {
  let session;
  let loan;
  let reader;
  let book;
  let stockUpdate;
  let createFine;

  beforeEach(() => {
    jest.restoreAllMocks();
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    loan = {
      _id: loanId,
      reader: readerId,
      status: 'borrowing',
      code: 'PM000001',
      items: [{ book: bookId, titleSnapshot: 'Sách kiểm thử', priceSnapshot: 100000, status: 'borrowing', dueDate: new Date(Date.now() + 86400000) }],
      save: jest.fn().mockResolvedValue(true),
    };
    reader = { _id: readerId, unpaidFineTotal: 0, save: jest.fn().mockResolvedValue(true) };
    book = { _id: bookId, title: 'Sách kiểm thử' };

    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    jest.spyOn(Loan, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(loan) });
    jest.spyOn(User, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(reader) });
    jest.spyOn(Book, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(book) });
    stockUpdate = jest.spyOn(Book, 'updateOne').mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const renewalQuery = { select: jest.fn().mockReturnThis(), session: jest.fn().mockResolvedValue([]) };
    jest.spyOn(RenewalRequest, 'find').mockReturnValue(renewalQuery);
    jest.spyOn(RenewalRequest, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
    jest.spyOn(settingsService, 'getSettings').mockResolvedValue({
      lateFeePerDay: 2000,
      lostBookFeeRate: 1,
      lostBookProcessingFee: 20000,
    });
    jest.spyOn(reservationService, 'reserveReturnedCopy').mockResolvedValue(null);
    createFine = jest.spyOn(fineService, 'createFine').mockImplementation(async (data) => ({ ...data, _id: `fine-${data.type}` }));
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(notifyService, 'emitLoanUpdated').mockReturnValue();
    jest.spyOn(notifyService, 'emitRenewalUpdated').mockReturnValue();
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  it('returns a good copy to stock and closes the loan', async () => {
    const result = await loanService.returnItems(loanId, [{ bookId, condition: 'good' }], staffId);

    expect(stockUpdate).toHaveBeenCalledWith({ _id: bookId }, { $inc: { availableCopies: 1 } }, { session });
    expect(reservationService.reserveReturnedCopy).toHaveBeenCalledWith(bookId, { now: expect.any(Date), session });
    expect(createFine).not.toHaveBeenCalled();
    expect(result.loan.status).toBe('returned');
    expect(result.loan.closedAt).toBeInstanceOf(Date);
  });

  it('records late and damaged fines and adds the returned copy back to stock', async () => {
    loan.items[0].dueDate = new Date(Date.now() - 3 * 86400000);

    const result = await loanService.returnItems(loanId, [{ bookId, condition: 'damaged', fineAmount: 5000 }], staffId);

    expect(createFine).toHaveBeenCalledTimes(2);
    expect(createFine).toHaveBeenCalledWith(expect.objectContaining({ type: 'late', amount: expect.any(Number), daysLate: expect.any(Number) }), { session });
    expect(createFine).toHaveBeenCalledWith(expect.objectContaining({ type: 'damaged', amount: 5000 }), { session });
    expect(reader.unpaidFineTotal).toBeGreaterThan(0);
    expect(reader.save).toHaveBeenCalledWith({ session });
    expect(stockUpdate).toHaveBeenCalledWith({ _id: bookId }, { $inc: { availableCopies: 1 } }, { session });
    expect(result.fines).toHaveLength(2);
  });

  it('records lost book fine and reduces total copies without returning public stock', async () => {
    const result = await loanService.returnItems(loanId, [{ bookId, condition: 'lost' }], staffId);

    expect(createFine).toHaveBeenCalledWith(expect.objectContaining({ type: 'lost', amount: 120000 }), { session });
    expect(stockUpdate).toHaveBeenCalledWith({ _id: bookId, totalCopies: { $gt: 0 } }, { $inc: { totalCopies: -1 } }, { session });
    expect(reservationService.reserveReturnedCopy).not.toHaveBeenCalled();
    expect(result.loan.status).toBe('returned');
  });

  it('keeps the loan open when only one item in a multi-book loan is returned', async () => {
    const secondBookId = '507f1f77bcf86cd799439015';
    loan.items.push({ book: secondBookId, titleSnapshot: 'Sách còn mượn', priceSnapshot: 50000, status: 'borrowing' });

    const result = await loanService.returnItems(loanId, [{ bookId, condition: 'good' }], staffId);

    expect(result.loan.items[0].status).toBe('returned');
    expect(result.loan.items[1].status).toBe('borrowing');
    expect(result.loan.status).toBe('borrowing');
    expect(result.loan.closedAt).toBeUndefined();
  });
});
