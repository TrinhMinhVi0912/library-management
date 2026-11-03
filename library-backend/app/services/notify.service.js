const { Notification, NotificationRead } = require('../models');
const ApiError = require('../api-error');
const auditService = require('./audit.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Placeholder cho Socket.IO - sẽ được gán khi io sẵn sàng (task sau)
let _io = null;

/**
 * Gán instance Socket.IO (gọi 1 lần khi server khởi động).
 * @param {import('socket.io').Server} io
 */
function setIO(io) {
  _io = io;
}

/**
 * Emit sự kiện qua Socket.IO (no-op nếu chưa có io).
 * @param {string} room   Phòng đích, vd `user:<id>`, `role:staff`
 * @param {string} event  Tên sự kiện
 * @param {Object} data   Dữ liệu gửi kèm
 */
function emit(room, event, data) {
  if (!_io) return; // no-op khi chưa gắn io
  _io.to(room).emit(event, data);
}

function emitNotification(notification) {
  const room = notification.audience === 'user'
    ? `user:${notification.recipient}`
    : ({ all: 'all', readers: 'role:reader', staff: 'role:staff' }[notification.audience]);
  emit(room, 'notification:new', {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    link: notification.link,
    createdAt: notification.createdAt,
    expiresAt: notification.expiresAt,
  });
}

function emitAdminNotificationDeleted(notification) {
  const room = notification.audience === 'user'
    ? `user:${notification.recipient}`
    : ({ all: 'all', readers: 'role:reader', staff: 'role:staff' }[notification.audience]);
  emit(room, 'notification:deleted', { _id: notification._id });
}

function emitAdminNotificationUpdated(notification) {
  const room = notification.audience === 'user'
    ? `user:${notification.recipient}`
    : ({ all: 'all', readers: 'role:reader', staff: 'role:staff' }[notification.audience]);
  emit(room, 'notification:updated', {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    link: notification.link,
    createdAt: notification.createdAt,
    expiresAt: notification.expiresAt,
  });
}

function buildUserNotificationFilter(userId, userRole) {
  const audienceFilter = ['all'];
  if (userRole === 'reader') audienceFilter.push('readers');
  if (userRole === 'staff' || userRole === 'admin') audienceFilter.push('staff');
  return {
    $and: [
      { $or: [{ recipient: userId, audience: 'user' }, { audience: { $in: audienceFilter } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    ],
  };
}

/**
 * Gửi thông báo đến MỘT người dùng cụ thể.
 *
 * @param {string} userId         ObjectId người nhận
 * @param {Object} opts
 * @param {string} opts.type      Loại thông báo (loan, renewal, due, ...)
 * @param {string} opts.title     Tiêu đề
 * @param {string} opts.content   Nội dung
 * @param {string} [opts.link]    Đường dẫn trong app
 * @param {string} [opts.createdBy] Người tạo (null = hệ thống)
 * @param {Date}   [opts.expiresAt] Ngày hết hạn
 * @returns {Promise<Object>}     Document notification đã tạo
 */
async function notifyUser(userId, { type, title, content, link, createdBy = null, expiresAt } = {}) {
  const notification = await Notification.create({
    recipient: userId,
    audience: 'user',
    type,
    title,
    content,
    link,
    createdBy,
    expiresAt,
  });

  // Emit realtime (no-op nếu chưa có io)
  emitNotification(notification);

  return notification;
}

/**
 * Gửi thông báo cho tất cả nhân viên (staff + admin).
 *
 * @param {Object} opts  Giống notifyUser nhưng không cần userId
 * @returns {Promise<Object>}
 */
async function notifyStaff({ type, title, content, link, createdBy = null, expiresAt } = {}) {
  const notification = await Notification.create({
    recipient: null,
    audience: 'staff',
    type,
    title,
    content,
    link,
    createdBy,
    expiresAt,
  });

  emitNotification(notification);

  return notification;
}

/**
 * Gửi thông báo theo nhóm đối tượng (all, readers, staff).
 *
 * @param {string} audience  'all' | 'readers' | 'staff'
 * @param {Object} opts      Giống notifyUser nhưng không cần userId
 * @returns {Promise<Object>}
 */
async function notifyAudience(audience, { type, title, content, link, createdBy = null, expiresAt } = {}) {
  const notification = await Notification.create({
    recipient: null,
    audience,
    type,
    title,
    content,
    link,
    createdBy,
    expiresAt,
  });

  emitNotification(notification);

  return notification;
}

async function getAdminNotifications(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query, { defaultLimit: 10 });
  const filter = {};
  if (query.audience) filter.audience = query.audience;
  if (query.type) filter.type = query.type;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ title: pattern }, { content: pattern }];
  }
  const [items, total] = await Promise.all([
    Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function createAdminNotification(data, actor, options = {}) {
  const payload = {
    type: data.type,
    title: data.title,
    content: data.content,
    link: data.link || undefined,
    expiresAt: data.expiresAt || undefined,
    createdBy: actor._id,
  };
  const notification = data.audience === 'user'
    ? await notifyUser(data.recipient, payload)
    : await notifyAudience(data.audience, payload);
  await auditService.log({
    actor: actor._id,
    action: 'notification.create',
    targetType: 'Notification',
    targetId: notification._id,
    detail: { audience: notification.audience, type: notification.type },
    ip: options.ip || null,
  });
  return notification;
}

async function updateAdminNotification(notificationId, data, actor, options = {}) {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw ApiError.notFound('Thông báo không tồn tại');
  const previous = { audience: notification.audience, recipient: notification.recipient };
  const fields = ['audience', 'recipient', 'type', 'title', 'content', 'link', 'expiresAt'];
  for (const field of fields) {
    if (data[field] !== undefined) notification[field] = data[field] || undefined;
  }
  if (notification.audience === 'user') {
    if (!notification.recipient) throw ApiError.badRequest('Thông báo cá nhân cần có người nhận');
  } else {
    notification.recipient = null;
  }
  await notification.save();
  await auditService.log({
    actor: actor._id,
    action: 'notification.update',
    targetType: 'Notification',
    targetId: notification._id,
    detail: { fields: Object.keys(data), previousAudience: previous.audience, audience: notification.audience },
    ip: options.ip || null,
  });
  const recipientChanged = previous.audience === 'user' && notification.audience === 'user'
    && String(previous.recipient) !== String(notification.recipient);
  if (previous.audience !== notification.audience || recipientChanged) {
    await NotificationRead.deleteMany({ notification: notification._id });
    emitAdminNotificationDeleted({ _id: notification._id, ...previous });
  }
  emitAdminNotificationUpdated(notification);
  return notification;
}

async function deleteAdminNotification(notificationId, actor, options = {}) {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw ApiError.notFound('Thông báo không tồn tại');
  await NotificationRead.deleteMany({ notification: notification._id });
  await Notification.deleteOne({ _id: notification._id });
  await auditService.log({
    actor: actor._id,
    action: 'notification.delete',
    targetType: 'Notification',
    targetId: notification._id,
    detail: { audience: notification.audience, type: notification.type },
    ip: options.ip || null,
  });
  emitAdminNotificationDeleted(notification);
  return { success: true };
}

async function getAdminNotificationById(notificationId) {
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) throw ApiError.notFound('Thông báo không tồn tại');
  return notification;
}

/**
 * Lấy danh sách thông báo của người dùng (cá nhân + chung theo role).
 * Hỗ trợ lọc unread, phân trang.
 *
 * @param {string} userId
 * @param {string} userRole  'reader' | 'staff' | 'admin'
 * @param {Object} query     { unread, page, limit }
 * @returns {Promise<Object>} { notifications, meta }
 */
async function getNotifications(userId, userRole, { unread, page = 1, limit = 20 } = {}) {
  const matchCondition = buildUserNotificationFilter(userId, userRole);

  // Nếu lọc theo unread
  if (unread === 'true' || unread === true) {
    // Tìm các notification đã đọc
    const readIds = await NotificationRead.find({ user: userId }).distinct('notification');
    matchCondition._id = { $nin: readIds };
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(matchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(matchCondition),
  ]);

  // Gắn trạng thái isRead cho mỗi thông báo
  const notifIds = notifications.map((n) => n._id);
  const reads = await NotificationRead.find({
    user: userId,
    notification: { $in: notifIds },
  }).lean();
  const readSet = new Set(reads.map((r) => r.notification.toString()));

  const enriched = notifications.map((n) => ({
    ...n,
    isRead: readSet.has(n._id.toString()),
  }));

  return {
    notifications: enriched,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Đếm thông báo chưa đọc.
 *
 * @param {string} userId
 * @param {string} userRole
 * @returns {Promise<Object>} { unreadCount }
 */
async function getUnreadCount(userId, userRole) {
  const matchCondition = buildUserNotificationFilter(userId, userRole);

  const readIds = await NotificationRead.find({ user: userId }).distinct('notification');
  if (readIds.length > 0) {
    matchCondition._id = { $nin: readIds };
  }

  const unreadCount = await Notification.countDocuments(matchCondition);
  return { unreadCount };
}

/**
 * Đánh dấu MỘT thông báo là đã đọc.
 *
 * @param {string} userId
 * @param {string} notificationId
 * @returns {Promise<Object>} { success: true }
 */
async function markAsRead(userId, notificationId) {
  // Upsert: nếu đã đọc rồi thì không tạo trùng (unique index bảo vệ)
  await NotificationRead.findOneAndUpdate(
    { user: userId, notification: notificationId },
    { user: userId, notification: notificationId, readAt: new Date() },
    { upsert: true, new: true }
  );
  return { success: true };
}

/**
 * Đánh dấu TẤT CẢ thông báo chưa đọc là đã đọc.
 *
 * @param {string} userId
 * @param {string} userRole
 * @returns {Promise<Object>} { markedCount }
 */
async function markAllAsRead(userId, userRole) {
  const matchCondition = buildUserNotificationFilter(userId, userRole);

  // Tìm những thông báo chưa đọc
  const readIds = await NotificationRead.find({ user: userId }).distinct('notification');
  if (readIds.length > 0) {
    matchCondition._id = { $nin: readIds };
  }

  const unreadNotifs = await Notification.find(matchCondition).select('_id').lean();

  if (unreadNotifs.length === 0) {
    return { markedCount: 0 };
  }

  // Tạo bulk insert (ordered: false để bỏ qua trùng lặp)
  const ops = unreadNotifs.map((n) => ({
    user: userId,
    notification: n._id,
    readAt: new Date(),
  }));

  try {
    await NotificationRead.insertMany(ops, { ordered: false });
  } catch (err) {
    // Bỏ qua duplicate key errors (code 11000)
    if (err.code !== 11000 && !(err.writeErrors && err.writeErrors.every((e) => e.err.code === 11000))) {
      throw err;
    }
  }

  return { markedCount: unreadNotifs.length };
}

/**
 * Phát sự kiện cập nhật trạng thái phiếu mượn tới người dùng
 * @param {string} userId
 * @param {string} loanId
 * @param {string} status
 */
function emitLoanUpdated(userId, loanId, status) {
  emit(`user:${userId}`, 'loan:updated', { loanId, status });
}

/**
 * Phát sự kiện cập nhật trạng thái yêu cầu gia hạn tới người dùng
 * @param {string} userId
 * @param {string} requestId
 * @param {string} status
 */
function emitRenewalUpdated(userId, requestId, status) {
  emit(`user:${userId}`, 'renewal:updated', { requestId, status });
}

module.exports = {
  setIO,
  emit,
  notifyUser,
  notifyStaff,
  notifyAudience,
  getAdminNotifications,
  getAdminNotificationById,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  emitLoanUpdated,
  emitRenewalUpdated,
};

