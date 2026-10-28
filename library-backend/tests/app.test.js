const request = require('supertest');
const app = require('../app');

describe('Khung Express & Endpoints Cơ Bản', () => {
  it('GET /health phải trả về 200 và success: true kèm status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET / trả về thông tin API thành công', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Library Management API');
  });

  it('GET /api/v1 trả về 200 từ router v1', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Route không tồn tại phải trả về 404 với định dạng lỗi chuẩn', async () => {
    const res = await request(app).get('/route-khong-ton-tai-12345');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('Đường dẫn không tồn tại');
  });
});
