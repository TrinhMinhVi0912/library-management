const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Fine, User } = require('../models');
const notifyService = require('./notify.service');
const auditService = require('./audit.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

/** Tạo một khoản phạt; caller chịu trách nhiệm truyền session khi ở transaction. */
async function createFine(data, options = {}) {
  const [fine] = await Fine.create([data], options);
  return fine;
}

async function getMyFines(readerId, query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { reader: readerId };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Fine.find(filter).populate('loan', 'code').populate('book', 'code title').sort(sort).skip(skip).limit(limit).lean(),
    Fine.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function getAdminFines(query = {}) {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.reader) filter.reader = query.reader;
  const [items, total] = await Promise.all([
    Fine.find(filter).populate('reader', 'code firstName lastName email phone').populate('loan', 'code').populate('book', 'code title').sort(sort).skip(skip).limit(limit).lean(),
    Fine.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
}

async function createManualFine(data, staffId, options = {}) {
  const session = await mongoose.startSession();
  let fine;
  try {
    await session.withTransaction(async () => {
      const reader = await User.findOne({ _id: data.reader, role: 'reader' }).session(session);
      if (!reader) throw ApiError.notFound('Độc giả không tồn tại');
      [fine] = await Fine.create([{
        reader: reader._id,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        recordedBy: staffId,
      }], { session });
      reader.unpaidFineTotal = (reader.unpaidFineTotal || 0) + fine.amount;
      await reader.save({ session });
    });
  } finally { await session.endSession(); }
  await notifyService.notifyUser(data.reader, {
    type: 'fine', title: 'Bạn có khoản phạt mới',
    content: `Khoản phạt ${fine.amount.toLocaleString('vi-VN')}đ: ${fine.reason}`,
    link: '/my/fines', createdBy: staffId,
  });
  await auditService.log({ actor: staffId, action: 'fine.create', targetType: 'Fine', targetId: fine._id, detail: { reader: data.reader, amount: fine.amount, type: data.type }, ip: options.ip || null });
  return fine;
}

async function payFine(fineId, staffId, options = {}) {
  const session = await mongoose.startSession();
  let fine;
  try {
    await session.withTransaction(async () => {
      fine = await Fine.findById(fineId).session(session);
      if (!fine) throw ApiError.notFound('Khoản phạt không tồn tại');
      if (fine.status !== 'unpaid') throw ApiError.conflict('Khoản phạt không còn ở trạng thái chưa thu');
      const reader = await User.findOneAndUpdate(
        { _id: fine.reader, unpaidFineTotal: { $gte: fine.amount } },
        { $inc: { unpaidFineTotal: -fine.amount } },
        { new: true, session }
      );
      if (!reader) throw ApiError.conflict('Tổng nợ phạt không khớp; hãy chạy đối soát trước');
      fine.status = 'paid';
      fine.paidAt = new Date();
      fine.paidConfirmedBy = staffId;
      await fine.save({ session });
    });
  } finally { await session.endSession(); }
  await notifyService.notifyUser(fine.reader.toString(), { type: 'fine', title: 'Đã xác nhận thu phạt', content: `Khoản phạt ${fine.amount.toLocaleString('vi-VN')}đ đã được thanh toán tại quầy.`, link: '/my/fines', createdBy: staffId });
  await auditService.log({ actor: staffId, action: 'fine.pay', targetType: 'Fine', targetId: fine._id, detail: { amount: fine.amount }, ip: options.ip || null });
  return fine;
}

async function waiveFine(fineId, adminId, reason, options = {}) {
  const session = await mongoose.startSession();
  let fine;
  try {
    await session.withTransaction(async () => {
      fine = await Fine.findById(fineId).session(session);
      if (!fine) throw ApiError.notFound('Khoản phạt không tồn tại');
      if (fine.status !== 'unpaid') throw ApiError.conflict('Chỉ có thể miễn khoản phạt chưa thu');
      const reader = await User.findOneAndUpdate(
        { _id: fine.reader, unpaidFineTotal: { $gte: fine.amount } },
        { $inc: { unpaidFineTotal: -fine.amount } },
        { new: true, session }
      );
      if (!reader) throw ApiError.conflict('Tổng nợ phạt không khớp; hãy chạy đối soát trước');
      fine.status = 'waived';
      fine.waivedReason = reason;
      fine.waivedBy = adminId;
      fine.waivedAt = new Date();
      await fine.save({ session });
    });
  } finally { await session.endSession(); }
  await notifyService.notifyUser(fine.reader.toString(), { type: 'fine', title: 'Khoản phạt đã được miễn', content: `Khoản phạt ${fine.amount.toLocaleString('vi-VN')}đ đã được miễn. Lý do: ${reason}`, link: '/my/fines', createdBy: adminId });
  await auditService.log({ actor: adminId, action: 'fine.waive', targetType: 'Fine', targetId: fine._id, detail: { amount: fine.amount, reason }, ip: options.ip || null });
  return fine;
}

async function recalculateUnpaidFineTotal(readerId = null) {
  const readerFilter = readerId ? { _id: readerId } : { role: 'reader' };
  const readers = await User.find(readerFilter).select('_id unpaidFineTotal').lean();
  const totals = await Fine.aggregate([
    { $match: { reader: { $in: readers.map((reader) => reader._id) }, status: 'unpaid' } },
    { $group: { _id: '$reader', total: { $sum: '$amount' } } },
  ]);
  const totalsByReader = new Map(totals.map((entry) => [entry._id.toString(), entry.total]));
  const updates = await Promise.all(readers.map(async (reader) => {
    const total = totalsByReader.get(reader._id.toString()) || 0;
    if (total !== reader.unpaidFineTotal) await User.updateOne({ _id: reader._id }, { $set: { unpaidFineTotal: total } });
    return { reader: reader._id, previous: reader.unpaidFineTotal || 0, total };
  }));
  return updates;
}

module.exports = { createFine, getMyFines, getAdminFines, createManualFine, payFine, waiveFine, recalculateUnpaidFineTotal };
