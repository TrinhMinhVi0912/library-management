const { AuditLog } = require('../models');

/**
 * Ghi nhật ký hoạt động hệ thống (audit log).
 *
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId|string|null} [params.actor] ID người thực hiện (null nếu hệ thống/khách)
 * @param {string} params.action Hành động thực hiện (ví dụ: 'book.create', 'user.lock')
 * @param {string|null} [params.targetType] Loại đối tượng bị tác động (ví dụ: 'Book', 'User')
 * @param {import('mongoose').Types.ObjectId|string|null} [params.targetId] ID đối tượng bị tác động
 * @param {Object} [params.detail] Dữ liệu chi tiết bổ sung
 * @param {string|null} [params.ip] Địa chỉ IP người gọi
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function log({
  actor = null,
  action,
  targetType = null,
  targetId = null,
  detail = {},
  ip = null,
} = {}) {
  try {
    return await AuditLog.create({
      actor,
      action,
      targetType,
      targetId,
      detail,
      ip,
    });
  } catch (error) {
    // Không để lỗi ghi audit log chặn luồng nghiệp vụ chính
    console.error('Lỗi khi ghi audit log:', error);
    return null;
  }
}

module.exports = {
  log,
};

