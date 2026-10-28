const jwt = require('jsonwebtoken');
const Joi = require('joi');
const mongoose = require('mongoose');

const config = require('../app/config');
const { User } = require('../app/models');
const {
  auth,
  requireRole,
  validate,
  authLimiter,
  forumPostLimiter,
  generalLimiter,
} = require('../app/middlewares');

describe('Middlewares Unit Test Suite', () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();

  const createToken = (payload, options = {}) => {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: '15m',
      ...options,
    });
  };

  const createMockReqRes = (overrides = {}) => {
    const req = {
      headers: {},
      body: {},
      query: {},
      params: {},
      ...overrides,
    };
    const res = {
      statusCode: 200,
      jsonData: null,
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
    return { req, res, next };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('auth middleware', () => {
    it('phải quăng ApiError 401 khi không có Authorization header', async () => {
      const { req, res, next } = createMockReqRes();
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/mã xác thực/i);
    });

    it('phải quăng ApiError 401 khi header không bắt đầu bằng Bearer', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Basic 123456' },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('phải quăng ApiError 401 khi Bearer token rỗng', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Bearer ' },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('phải quăng ApiError 401 khi token sai chữ ký hoặc format rác', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Bearer invalid.token.payload' },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/không hợp lệ/i);
    });

    it('phải quăng ApiError 401 khi token đã hết hạn', async () => {
      const expiredToken = createToken({ id: mockUserId }, { expiresIn: '-1s' });
      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/hết hạn/i);
    });

    it('phải quăng ApiError 401 khi user không tồn tại trong hệ thống', async () => {
      const token = createToken({ id: mockUserId });
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/không tồn tại/i);
    });

    it('phải quăng ApiError 401 khi user bị khóa (status !== "active")', async () => {
      const token = createToken({ id: mockUserId });
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: mockUserId,
        role: 'reader',
        status: 'locked',
        lockReason: 'Vi phạm quy định nhiều lần',
      });

      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Tài khoản đã bị khóa');
      expect(error.message).toContain('Vi phạm quy định nhiều lần');
    });

    it('phải nạp req.user và gọi next() thành công khi token hợp lệ và user active', async () => {
      const token = createToken({ id: mockUserId });
      const fakeUser = {
        _id: mockUserId,
        role: 'reader',
        status: 'active',
      };
      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await auth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // Không có đối số lỗi
      expect(req.user).toBe(fakeUser);
    });
  });

  describe('optionalAuth middleware', () => {
    it('phải để req.user = null và next() khi không gửi token', async () => {
      const { req, res, next } = createMockReqRes();
      await auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });

    it('phải để req.user = null và next() khi gửi token không hợp lệ', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: 'Bearer bad_token' },
      });
      await auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });

    it('phải nạp req.user khi gửi token hợp lệ', async () => {
      const token = createToken({ id: mockUserId });
      const fakeUser = {
        _id: mockUserId,
        status: 'active',
      };
      jest.spyOn(User, 'findById').mockResolvedValue(fakeUser);

      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(fakeUser);
    });
  });

  describe('requireRole middleware', () => {
    it('phải trả về 401 nếu chưa có req.user', () => {
      const middleware = requireRole('admin');
      const { req, res, next } = createMockReqRes(); // req.user undefined

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toMatch(/Chưa xác thực người dùng/i);
    });

    it('phải trả về 403 nếu vai trò không khớp (reader vào admin)', () => {
      const middleware = requireRole('admin');
      const { req, res, next } = createMockReqRes({
        user: { role: 'reader' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/không có quyền/i);
    });

    it('phải gọi next() khi vai trò khớp chính xác', () => {
      const middleware = requireRole('admin');
      const { req, res, next } = createMockReqRes({
        user: { role: 'admin' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('phải gọi next() khi vai trò thuộc danh sách cho phép (staff trong [staff, admin])', () => {
      const middleware = requireRole('staff', 'admin');
      const { req, res, next } = createMockReqRes({
        user: { role: 'staff' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('phải hỗ trợ truyền mảng vai trò requireRole(["staff", "admin"])', () => {
      const middleware = requireRole(['staff', 'admin']);
      const { req, res, next } = createMockReqRes({
        user: { role: 'admin' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validate middleware', () => {
    const userSchema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().min(18).required(),
      email: Joi.string().email().optional(),
    });

    it('phải trả về 422 kèm mảng errors khi body thiếu/sai trường', () => {
      const middleware = validate(userSchema, 'body');
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Nguyen Van A',
          age: 15,
        },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Dữ liệu không hợp lệ');
      expect(Array.isArray(error.errors)).toBe(true);
      expect(error.errors[0].field).toBe('age');
    });

    it('phải gọi next() và loại bỏ trường lạ (stripUnknown) khi body hợp lệ', () => {
      const middleware = validate(userSchema, 'body');
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Nguyen Van B',
          age: 20,
          email: 'b@example.com',
          unknownField: 'bad_data',
        },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.name).toBe('Nguyen Van B');
      expect(req.body.age).toBe(20);
      expect(req.body.unknownField).toBeUndefined();
    });

    it('phải hỗ trợ validate schema cho query', () => {
      const querySchema = Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(100).default(10),
      });

      const middleware = validate(querySchema, 'query');
      const { req, res, next } = createMockReqRes({
        query: { page: '2', limit: '20' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.query.page).toBe(2);
      expect(req.query.limit).toBe(20);
    });

    it('phải hỗ trợ validate multi-source { body, query } và gom lỗi', () => {
      const multiSchema = {
        query: Joi.object({
          page: Joi.number().required(),
        }),
        body: Joi.object({
          title: Joi.string().required(),
        }),
      };

      const middleware = validate(multiSchema);
      const { req, res, next } = createMockReqRes({
        query: { page: 'abc' },
        body: {},
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(422);
      expect(error.errors.length).toBeGreaterThanOrEqual(2);
      const fields = error.errors.map((e) => e.field);
      expect(fields).toContain('page');
      expect(fields).toContain('title');
    });
  });

  describe('rateLimit middleware', () => {
    it('phải cấu hình đầy đủ generalLimiter, authLimiter, forumPostLimiter', () => {
      expect(typeof generalLimiter).toBe('function');
      expect(typeof authLimiter).toBe('function');
      expect(typeof forumPostLimiter).toBe('function');
    });
  });
});
