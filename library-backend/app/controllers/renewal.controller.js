const { ok, asyncHandler } = require('../middlewares');
const renewalService = require('../services/renewal.service');

const requestRenewal = asyncHandler(async (req, res) => {
  const renewal = await renewalService.requestRenewal(req.params.id, req.params.bookId, req.user._id, req.body.reason);
  return ok(res, renewal, null, 201);
});

const getMyRenewals = asyncHandler(async (req, res) => {
  const result = await renewalService.getMyRenewals(req.user._id, req.query);
  return ok(res, result.items, result.meta);
});

const cancelRenewal = asyncHandler(async (req, res) => {
  const renewal = await renewalService.cancelRenewal(req.params.id, req.user._id);
  return ok(res, renewal);
});

module.exports = { requestRenewal, getMyRenewals, cancelRenewal };
