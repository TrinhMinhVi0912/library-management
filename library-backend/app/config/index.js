const dotenv = require('dotenv');

dotenv.config();

const clientUrlRaw = process.env.CLIENT_URL || 'http://localhost:5173';
const clientUrls = clientUrlRaw
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/library?retryWrites=true&w=majority',
  clientUrls,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) || 7,
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '"Thư viện" <no-reply@library.example.com>',
  },
  jobs: {
    secret: process.env.JOBS_SECRET || '',
    disableInternalCron: process.env.DISABLE_INTERNAL_CRON === 'true',
  },
  enableDocs: process.env.ENABLE_DOCS === 'true',
};

module.exports = config;
