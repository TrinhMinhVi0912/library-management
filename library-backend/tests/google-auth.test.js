const crypto = require('crypto');
const https = require('https');
const { EventEmitter } = require('events');
const jwt = require('jsonwebtoken');
const config = require('../app/config');
const { User, RefreshToken, Counter, Shelf } = require('../app/models');
const authService = require('../app/services/auth.service');
const authController = require('../app/controllers/auth.controller');
const googleTokenUtil = require('../app/utils/google-token.util');
const { googleLoginSchema } = require('../app/validators/auth.validator');

describe('BE-39: Google authentication', () => {
  afterEach(() => jest.restoreAllMocks());

  const verifiedIdentity = {
    sub: 'google-sub-123',
    email: 'reader@example.com',
    email_verified: true,
    given_name: 'Reader',
    family_name: 'Example',
  };

  const createReader = (overrides = {}) => ({
    _id: 'reader-id',
    code: 'DG000001',
    email: 'reader@example.com',
    googleId: verifiedIdentity.sub,
    role: 'reader',
    status: 'active',
    lastLoginAt: null,
    save: jest.fn().mockResolvedValue(true),
    toJSON: jest.fn(() => ({ _id: 'reader-id', email: 'reader@example.com', role: 'reader' })),
    ...overrides,
  });

  it('validates the ID token input and rejects a missing credential', () => {
    expect(googleLoginSchema.validate({ idToken: 'signed-google-id-token' }).error).toBeUndefined();
    expect(googleLoginSchema.validate({}).error).toBeDefined();
    expect(googleLoginSchema.validate({ idToken: 'x'.repeat(8193) }).error).toBeDefined();
  });

  it('never exposes the linked Google subject in serialized user data', () => {
    const user = new User({
      code: 'DG000001',
      email: 'reader@example.com',
      passwordHash: 'private-hash',
      googleId: verifiedIdentity.sub,
      firstName: 'Reader',
      lastName: 'Example',
    });

    expect(user.toJSON()).not.toHaveProperty('googleId');
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });

  it('creates a reader account and session for a verified new Google identity', async () => {
    const createdReader = createReader();
    jest.spyOn(googleTokenUtil, 'verifyGoogleIdToken').mockResolvedValue(verifiedIdentity);
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockResolvedValue(createdReader);
    jest.spyOn(Counter, 'findOneAndUpdate').mockResolvedValue({ _id: 'user', seq: 1 });
    const existingShelves = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    const allShelves = { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    jest.spyOn(Shelf, 'find').mockReturnValueOnce(existingShelves).mockReturnValueOnce(allShelves);
    jest.spyOn(Shelf, 'bulkWrite').mockResolvedValue({ upsertedCount: 3 });
    jest.spyOn(RefreshToken, 'create').mockResolvedValue({ _id: 'refresh-id' });

    const result = await authService.loginWithGoogle('google-id-token', 'test-agent');

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'reader@example.com',
      googleId: verifiedIdentity.sub,
      role: 'reader',
      firstName: 'Reader',
      lastName: 'Example',
      status: 'active',
    }));
    expect(Shelf.bulkWrite).toHaveBeenCalled();
    expect(result).toMatchObject({ user: { role: 'reader' }, created: true });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(RefreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ userAgent: 'test-agent' }));
  });

  it('logs in an existing Google-linked reader', async () => {
    const reader = createReader();
    jest.spyOn(googleTokenUtil, 'verifyGoogleIdToken').mockResolvedValue(verifiedIdentity);
    jest.spyOn(User, 'findOne').mockResolvedValue(reader);
    jest.spyOn(RefreshToken, 'create').mockResolvedValue({ _id: 'refresh-id' });

    const result = await authService.loginWithGoogle('google-id-token');

    expect(reader.save).toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.user.role).toBe('reader');
  });

  it('does not auto-link a password account that uses the Google email', async () => {
    jest.spyOn(googleTokenUtil, 'verifyGoogleIdToken').mockResolvedValue(verifiedIdentity);
    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: 'password-account' });
    const createSpy = jest.spyOn(User, 'create');

    await expect(authService.loginWithGoogle('google-id-token')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('không tự liên kết'),
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid, locked, and non-reader Google identities', async () => {
    jest.spyOn(googleTokenUtil, 'verifyGoogleIdToken').mockResolvedValue(null);
    await expect(authService.loginWithGoogle('invalid-token')).rejects.toMatchObject({ statusCode: 401 });

    jest.spyOn(googleTokenUtil, 'verifyGoogleIdToken').mockResolvedValue(verifiedIdentity);
    jest.spyOn(User, 'findOne').mockResolvedValueOnce(createReader({ status: 'locked', lockReason: 'Vi phạm' }));
    await expect(authService.loginWithGoogle('google-id-token')).rejects.toMatchObject({ statusCode: 401 });

    jest.spyOn(User, 'findOne').mockResolvedValueOnce(createReader({ role: 'admin' }));
    await expect(authService.loginWithGoogle('google-id-token')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('sets the standard refresh cookie when the Google controller succeeds', async () => {
    jest.spyOn(authService, 'loginWithGoogle').mockResolvedValue({
      user: { _id: 'reader-id', role: 'reader' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      created: true,
    });
    const req = { body: { idToken: 'google-id-token' }, headers: { 'user-agent': 'test-agent' } };
    const res = {
      statusCode: 200,
      cookie: jest.fn(),
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await authController.googleLogin(req, res, jest.fn());

    expect(authService.loginWithGoogle).toHaveBeenCalledWith('google-id-token', 'test-agent');
    expect(res.statusCode).toBe(201);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', expect.objectContaining({ httpOnly: true }));
    expect(res.payload.data.accessToken).toBe('access-token');
  });

  it('verifies Google signatures and rejects invalid audience or expired ID tokens', async () => {
    const previousClientId = config.google.clientId;
    config.google.clientId = 'library-web-client-id';
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicJwk = {
      ...publicKey.export({ format: 'jwk' }),
      kid: 'google-test-key',
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
    };
    jest.spyOn(https, 'get').mockImplementation((_url, _options, onResponse) => {
      const request = new EventEmitter();
      request.destroy = (error) => request.emit('error', error);
      process.nextTick(() => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = { 'cache-control': 'max-age=60' };
        response.setEncoding = jest.fn();
        onResponse(response);
        process.nextTick(() => {
          response.emit('data', JSON.stringify({ keys: [publicJwk] }));
          response.emit('end');
        });
      });
      return request;
    });

    const sign = (overrides = {}, audience = 'library-web-client-id') => jwt.sign({
      sub: verifiedIdentity.sub,
      email: verifiedIdentity.email,
      email_verified: true,
      ...overrides,
    }, privateKey, {
      algorithm: 'RS256',
      keyid: 'google-test-key',
      issuer: 'https://accounts.google.com',
      audience,
      expiresIn: '1h',
    });

    try {
      await expect(googleTokenUtil.verifyGoogleIdToken(sign())).resolves.toMatchObject({
        sub: verifiedIdentity.sub,
        email_verified: true,
      });
      await expect(googleTokenUtil.verifyGoogleIdToken(sign({}, 'another-client-id'))).resolves.toBeNull();
      await expect(googleTokenUtil.verifyGoogleIdToken(jwt.sign({
        sub: verifiedIdentity.sub,
        email: verifiedIdentity.email,
        email_verified: true,
        iss: 'https://accounts.google.com',
        aud: 'library-web-client-id',
        exp: Math.floor(Date.now() / 1000) - 60,
      }, privateKey, { algorithm: 'RS256', keyid: 'google-test-key' }))).resolves.toBeNull();
    } finally {
      config.google.clientId = previousClientId;
    }
  });
});
