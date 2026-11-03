const { ok, asyncHandler } = require('../middlewares');
const fineService = require('../services/fine.service');

const getMyFines = asyncHandler(async (req, res) => {
  const result = await fineService.getMyFines(req.user._id, req.query);
  return ok(res, result.items, result.meta);
});

const getAdminFines = asyncHandler(async (req, res) => {
  const result = await fineService.getAdminFines(req.query);
  return ok(res, result.items, result.meta);
});

const createManualFine = asyncHandler(async (req, res) => {
  const fine = await fineService.createManualFine(req.body, req.user._id, { ip: req.ip });
  return ok(res, fine, null, 201);
});

const payFine = asyncHandler(async (req, res) => {
  const fine = await fineService.payFine(req.params.id, req.user._id, { ip: req.ip });
  return ok(res, fine);
});

const waiveFine = asyncHandler(async (req, res) => {
  const fine = await fineService.waiveFine(req.params.id, req.user._id, req.body.reason, { ip: req.ip });
  return ok(res, fine);
});

const recalculateFines = asyncHandler(async (req, res) => {
  const result = await fineService.recalculateUnpaidFineTotal(req.body.reader || null);
  return ok(res, result);
});

module.exports = { getMyFines, getAdminFines, createManualFine, payFine, waiveFine, recalculateFines };
