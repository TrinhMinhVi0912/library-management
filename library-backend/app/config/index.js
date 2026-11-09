const dotenv = require('dotenv');

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  const requiredProductionValues = ['MONGODB_URI', 'CLIENT_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JOBS_SECRET', 'COOKIE_SAMESITE'];
  const missingValues = requiredProductionValues.filter((key) => !process.env[key]?.trim());
  if (missingValues.length) {
    throw new Error(`Thiếu cấu hình production bắt buộc: ${missingValues.join(', ')}`);
  }
  const invalidClientUrls = process.env.CLIENT_URL.split(',').map((value) => value.trim()).filter((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol !== 'https:' || parsed.origin !== value;
    } catch {
      return true;
    }
  });
  if (invalidClientUrls.length) {
    throw new Error('CLIENT_URL production phải là danh sách origin HTTPS chính xác, không có path hoặc dấu / cuối');
  }
  const productionSecrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JOBS_SECRET'];
  const weakSecrets = productionSecrets.filter((key) => (
    process.env[key].length < 32 || /^(your_|local_|default_|change_me)/i.test(process.env[key])
  ));
  if (weakSecrets.length) {
    throw new Error(`Cấu hình secret production không an toàn: ${weakSecrets.join(', ')} (cần secret ngẫu nhiên tối thiểu 32 ký tự)`);
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau trong production');
  }
  if (process.env.COOKIE_SECURE !== 'true') {
    throw new Error('COOKIE_SECURE phải là true trong production (yêu cầu HTTPS)');
  }
  const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAMESITE phải là strict, lax hoặc none');
  }
}

const clientUrlRaw = process.env.CLIENT_URL || 'http://localhost:5173';
const clientUrls = clientUrlRaw
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/library?replicaSet=rs0&retryWrites=true&w=majority',
  clientUrls,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) || 7,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(),
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
