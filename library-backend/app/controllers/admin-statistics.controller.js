const { ok, asyncHandler } = require('../middlewares');
const adminStatisticsService = require('../services/admin-statistics.service');

const getAdminStatistics = asyncHandler(async (req, res) => {
  return ok(res, await adminStatisticsService.getAdminStatistics(req.params.section, req.user));
});

module.exports = { getAdminStatistics };
