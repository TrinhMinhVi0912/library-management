const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const bookController = require('../controllers/book.controller');
const counterController = require('../controllers/counter.controller');
const loanController = require('../controllers/loan.controller');
const fineController = require('../controllers/fine.controller');
const renewalController = require('../controllers/admin-renewal.controller');
const notificationController = require('../controllers/notification.controller');
const dashboardController = require('../controllers/dashboard.controller');
const reportController = require('../controllers/report.controller');
const settingController = require('../controllers/setting.controller');
const auditLogController = require('../controllers/audit-log.controller');
const userController = require('../controllers/user.controller');
const {
  idParamSchema,
  createBookSchema,
  updateBookSchema,
  updateStatusSchema,
  queryAdminBookSchema,
} = require('../validators/book.validator');
const {
  loanIdParamSchema,
  rejectLoanSchema,
  queryAdminLoansSchema,
  returnLoanSchema,
} = require('../validators/loan.validator');
const {
  fineIdParamSchema,
  adminFinesQuerySchema,
  createFineSchema,
  waiveFineSchema,
} = require('../validators/fine.validator');
const {
  renewalIdParamSchema,
  adminRenewalsQuerySchema,
  rejectRenewalSchema,
} = require('../validators/renewal.validator');
const {
  userIdParamSchema,
  adminUsersQuerySchema,
  updateAdminUserSchema,
  lockUserSchema,
  createStaffSchema,
  updateRoleSchema,
} = require('../validators/admin-user.validator');
const { settingsUpdateSchema, auditLogsQuerySchema } = require('../validators/settings.validator');
const {
  notificationIdParamSchema,
  adminNotificationsQuerySchema,
  createAdminNotificationSchema,
  updateAdminNotificationSchema,
} = require('../validators/admin-notification.validator');
const { dashboardChartsQuerySchema, reportDateRangeSchema } = require('../validators/dashboard.validator');
const forumController = require('../controllers/forum.controller');
const {
  idParamSchema: forumIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
  adminReportsQuerySchema,
  reportStatusSchema,
  pinStateSchema,
  lockStateSchema,
  hideStateSchema,
} = require('../validators/forum.validator');

const router = express.Router();

// Tất cả các route quản trị đều yêu cầu xác thực và phân quyền nhân viên (staff) hoặc quản trị viên (admin)
router.use(auth);
router.use(requireRole('staff', 'admin'));

router.get('/dashboard/summary', dashboardController.getSummary);
router.get('/dashboard/charts', validate(dashboardChartsQuerySchema, 'query'), dashboardController.getCharts);
router.get('/reports/loans.xlsx', validate(reportDateRangeSchema, 'query'), reportController.exportLoans);
router.get('/reports/fines.xlsx', validate(reportDateRangeSchema, 'query'), reportController.exportFines);

// =============================================================================
// QUẢN LÝ NGƯỜI DÙNG (/admin/users)
// =============================================================================
router.route('/users')
  .get(validate(adminUsersQuerySchema, 'query'), userController.getAdminUsers)
  .post(requireRole('admin'), validate(createStaffSchema, 'body'), userController.createStaff);

router.get('/users/:id', validate(userIdParamSchema, 'params'), userController.getAdminUserById);
router.patch('/users/:id', validate({ params: userIdParamSchema, body: updateAdminUserSchema }), userController.updateAdminUser);
router.patch('/users/:id/lock', validate({ params: userIdParamSchema, body: lockUserSchema }), userController.lockUser);
router.patch('/users/:id/unlock', validate(userIdParamSchema, 'params'), userController.unlockUser);
router.patch('/users/:id/role', requireRole('admin'), validate({ params: userIdParamSchema, body: updateRoleSchema }), userController.updateUserRole);

router.get('/settings', requireRole('admin'), settingController.getSettings);
router.put('/settings', requireRole('admin'), validate(settingsUpdateSchema, 'body'), settingController.updateSettings);
router.get('/audit-logs', requireRole('admin'), validate(auditLogsQuerySchema, 'query'), auditLogController.getAuditLogs);
router.post('/users/:id/password-reset', validate(userIdParamSchema, 'params'), userController.requestPasswordReset);

router.route('/forum/categories')
  .get(forumController.listCategories)
  .post(validate(createCategorySchema, 'body'), forumController.createCategory);
