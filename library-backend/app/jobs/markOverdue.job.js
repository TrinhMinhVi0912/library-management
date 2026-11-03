const { Loan } = require('../models');
const notifyService = require('../services/notify.service');
const auditService = require('../services/audit.service');

async function run({ now = new Date() } = {}) {
  const candidates = await Loan.find({ status: 'borrowing', items: { $elemMatch: { status: 'borrowing', dueDate: { $lt: now } } } }).select('_id').lean();
  let overdueCount = 0;
  for (const candidate of candidates) {
    const loan = await Loan.findOneAndUpdate(
      { _id: candidate._id, status: 'borrowing', items: { $elemMatch: { status: 'borrowing', dueDate: { $lt: now } } } },
      { $set: { status: 'overdue' } }, { new: true }
    );
    if (!loan) continue;
    await notifyService.notifyUser(loan.reader, {
      type: 'overdue', title: 'Phiếu mượn đã quá hạn',
      content: `Phiếu ${loan.code} có sách đã quá hạn. Vui lòng liên hệ thư viện.`, link: '/my/loans',
    });
    await auditService.log({ action: 'job.markOverdue', targetType: 'Loan', targetId: loan._id, detail: { code: loan.code } });
    overdueCount += 1;
  }
  return { overdueCount };
}

module.exports = { run };
