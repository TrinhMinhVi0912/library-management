const express = require('express');
const { validate } = require('../middlewares');
const {
  notificationIdParamSchema,
  notificationQuerySchema,
} = require('../validators/notification.validator');
const notificationController = require('../controllers/notification.controller');

const router = express.Router();

// Auth đã được áp dụng ở me.route.js (router cha)

/**
 * @route   GET /api/v1/me/notifications
 * @desc    Lấy danh sách thông báo của tôi (hỗ trợ ?unread=true&page=&limit=)
 * @access  Đăng nhập
 */
router.get('/', validate(notificationQuerySchema, 'query'), notificationController.getMyNotifications);

/**
 * @route   GET /api/v1/me/notifications/unread-count
 * @desc    Đếm thông báo chưa đọc
 * @access  Đăng nhập
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   PATCH /api/v1/me/notifications/read-all
 * @desc    Đánh dấu tất cả thông báo đã đọc
 * @access  Đăng nhập
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @route   PATCH /api/v1/me/notifications/:id/read
 * @desc    Đánh dấu 1 thông báo đã đọc
 * @access  Đăng nhập
 */
router.patch(
  '/:id/read',
  validate(notificationIdParamSchema, 'params'),
  notificationController.markAsRead
);

module.exports = router;
