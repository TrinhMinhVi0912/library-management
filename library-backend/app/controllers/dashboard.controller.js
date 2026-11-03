const { ok, asyncHandler } = require('../middlewares');
const dashboardService = require('../services/dashboard.service');

const getSummary = asyncHandler(async (_req, res) => {
  return ok(res, await dashboardService.getSummary());
});

const getCharts = asyncHandler(async (req, res) => {
  return ok(res, await dashboardService.getCharts(req.query.range || '30d'));
});

module.exports = { getSummary, getCharts };
