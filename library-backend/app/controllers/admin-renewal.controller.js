const { ok, asyncHandler } = require('../middlewares');
const renewalService = require('../services/renewal.service');

const getAdminRenewals = asyncHandler(async (req, res) => {
  const result = await renewalService.getAdminRenewals(req.query);
  return ok(res, result.items, result.meta);
});

const approveRenewal = asyncHandler(async (req, res) => {
  const request = await renewalService.approveRenewal(req.params.id, req.user._id, { ip: req.ip });
  return ok(res, request);
});

const rejectRenewal = asyncHandler(async (req, res) => {
  const request = await renewalService.rejectRenewal(req.params.id, req.user._id, req.body.reason, { ip: req.ip });
  return ok(res, request);
});

module.exports = { getAdminRenewals, approveRenewal, rejectRenewal };
