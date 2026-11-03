const mongoose = require('mongoose');
const { Loan, Book } = require('../models');
const notifyService = require('../services/notify.service');
const auditService = require('../services/audit.service');

async function run({ now = new Date() } = {}) {
  const candidates = await Loan.find({ status: 'approved', pickupDeadline: { $lte: now } }).select('_id').lean();
  let expiredCount = 0;

  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    let expiredLoan = null;
    try {
      await session.withTransaction(async () => {
        expiredLoan = await Loan.findOneAndUpdate(
          { _id: candidate._id, status: 'approved', pickupDeadline: { $lte: now } },
          { $set: { status: 'expired', closedAt: now } },
          { new: true, session }
        );
        if (!expiredLoan) return;
        for (const item of expiredLoan.items) {
          const restored = await Book.updateOne({ _id: item.book }, { $inc: { availableCopies: 1 } }, { session });
          if (restored.matchedCount === 0) throw new Error(`Không tìm thấy sách ${item.book} khi hoàn kho`);
        }
      });
    } finally {
      await session.endSession();
    }
    if (!expiredLoan) continue;
    await notifyService.notifyUser(expiredLoan.reader, {
      type: 'loan', title: 'Phiếu mượn đã hết hạn nhận sách',
      content: `Phiếu ${expiredLoan.code} đã hết hạn nhận sách và được hủy.`, link: '/my/loans',
    });
    await auditService.log({ action: 'job.expirePickup', targetType: 'Loan', targetId: expiredLoan._id, detail: { code: expiredLoan.code } });
    expiredCount += 1;
  }
  return { expiredCount };
}

module.exports = { run };
