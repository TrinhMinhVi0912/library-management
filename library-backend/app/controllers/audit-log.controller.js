const { ok, asyncHandler } = require('../middlewares');
const auditService = require('../services/audit.service');

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await auditService.getAuditLogs(req.query);
  return ok(res, result.items, result.meta);
});

module.exports = { getAuditLogs };