router.patch('/forum/categories/:id', validate({ params: forumIdParamSchema, body: updateCategorySchema }), forumController.updateCategory);
router.delete('/forum/categories/:id', validate(forumIdParamSchema, 'params'), forumController.deleteCategory);
router.get('/forum/reports', validate(adminReportsQuerySchema, 'query'), forumController.getAdminReports);
router.patch('/forum/reports/:id', validate({ params: forumIdParamSchema, body: reportStatusSchema }), forumController.updateReportStatus);
router.patch('/forum/threads/:id/pin', validate({ params: forumIdParamSchema, body: pinStateSchema }), forumController.pinThread);
router.patch('/forum/threads/:id/lock', validate({ params: forumIdParamSchema, body: lockStateSchema }), forumController.lockThread);
router.patch('/forum/threads/:id/hide', validate({ params: forumIdParamSchema, body: hideStateSchema }), forumController.hideThread);
router.patch('/forum/posts/:id/hide', validate({ params: forumIdParamSchema, body: hideStateSchema }), forumController.hidePost);
router.delete('/forum/posts/:id', validate(forumIdParamSchema, 'params'), forumController.deletePostAsAdmin);

router.route('/notifications')
  .get(validate(adminNotificationsQuerySchema, 'query'), notificationController.getAdminNotifications)
  .post(validate(createAdminNotificationSchema, 'body'), notificationController.createAdminNotification);
router.route('/notifications/:id')
  .get(validate(notificationIdParamSchema, 'params'), notificationController.getAdminNotificationById)
  .patch(validate({ params: notificationIdParamSchema, body: updateAdminNotificationSchema }), notificationController.updateAdminNotification)
  .delete(validate(notificationIdParamSchema, 'params'), notificationController.deleteAdminNotification);

// =============================================================================
// SỐ ĐẾM / BADGE (/admin/counters)
// =============================================================================
router.get('/counters', counterController.getCounters);

// =============================================================================
// QUẢN LÝ SÁCH (/admin/books)
// =============================================================================

router
  .route('/books')
  .get(validate(queryAdminBookSchema, 'query'), bookController.getAdminBooks)
  .post(validate(createBookSchema, 'body'), bookController.createBook);

router
  .route('/books/:id')
  .get(validate(idParamSchema, 'params'), bookController.getAdminBookById)
  .put(
    validate({ params: idParamSchema, body: updateBookSchema }),
    bookController.updateBook
  )
  .patch(
    validate({ params: idParamSchema, body: updateBookSchema }),
    bookController.updateBook
  )
  .delete(validate(idParamSchema, 'params'), bookController.deleteBook);

router.patch(
  '/books/:id/status',
  validate({ params: idParamSchema, body: updateStatusSchema }),
  bookController.updateBookStatus
);

// =============================================================================
// QUẢN LÝ PHIẾU MƯỢN (/admin/loans)
// =============================================================================

router
  .route('/loans')
  .get(validate(queryAdminLoansSchema, 'query'), loanController.getAdminLoans);

router
  .route('/loans/:id')
  .get(validate(loanIdParamSchema, 'params'), loanController.getAdminLoanById);

router.post(
  '/loans/:id/approve',
  validate(loanIdParamSchema, 'params'),
  loanController.approveLoan
);

router.post(
  '/loans/:id/reject',
  validate({ params: loanIdParamSchema, body: rejectLoanSchema }),
  loanController.rejectLoan
);

router.post(
  '/loans/:id/handover',
  validate(loanIdParamSchema, 'params'),
  loanController.handoverLoan
);

router.post('/loans/:id/return', validate({ params: loanIdParamSchema, body: returnLoanSchema }), loanController.returnItems);

router.get('/fines', validate(adminFinesQuerySchema, 'query'), fineController.getAdminFines);
router.post('/fines', validate(createFineSchema), fineController.createManualFine);
router.patch('/fines/:id/pay', validate(fineIdParamSchema, 'params'), fineController.payFine);
router.patch(
  '/fines/:id/waive',
  requireRole('admin'),
  validate({ params: fineIdParamSchema, body: waiveFineSchema }),
  fineController.waiveFine
);
router.post('/fines/recalculate', requireRole('admin'), fineController.recalculateFines);

router.get('/renewals', validate(adminRenewalsQuerySchema, 'query'), renewalController.getAdminRenewals);
router.post('/renewals/:id/approve', validate(renewalIdParamSchema, 'params'), renewalController.approveRenewal);
router.post(
  '/renewals/:id/reject',
  validate({ params: renewalIdParamSchema, body: rejectRenewalSchema }),
  renewalController.rejectRenewal
);

module.exports = router;

