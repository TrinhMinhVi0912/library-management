const { ok, asyncHandler } = require('../middlewares');
const settingsService = require('../services/settings.service');

const getSettings = asyncHandler(async (_req, res) => {
  return ok(res, await settingsService.getSettings());
});

const getLoanReturnPolicy = asyncHandler(async (_req, res) => {
  const settings = await settingsService.getSettings();
  return ok(res, {
    lateFeePerDay: settings.lateFeePerDay,
    lostBookFeeRate: settings.lostBookFeeRate,
    lostBookProcessingFee: settings.lostBookProcessingFee,
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, { actor: req.user._id, ip: req.ip });
  return ok(res, settings);
});

module.exports = { getSettings, getLoanReturnPolicy, updateSettings };
