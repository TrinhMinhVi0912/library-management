const { AuditLog } = require('../models');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

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

async function getAuditLogs(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, { defaultLimit: 10 });
  const filter = {};
  if (query.actor) filter.actor = query.actor;
  if (query.action) filter.action = query.action;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'code firstName lastName role')
      .sort(sort).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

module.exports = {
  log,
  getAuditLogs,
};

