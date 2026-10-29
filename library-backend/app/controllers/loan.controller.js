const { ok, asyncHandler } = require('../middlewares');
const loanService = require('../services/loan.service');

/**
 * Độc giả gửi yêu cầu mượn sách từ giỏ mượn
 * POST /api/v1/loans
 */
const submitLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.submitLoan(req.user._id, req.body);
  return ok(res, loan, null, 201);
});

/**
 * Lấy danh sách phiếu mượn của người dùng hiện tại
 * GET /api/v1/me/loans
 */
const getMyLoans = asyncHandler(async (req, res) => {
  const result = await loanService.getMyLoans(req.user._id, req.query);
  return ok(res, result.items, result.meta);
});

/**
 * Lấy chi tiết một phiếu mượn của người dùng hiện tại
 * GET /api/v1/me/loans/:id
 */
const getMyLoanById = asyncHandler(async (req, res) => {
  const loan = await loanService.getMyLoanById(req.user._id, req.params.id);
  return ok(res, loan);
});

/**
 * Hủy phiếu mượn (khi còn ở trạng thái pending hoặc approved)
 * POST /api/v1/me/loans/:id/cancel
 */
const cancelLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.cancelLoan(req.user._id, req.params.id);
  return ok(res, loan);
});

/**
 * Nhân viên/Admin lấy danh sách phiếu mượn
 * GET /api/v1/admin/loans
 */
const getAdminLoans = asyncHandler(async (req, res) => {
  const result = await loanService.getAdminLoans(req.query);
  return ok(res, result.items, result.meta);
});

/**
 * Nhân viên/Admin lấy chi tiết một phiếu mượn
 * GET /api/v1/admin/loans/:id
 */
const getAdminLoanById = asyncHandler(async (req, res) => {
  const loan = await loanService.getAdminLoanById(req.params.id);
  return ok(res, loan);
});

/**
 * Nhân viên duyệt yêu cầu mượn sách
 * POST /api/v1/admin/loans/:id/approve
 */
const approveLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.approveLoan(req.params.id, req.user._id, {
    ip: req.ip,
  });
  return ok(res, loan);
});

/**
 * Nhân viên từ chối yêu cầu mượn sách
 * POST /api/v1/admin/loans/:id/reject
 */
const rejectLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.rejectLoan(
    req.params.id,
    req.user._id,
    req.body.reason,
    { ip: req.ip }
  );
  return ok(res, loan);
});

/**
 * Nhân viên xác nhận giao sách cho độc giả
 * POST /api/v1/admin/loans/:id/handover
 */
const handoverLoan = asyncHandler(async (req, res) => {
  const loan = await loanService.handoverLoan(req.params.id, req.user._id, {
    ip: req.ip,
  });
  return ok(res, loan);
});

module.exports = {
  submitLoan,
  getMyLoans,
  getMyLoanById,
  cancelLoan,
  getAdminLoans,
  getAdminLoanById,
  approveLoan,
  rejectLoan,
  handoverLoan,
};

