const { Setting } = require('../models');

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 phút

/**
 * Lấy cấu hình hệ thống (document duy nhất).
 * Nếu chưa tồn tại trong cơ sở dữ liệu, tự động tạo mới với giá trị mặc định.
 * Hỗ trợ in-memory caching ngắn hạn.
 *
 * @returns {Promise<import('mongoose').Document>}
 */
async function getSettings() {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({});
  }

  cachedSettings = settings;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return settings;
}

/**
 * Cập nhật cấu hình hệ thống và xóa cache hiện tại.
 *
 * @param {Object} data Dữ liệu cập nhật
 * @returns {Promise<import('mongoose').Document>}
 */
async function updateSettings(data) {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create(data);
  } else {
    Object.assign(settings, data);
    await settings.save();
  }
  invalidate();
  return settings;
}

/**
 * Xóa cache cấu hình trong bộ nhớ.
 */
function invalidate() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

module.exports = {
  getSettings,
  updateSettings,
  invalidate,
};

