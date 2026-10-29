const express = require('express');
const { auth, requireRole, validate } = require('../middlewares');
const {
  submitLoanSchema,
  getLoansQuerySchema,
  loanIdParamSchema,
} = require('../validators/loan.validator');
const loanController = require('../controllers/loan.controller');

// Router dành cho POST /api/v1/loans
const loanRouter = express.Router();

// Yêu cầu đăng nhập và role reader khi gửi yêu cầu mượn
loanRouter.post(
  '/',
  auth,
  requireRole('reader'),
  validate(submitLoanSchema),
  loanController.submitLoan
);

// Router dành cho /api/v1/me/loans
const meLoanRouter = express.Router();

/**
 * @route   GET /api/v1/me/loans
 * @desc    Xem danh sách phiếu mượn của tôi
 * @access  Đăng nhập
 */
meLoanRouter.get(
  '/',
  validate(getLoansQuerySchema, 'query'),
  loanController.getMyLoans
);

/**
 * @route   GET /api/v1/me/loans/:id
 * @desc    Xem chi tiết phiếu mượn của tôi
 * @access  Đăng nhập
 */
meLoanRouter.get(
  '/:id',
  validate(loanIdParamSchema, 'params'),
  loanController.getMyLoanById
);

/**
 * @route   POST /api/v1/me/loans/:id/cancel
 * @desc    Hủy phiếu mượn (pending/approved)
 * @access  Đăng nhập
 */
meLoanRouter.post(
  '/:id/cancel',
  validate(loanIdParamSchema, 'params'),
  loanController.cancelLoan
);

loanRouter.loanRouter = loanRouter;
loanRouter.meLoanRouter = meLoanRouter;

module.exports = loanRouter;
module.exports.loanRouter = loanRouter;
module.exports.meLoanRouter = meLoanRouter;

