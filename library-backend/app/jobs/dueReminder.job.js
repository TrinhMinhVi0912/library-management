const { Loan, Notification } = require('../models');
const notifyService = require('../services/notify.service');
const auditService = require('../services/audit.service');

async function run({ now = new Date() } = {}) {
  const end = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const loans = await Loan.find({ status: { $in: ['borrowing', 'overdue'] }, items: { $elemMatch: { status: 'borrowing', dueDate: { $gt: now, $lte: end } } } }).select('_id reader code items').lean();
  const byReader = new Map();
  for (const loan of loans) {
    const key = String(loan.reader);
    if (!byReader.has(key)) byReader.set(key, { reader: loan.reader, loans: [] });
    byReader.get(key).loans.push(loan);
  }
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  vnNow.setUTCHours(0, 0, 0, 0);
  let reminderCount = 0;
  for (const { reader, loans: readerLoans } of byReader.values()) {
    const jobKey = `dueReminder:${reader}:${vnNow.toISOString().slice(0, 10)}`;
    const alreadyReminded = await Notification.exists({ jobKey });
    if (alreadyReminded) continue;
    const codes = readerLoans.map((loan) => loan.code).join(', ');
    try {
      await notifyService.notifyUser(reader, {
        type: 'due', title: 'Sắp đến hạn trả sách',
        content: `Các phiếu ${codes} có sách đến hạn trong 2 ngày tới.`, link: '/my/loans',
        jobKey,
      });
    } catch (error) {
      // Unique jobKey handles simultaneous manual/cron invocations safely.
      if (error.code === 11000) continue;
      throw error;
    }
    await auditService.log({ action: 'job.dueReminder', targetType: 'User', targetId: reader, detail: { loanCodes: readerLoans.map((loan) => loan.code) } });
    reminderCount += 1;
  }
  return { reminderCount };
}

module.exports = { run };
