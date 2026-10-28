const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./app/config');
const apiV1Router = require('./app/routes');
const {
  ok,
  notFoundHandler,
  errorHandler,
} = require('./app/middlewares/errorHandler');

const app = express();

// 1. Cấu hình trust proxy cho hosting phía sau reverse proxy (Render, Railway, VPS Nginx...)
app.set('trust proxy', 1);

// 2. Bảo mật HTTP headers
app.use(helmet());

// 3. CORS dựa trên CLIENT_URL và hỗ trợ credentials (cookie refresh token)
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép yêu cầu không có origin (mobile apps, curl, server-to-server) hoặc thuộc clientUrls
      if (!origin || config.clientUrls.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Chặn bởi chính sách CORS'));
      }
    },
    credentials: true,
  })
);

// 4. Phân tích body và cookie
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 5. Ngăn chặn NoSQL Injection (tương thích Express 5)
app.use((req, _res, next) => {
  if (req.body) {
    mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  if (req.params) {
    mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  }
  if (req.query) {
    mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  }
  next();
});

// 6. Ghi log truy cập
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));

// 7. Giới hạn tần suất yêu cầu (Rate limiting chung)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau ít phút.',
  },
});
app.use(generalLimiter);

// 8. Endpoint kiểm tra sức khỏe hệ thống (Health Check)
app.get('/health', (_req, res) => {
  return ok(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Route gốc thông báo
app.get('/', (_req, res) => {
  return ok(res, {
    name: 'Library Management API',
    version: '1.0.0',
    documentation: config.enableDocs ? '/api/docs' : 'disabled',
  });
});

// 9. Mount API v1
app.use('/api/v1', apiV1Router);

// 10. Bắt 404 cho các route không tồn tại
app.use(notFoundHandler);

// 11. Middleware tập trung xử lý lỗi
app.use(errorHandler);

module.exports = app;
