// Tests use model/service mocks. Block accidental use of developer or production services.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/library_test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'jest-access-secret';
process.env.JWT_REFRESH_SECRET = 'jest-refresh-secret';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.DISABLE_INTERNAL_CRON = 'true';
process.env.ENABLE_DOCS = 'true';
