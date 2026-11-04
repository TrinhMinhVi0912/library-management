const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const config = require('../app/config');
const { Fine, User } = require('../app/models');
const fineService = require('../app/services/fine.service');
const notifyService = require('../app/services/notify.service');
const auditService = require('../app/services/audit.service');

const readerId = '507f1f77bcf86cd799439021';
const staffId = '507f1f77bcf86cd799439022';
const fineId = '507f1f77bcf86cd799439023';

describe('BE-36: fines and unpaid balance', () => {
  let session;
  let fine;
  let updateReader;

  beforeEach(() => {
    jest.restoreAllMocks();
    session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn() };
    fine = {
      _id: fineId,
      reader: readerId,
      amount: 7000,
      status: 'unpaid',
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    jest.spyOn(Fine, 'findById').mockReturnValue({ session: jest.fn().mockResolvedValue(fine) });
    updateReader = jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ _id: readerId });
    jest.spyOn(notifyService, 'notifyUser').mockResolvedValue({});
    jest.spyOn(auditService, 'log').mockResolvedValue({});
  });

  it('confirms payment and decrements unpaidFineTotal atomically', async () => {
    const result = await fineService.payFine(fineId, staffId);

    expect(updateReader).toHaveBeenCalledWith(
      { _id: readerId, unpaidFineTotal: { $gte: 7000 } },
      { $inc: { unpaidFineTotal: -7000 } },
      { new: true, session }
    );
    expect(fine.status).toBe('paid');
    expect(fine.paidAt).toBeInstanceOf(Date);
    expect(fine.paidConfirmedBy).toBe(staffId);
    expect(fine.save).toHaveBeenCalledWith({ session });
    expect(notifyService.notifyUser).toHaveBeenCalledWith(readerId, expect.objectContaining({ title: 'Đã xác nhận thu phạt' }));
    expect(result).toBe(fine);
  });

  it('waives an unpaid fine with a reason and decrements the reader balance', async () => {
    const result = await fineService.waiveFine(fineId, staffId, 'Sách bị ghi nhận nhầm', { ip: '127.0.0.1' });

    expect(fine.status).toBe('waived');
    expect(fine.waivedReason).toBe('Sách bị ghi nhận nhầm');
    expect(fine.waivedBy).toBe(staffId);
    expect(fine.waivedAt).toBeInstanceOf(Date);
    expect(updateReader).toHaveBeenCalledWith(
      { _id: readerId, unpaidFineTotal: { $gte: 7000 } },
      { $inc: { unpaidFineTotal: -7000 } },
      { new: true, session }
    );
    expect(notifyService.notifyUser).toHaveBeenCalledWith(readerId, expect.objectContaining({ title: 'Khoản phạt đã được miễn' }));
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'fine.waive', ip: '127.0.0.1' }));
    expect(result).toBe(fine);
  });

  it('rolls back payment when the stored reader balance cannot cover the fine', async () => {
    updateReader.mockResolvedValue(null);

    await expect(fineService.payFine(fineId, staffId)).rejects.toMatchObject({ statusCode: 409 });

    expect(fine.save).not.toHaveBeenCalled();
    expect(notifyService.notifyUser).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it('recalculates unpaidFineTotal from unpaid fine records', async () => {
    const readerQuery = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: readerId, unpaidFineTotal: 9000 }]) };
    jest.spyOn(User, 'find').mockReturnValue(readerQuery);
    jest.spyOn(Fine, 'aggregate').mockResolvedValue([{ _id: readerId, total: 7000 }]);
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    const result = await fineService.recalculateUnpaidFineTotal();

    expect(Fine.aggregate).toHaveBeenCalledWith([
      { $match: { reader: { $in: [readerId] }, status: 'unpaid' } },
      { $group: { _id: '$reader', total: { $sum: '$amount' } } },
    ]);
    expect(update).toHaveBeenCalledWith({ _id: readerId }, { $set: { unpaidFineTotal: 7000 } });
    expect(result).toEqual([{ reader: readerId, previous: 9000, total: 7000 }]);
  });
});

describe('BE-36: waive fine permissions', () => {
  const adminId = '507f1f77bcf86cd799439031';
  const routeFineId = '507f1f77bcf86cd799439032';
  const tokenFor = (userId, role) => jwt.sign({ userId, role }, config.jwt.accessSecret, { expiresIn: '15m' });
  const staffToken = tokenFor(staffId, 'staff');
  const adminToken = tokenFor(adminId, 'admin');

  afterEach(() => jest.restoreAllMocks());

  it('allows only admin to waive a fine', async () => {
    jest.spyOn(User, 'findById').mockImplementation(async (id) => ({
      _id: id,
      role: id.toString() === adminId ? 'admin' : 'staff',
      status: 'active',
    }));
    jest.spyOn(fineService, 'waiveFine').mockResolvedValue({ _id: routeFineId, status: 'waived' });

    const unauthenticated = await request(app).patch(`/api/v1/admin/fines/${routeFineId}/waive`).send({ reason: 'Nhầm lẫn' });
    const staffResponse = await request(app).patch(`/api/v1/admin/fines/${routeFineId}/waive`).set('Authorization', `Bearer ${staffToken}`).send({ reason: 'Nhầm lẫn' });
    const adminResponse = await request(app).patch(`/api/v1/admin/fines/${routeFineId}/waive`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Nhầm lẫn' });

    expect(unauthenticated.statusCode).toBe(401);
    expect(staffResponse.statusCode).toBe(403);
    expect(adminResponse.statusCode).toBe(200);
    expect(fineService.waiveFine).toHaveBeenCalledWith(routeFineId, adminId, 'Nhầm lẫn', expect.any(Object));
  });
});
