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

module.exports = {
  submitLoan,
  getMyLoans,
  getMyLoanById,
  cancelLoan,
};

