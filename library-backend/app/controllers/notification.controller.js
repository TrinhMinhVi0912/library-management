const { ok, asyncHandler } = require('../middlewares');
const notifyService = require('../services/notify.service');

/**
 * Lấy danh sách thông báo của tôi
 * GET /api/v1/me/notifications?unread=true&page=1&limit=20
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  const result = await notifyService.getNotifications(
    req.user._id,
    req.user.role,
    {
      unread: req.query.unread,
      page: req.query.page,
      limit: req.query.limit,
    }
  );
  return ok(res, result.notifications, result.meta);
});

/**
 * Đếm thông báo chưa đọc
 * GET /api/v1/me/notifications/unread-count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notifyService.getUnreadCount(req.user._id, req.user.role);
  return ok(res, result);
});

/**
 * Đánh dấu 1 thông báo đã đọc
 * PATCH /api/v1/me/notifications/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const result = await notifyService.markAsRead(req.user._id, req.params.id);
  return ok(res, result);
});

/**
 * Đánh dấu tất cả thông báo đã đọc
 * PATCH /api/v1/me/notifications/read-all
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notifyService.markAllAsRead(req.user._id, req.user.role);
  return ok(res, result);
});

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};

