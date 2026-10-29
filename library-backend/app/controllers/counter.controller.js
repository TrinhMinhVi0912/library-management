const { ok, asyncHandler } = require('../middlewares');
const countersService = require('../services/counters.service');

/**
 * Lấy số lượng phiếu mượn và yêu cầu gia hạn đang chờ xử lý
 * GET /api/v1/admin/counters
 * Role: staff, admin
 */
const getCounters = asyncHandler(async (_req, res) => {
  const result = await countersService.getCounters();
  return ok(res, result);
});

module.exports = {
  getCounters,
};

