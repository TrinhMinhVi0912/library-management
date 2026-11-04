const productionEnvKeys = [
  'NODE_ENV',
  'MONGODB_URI',
  'CLIENT_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JOBS_SECRET',
  'COOKIE_SECURE',
  'COOKIE_SAMESITE',
];

const originalEnv = Object.fromEntries(productionEnvKeys.map((key) => [key, process.env[key]]));

function loadConfigInProduction() {
  let loadedConfig;
  jest.isolateModules(() => {
    loadedConfig = require('../app/config');
  });
  return loadedConfig;
}

describe('BE-38: production deployment configuration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://db.example/library';
    process.env.CLIENT_URL = 'https://library.example';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    process.env.JOBS_SECRET = 'c'.repeat(40);
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAMESITE = 'none';
  });

  afterAll(() => {
    for (const key of productionEnvKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('loads when required production secrets are distinct and strong', () => {
    expect(loadConfigInProduction().env).toBe('production');
  });

  it('fails startup when required production values are missing', () => {
    process.env.JOBS_SECRET = '';
    expect(() => loadConfigInProduction()).toThrow(/JOBS_SECRET/);
  });

  it('rejects short, sample, and reused JWT secrets in production', () => {
    process.env.JWT_ACCESS_SECRET = 'short';
    expect(() => loadConfigInProduction()).toThrow(/JWT_ACCESS_SECRET/);

    process.env.JWT_ACCESS_SECRET = `local_${'a'.repeat(40)}`;
    expect(() => loadConfigInProduction()).toThrow(/JWT_ACCESS_SECRET/);

    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'a'.repeat(40);
    expect(() => loadConfigInProduction()).toThrow(/phải khác nhau/);
  });

  it('requires secure cookies and a supported SameSite mode in production', () => {
    // dotenv.config() không ghi đè biến đã khai báo; dùng chuỗi rỗng để .env cục bộ không lấp giá trị này.
    process.env.COOKIE_SAMESITE = '';
    expect(() => loadConfigInProduction()).toThrow(/COOKIE_SAMESITE/);

    process.env.COOKIE_SAMESITE = 'none';
    process.env.COOKIE_SECURE = 'false';
    expect(() => loadConfigInProduction()).toThrow(/COOKIE_SECURE/);

    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAMESITE = 'invalid';
    expect(() => loadConfigInProduction()).toThrow(/COOKIE_SAMESITE/);
  });

  it('requires exact HTTPS frontend origins in production', () => {
    process.env.CLIENT_URL = 'https://library.example/';
    expect(() => loadConfigInProduction()).toThrow(/CLIENT_URL production/);

    process.env.CLIENT_URL = 'http://library.example';
    expect(() => loadConfigInProduction()).toThrow(/CLIENT_URL production/);
  });
});
