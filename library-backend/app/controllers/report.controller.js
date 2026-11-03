const reportService = require('../services/report.service');
const { asyncHandler } = require('../middlewares');

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendWorkbook = (filename, createWorkbook) => asyncHandler(async (req, res) => {
  const buffer = await createWorkbook(req.query);
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
});

module.exports = {
  exportLoans: sendWorkbook('loans-report.xlsx', (...args) => reportService.exportLoans(...args)),
  exportFines: sendWorkbook('fines-report.xlsx', (...args) => reportService.exportFines(...args)),
};
