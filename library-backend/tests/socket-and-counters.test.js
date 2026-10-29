const jwt = require('jsonwebtoken');
const config = require('../app/config');
const { User, Loan, RenewalRequest } = require('../app/models');
const notifyService = require('../app/services/notify.service');
const countersService = require('../app/services/counters.service');
const counterController = require('../app/controllers/counter.controller');
const { authMiddleware, handleConnection } = require('../app/sockets');

describe('BE-18: Socket.IO & Counters Service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('counters.service', () => {
    test('getCounters trả về đúng số lượng pendingLoans và pendingRenewals', async () => {
      jest.spyOn(Loan, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(2);

      const counters = await countersService.getCounters();

      expect(counters).toEqual({
        pendingLoans: 3,
        pendingRenewals: 2,
      });
      expect(Loan.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
      expect(RenewalRequest.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
    });

    test('emitStaffCounters phát sự kiện staff:counters qua notifyService', async () => {
      jest.spyOn(Loan, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(1);

      const mockIO = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      notifyService.setIO(mockIO);

      const result = await countersService.emitStaffCounters();

      expect(result).toEqual({ pendingLoans: 5, pendingRenewals: 1 });
      expect(mockIO.to).toHaveBeenCalledWith('role:staff');
      expect(mockIO.emit).toHaveBeenCalledWith('staff:counters', {
        pendingLoans: 5,
        pendingRenewals: 1,
      });
    });

    test('counterController.getCounters trả về phản hồi chuẩn', async () => {
      jest.spyOn(Loan, 'countDocuments').mockResolvedValue(4);
      jest.spyOn(RenewalRequest, 'countDocuments').mockResolvedValue(2);

      const req = {};
      const res = {
        statusCode: 200,
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

      await counterController.getCounters(req, res, next);

      expect(res.jsonData).toEqual({
        success: true,
        data: {
          pendingLoans: 4,
          pendingRenewals: 2,
        },
      });
    });
  });

  describe('Socket.IO authMiddleware & handleConnection', () => {
    const mockUserId = '507f1f77bcf86cd799439011';

    test('Từ chối khi không có token trong auth', async () => {
      const socket = {
        handshake: { auth: {} },
      };
      const next = jest.fn();

      await authMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Chưa cung cấp mã xác thực');
    });

    test('Từ chối khi token không hợp lệ', async () => {
      const socket = {
        handshake: { auth: { token: 'invalid_token' } },
      };
      const next = jest.fn();

      await authMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Mã xác thực không hợp lệ');
    });

    test('Từ chối khi token đã hết hạn', async () => {
      const expiredToken = jwt.sign(
        { id: mockUserId, role: 'reader' },
        config.jwt.accessSecret,
        { expiresIn: '-1s' }
      );
      const socket = {
        handshake: { auth: { token: expiredToken } },
      };
      const next = jest.fn();

      await authMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Mã xác thực đã hết hạn');
    });

    test('Từ chối khi tài khoản đã bị khóa', async () => {
      const validToken = jwt.sign(
        { id: mockUserId, role: 'reader' },
        config.jwt.accessSecret,
        { expiresIn: '1h' }
      );
      const socket = {
        handshake: { auth: { token: validToken } },
      };
      const next = jest.fn();

      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        status: 'locked',
        lockReason: 'Vi phạm quy định',
      });

      await authMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('Tài khoản đã bị khóa');
    });

    test('Xác thực thành công và gán user vào socket', async () => {
      const validToken = jwt.sign(
        { id: mockUserId, role: 'reader' },
        config.jwt.accessSecret,
        { expiresIn: '1h' }
      );
      const socket = {
        handshake: { auth: { token: validToken } },
      };
      const next = jest.fn();

      const mockUser = {
        _id: mockUserId,
        role: 'reader',
        status: 'active',
      };
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      await authMiddleware(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.user).toBe(mockUser);
    });

    test('handleConnection: reader tham gia all, user:<id>, role:reader', () => {
      const joinedRooms = [];
      const socket = {
        user: {
          _id: mockUserId,
          role: 'reader',
        },
        join: jest.fn((room) => joinedRooms.push(room)),
        on: jest.fn(),
      };

      handleConnection(socket);

      expect(joinedRooms).toContain('all');
      expect(joinedRooms).toContain(`user:${mockUserId}`);
      expect(joinedRooms).toContain('role:reader');
      expect(joinedRooms).not.toContain('role:staff');
    });

    test('handleConnection: staff/admin tham gia all, user:<id>, role:staff', () => {
      const joinedRooms = [];
      const socket = {
        user: {
          _id: mockUserId,
          role: 'staff',
        },
        join: jest.fn((room) => joinedRooms.push(room)),
        on: jest.fn(),
      };

      handleConnection(socket);

      expect(joinedRooms).toContain('all');
      expect(joinedRooms).toContain(`user:${mockUserId}`);
      expect(joinedRooms).toContain('role:staff');
      expect(joinedRooms).not.toContain('role:reader');
    });
  });

  describe('notify.service emit helpers', () => {
    test('emitLoanUpdated và emitRenewalUpdated gọi emit tới đúng room user', () => {
      const mockIO = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      notifyService.setIO(mockIO);

      notifyService.emitLoanUpdated('user123', 'loan456', 'approved');
      expect(mockIO.to).toHaveBeenCalledWith('user:user123');
      expect(mockIO.emit).toHaveBeenCalledWith('loan:updated', {
        loanId: 'loan456',
        status: 'approved',
      });

      notifyService.emitRenewalUpdated('user123', 'req789', 'approved');
      expect(mockIO.to).toHaveBeenCalledWith('user:user123');
      expect(mockIO.emit).toHaveBeenCalledWith('renewal:updated', {
        requestId: 'req789',
        status: 'approved',
      });
    });
  });
});
