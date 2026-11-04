const request = require('supertest');
const app = require('../app');

describe('BE-37: security middleware checks', () => {
  it('allows the configured frontend origin and withholds CORS headers for unlisted origins', async () => {
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    const blocked = await request(app).get('/health').set('Origin', 'https://untrusted.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects NoSQL operator objects in login input before reaching authentication', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: 'Password123' });

    expect(response.statusCode).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it('returns 429 after the auth rate limit is exceeded', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 21; attempt += 1) {
      responses.push(await request(app).post('/api/v1/auth/login').send({}));
    }

    expect(responses.some((response) => response.statusCode === 429)).toBe(true);
    expect(responses.every((response) => [422, 429].includes(response.statusCode))).toBe(true);
  });
});
