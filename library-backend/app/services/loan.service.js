const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Loan, Book, User, Cart } = require('../models');
const settingsService = require('./settings.service');
const notifyService = require('./notify.service');
const countersService = require('./counters.service');
const auditService = require('./audit.service');
const codeUtil = require('../utils/code.util');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination.util');

/**
 * Độc giả gửi yêu cầu mượn sách từ giỏ mượn
 * 
 * Kiểm tra các điều kiện:
 * 1. User active, không bị khóa
 * 2. Nợ phạt = 0 (unpaidFineTotal === 0)
 * 3. Không có sách đang mượn quá hạn
 * 4. Tổng sách đang mượn + đang chờ duyệt + yêu cầu mới <= maxBooksPerLoan (mặc định 5)
 * 
 * Tạo phiếu mượn với snapshot tên/giá, xóa giỏ mượn, thông báo nhân viên & emit counters
 * 
 * @param {string} userId - ID của độc giả
 * @param {object} data - Dữ liệu yêu cầu mượn (expectedPickupDate, requestNote / note, [items])
 * @returns {Promise<object>} Phiếu mượn đã tạo
 */
async function submitLoan(userId, data = {}) {
  // 1. Kiểm tra tài khoản độc giả
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Người dùng không tồn tại');
  }
  if (user.status !== 'active') {
    throw ApiError.forbidden('Tài khoản của bạn đang bị khóa, không thể mượn sách');
  }
  if ((user.unpaidFineTotal || 0) > 0) {
    throw ApiError.badRequest('Bạn đang có tiền phạt chưa thanh toán, vui lòng thanh toán trước khi mượn sách');
  }

  // 2. Kiểm tra sách mượn quá hạn
  const hasOverdue = await Loan.exists({
    reader: userId,
    $or: [
      { status: 'overdue' },
      {
        status: 'borrowing',
        items: {
          $elemMatch: {
            status: 'borrowing',
            dueDate: { $lt: new Date() },
          },
        },
      },
    ],
  });
  if (hasOverdue) {
    throw ApiError.badRequest('Bạn đang có sách mượn quá hạn chưa trả, không thể mượn thêm sách');
  }

  // 3. Lấy sách từ giỏ mượn hoặc từ data.items
  let rawItems = [];
  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    rawItems = data.items;
  } else {
    const cart = await Cart.findOne({ user: userId }).populate('items.book');
    if (cart && cart.items) {
      rawItems = cart.items;
    }
  }

  if (!rawItems || rawItems.length === 0) {
    throw ApiError.badRequest('Giỏ mượn đang trống');
  }

  // Kiểm tra tính khả dụng của từng cuốn sách và tạo snapshot
  const resolvedItems = [];
  for (const item of rawItems) {
    const bookDoc = item.book && item.book._id ? item.book : await Book.findById(item.book || item);
    if (!bookDoc) {
      throw ApiError.badRequest('Sách trong giỏ mượn không tồn tại trong hệ thống');
    }
    if (bookDoc.status !== 'active') {
      throw ApiError.badRequest(`Sách "${bookDoc.title}" hiện không khả dụng`);
    }
    if (bookDoc.availableCopies <= 0) {
      throw ApiError.badRequest(`Sách "${bookDoc.title}" hiện đã hết bản sao có thể mượn`);
    }

    resolvedItems.push({
      book: bookDoc._id,
      titleSnapshot: bookDoc.title,
      priceSnapshot: bookDoc.price || 0,
      status: 'pending',
    });
  }

  // 4. Kiểm tra giới hạn số lượng sách (đang mượn + đang chờ + mới <= maxBooksPerLoan)
  const settings = await settingsService.getSettings();
  const maxBooks = settings.maxBooksPerLoan || 5;

  const activeLoans = await Loan.find({
    reader: userId,
    status: { $in: ['pending', 'approved', 'borrowing', 'overdue'] },
  });

  let currentCount = 0;
  for (const activeLoan of activeLoans) {
    for (const it of activeLoan.items) {
      if (['pending', 'borrowing'].includes(it.status)) {
        currentCount += 1;
      }
    }
  }

  const newCount = resolvedItems.length;
  if (currentCount + newCount > maxBooks) {
    throw ApiError.badRequest(
      `Vượt quá giới hạn mượn sách (đang mượn/chờ duyệt: ${currentCount}, yêu cầu mới: ${newCount}, tối đa: ${maxBooks})`
    );
  }

  // 5. Sinh mã phiếu mượn tự tăng (PM000001)
  const code = await codeUtil.nextCode('loan');

  // 6. Tạo phiếu mượn mới ở trạng thái pending
  const loan = await Loan.create({
    code,
    reader: userId,
    status: 'pending',
    items: resolvedItems,
    expectedPickupDate: data.expectedPickupDate,
    requestNote: data.requestNote || data.note || '',
  });

  // 7. Xóa giỏ mượn của độc giả
  await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });

  // 8. Gửi thông báo tới nhân viên và cập nhật số đếm badge
  const readerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.code || 'Độc giả';
  await notifyService.notifyStaff({
    type: 'loan',
    title: 'Yêu cầu mượn sách mới',
    content: `Độc giả ${readerName} đã gửi yêu cầu mượn ${resolvedItems.length} cuốn sách (Mã phiếu: ${code})`,
    link: '/admin/requests',
  });
  await countersService.emitStaffCounters();

  return loan;
}

/**
 * Lấy danh sách phiếu mượn của người dùng hiện tại
 * 
 * @param {string} userId - ID người dùng
 * @param {object} query - Bộ lọc query (status, page, limit, sort)
 * @returns {Promise<{ items: Array, meta: object }>}
 */
async function getMyLoans(userId, query = {}) {
  const filter = { reader: userId };
  if (query.status) {
    filter.status = query.status;
  }

  const { page, limit, skip, sort } = parsePagination(query, {
    defaultLimit: 10,
    defaultSort: '-createdAt',
  });

  const [items, total] = await Promise.all([
    Loan.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'items.book',
        select: 'title slug cover authors authorText price',
      }),
    Loan.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lấy chi tiết một phiếu mượn của người dùng hiện tại
 * 
 * @param {string} userId - ID người dùng
 * @param {string} loanId - ID phiếu mượn
 * @returns {Promise<object>}
 */
async function getMyLoanById(userId, loanId) {
  const loan = await Loan.findOne({ _id: loanId, reader: userId })
    .populate({
      path: 'items.book',
      select: 'title slug cover authors authorText price',
    })
    .populate('approvedBy', 'firstName lastName code')
    .populate('handedOverBy', 'firstName lastName code')
    .populate('returnedBy', 'firstName lastName code');

  if (!loan) {
    throw ApiError.notFound('Phiếu mượn không tồn tại');
  }

  return loan;
}

/**
 * Độc giả hủy phiếu mượn
 * Chỉ được phép hủy khi phiếu ở trạng thái pending hoặc approved
 * Nếu phiếu đã approved: hoàn lại số lượng tồn kho (availableCopies += 1) cho từng sách trong MongoDB transaction
 * 
 * @param {string} userId - ID người dùng
 * @param {string} loanId - ID phiếu mượn
 * @returns {Promise<object>} Phiếu mượn sau khi hủy
 */
async function cancelLoan(userId, loanId) {
  const session = await mongoose.startSession();
  let wasPending;
  let cancelledLoan;

  try {
    session.startTransaction();

    const loan = await Loan.findOne({ _id: loanId, reader: userId }).session(session);
    if (!loan) {
      throw ApiError.notFound('Phiếu mượn không tồn tại');
    }

    if (!['pending', 'approved'].includes(loan.status)) {
      throw ApiError.badRequest(`Không thể hủy phiếu mượn ở trạng thái "${loan.status}"`);
    }

    wasPending = loan.status === 'pending';

    // Nếu phiếu đã duyệt, hoàn tồn kho cho từng quyển sách
    if (loan.status === 'approved') {
      for (const item of loan.items) {
        await Book.findByIdAndUpdate(
          item.book,
          { $inc: { availableCopies: 1 } },
          { session }
        );
      }
    }

    loan.status = 'cancelled';
    await loan.save({ session });

    await session.commitTransaction();
    cancelledLoan = loan;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // Phát sự kiện Socket và cập nhật số đếm sau commit
  notifyService.emitLoanUpdated(userId, loanId, 'cancelled');
  if (wasPending) {
    await countersService.emitStaffCounters();
  }

  return cancelledLoan;
}

/**
 * Nhân viên duyệt yêu cầu mượn sách (transaction)
 * Điều kiện:
 * 1. Phiếu mượn phải ở trạng thái pending
 * 2. Từng cuốn sách phải cập nhật giảm availableCopies nguyên tử ($gte: 1, $inc: -1)
 *    Nếu hết sách giữa chừng -> rollback và ném lỗi 422 nêu rõ tên cuốn sách hết
 * 3. Cập nhật phiếu mượn sang approved, gán pickupDeadline = now + pickupHoldDays, approvedBy, approvedAt
 * 4. Sau commit: gửi thông báo độc giả, emit socket loan:updated, emit staff:counters, ghi audit log
 *
 * @param {string} loanId - ID phiếu mượn
 * @param {string} staffId - ID nhân viên duyệt
 * @param {object} [options] - Tuỳ chọn bổ sung (ip, ...)
 * @returns {Promise<object>} Phiếu mượn sau khi duyệt
 */
async function approveLoan(loanId, staffId, options = {}) {
  const session = await mongoose.startSession();
  let approvedLoan;

  try {
    await session.withTransaction(async () => {
      const loan = await Loan.findById(loanId).session(session);
      if (!loan) {
        throw ApiError.notFound('Phiếu mượn không tồn tại');
      }
      if (loan.status !== 'pending') {
        throw ApiError.badRequest('Chỉ có thể duyệt phiếu mượn ở trạng thái chờ duyệt');
      }

      for (const item of loan.items) {
        const bookId = item.book && item.book._id ? item.book._id : item.book;
        const updatedBook = await Book.findOneAndUpdate(
          { _id: bookId, availableCopies: { $gte: 1 } },
          { $inc: { availableCopies: -1 } },
          { session, new: true }
        );

        if (!updatedBook) {
          throw ApiError.unprocessableEntity(
            `Sách "${item.titleSnapshot || 'không xác định'}" đã hết bản sao có thể mượn`
          );
        }
      }

      const settings = await settingsService.getSettings();
      const pickupHoldDays = settings.pickupHoldDays || 3;
      const now = new Date();
      const pickupDeadline = new Date(now.getTime() + pickupHoldDays * 24 * 60 * 60 * 1000);

      loan.status = 'approved';
      loan.approvedBy = staffId;
      loan.approvedAt = now;
      loan.pickupDeadline = pickupDeadline;

      await loan.save({ session });
      approvedLoan = loan;
    });
  } finally {
    await session.endSession();
  }

  // Sau commit: thông báo độc giả, emit loan:updated, cập nhật staff:counters, ghi audit log
  const readerId = approvedLoan.reader.toString();
  const deadlineStr = approvedLoan.pickupDeadline.toISOString().split('T')[0];

  await notifyService.notifyUser(readerId, {
    type: 'loan',
    title: 'Yêu cầu mượn sách đã được duyệt',
    content: `Yêu cầu mượn sách ${approvedLoan.code} của bạn đã được duyệt. Vui lòng nhận sách trước ngày ${deadlineStr}.`,
    link: `/my/loans/${approvedLoan._id}`,
    createdBy: staffId,
  });

  notifyService.emitLoanUpdated(readerId, approvedLoan._id.toString(), 'approved');
  await countersService.emitStaffCounters();

  await auditService.log({
    actor: staffId,
    action: 'loan.approve',
    targetType: 'Loan',
    targetId: approvedLoan._id,
    detail: {
      code: approvedLoan.code,
      pickupDeadline: approvedLoan.pickupDeadline,
    },
    ip: options.ip || null,
  });

  return approvedLoan;
}

/**
 * Nhân viên từ chối yêu cầu mượn sách
 * Bắt buộc phải có lý do từ chối.
 * Chuyển trạng thái phiếu sang rejected, lưu rejectReason, approvedBy, approvedAt.
 * Sau khi lưu: thông báo độc giả, emit loan:updated, cập nhật staff:counters, ghi audit log.
 *
 * @param {string} loanId - ID phiếu mượn
 * @param {string} staffId - ID nhân viên từ chối
 * @param {string} reason - Lý do từ chối (bắt buộc)
 * @param {object} [options] - Tuỳ chọn bổ sung (ip, ...)
 * @returns {Promise<object>} Phiếu mượn sau khi từ chối
 */
async function rejectLoan(loanId, staffId, reason, options = {}) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw ApiError.unprocessableEntity('Lý do từ chối là bắt buộc');
  }

  const loan = await Loan.findById(loanId);
  if (!loan) {
    throw ApiError.notFound('Phiếu mượn không tồn tại');
  }
  if (loan.status !== 'pending') {
    throw ApiError.badRequest('Chỉ có thể từ chối phiếu mượn ở trạng thái chờ duyệt');
  }

  const trimmedReason = reason.trim();
  loan.status = 'rejected';
  loan.rejectReason = trimmedReason;
  loan.approvedBy = staffId;
  loan.approvedAt = new Date();
  await loan.save();

  // Sau khi từ chối: thông báo độc giả, emit loan:updated, cập nhật staff:counters, ghi audit log
  const readerId = loan.reader.toString();
  await notifyService.notifyUser(readerId, {
    type: 'loan',
    title: 'Yêu cầu mượn sách bị từ chối',
    content: `Yêu cầu mượn sách ${loan.code} của bạn đã bị từ chối. Lý do: ${trimmedReason}`,
    link: `/my/loans/${loan._id}`,
    createdBy: staffId,
  });

  notifyService.emitLoanUpdated(readerId, loan._id.toString(), 'rejected');
  await countersService.emitStaffCounters();

  await auditService.log({
    actor: staffId,
    action: 'loan.reject',
    targetType: 'Loan',
    targetId: loan._id,
    detail: {
      code: loan.code,
      reason: trimmedReason,
    },
    ip: options.ip || null,
  });

  return loan;
}

/**
 * Nhân viên xác nhận giao sách cho độc giả (transaction)
 * Điều kiện:
 * 1. Phiếu mượn phải ở trạng thái approved
 * 2. Cập nhật từng item: status = 'borrowing', borrowDate = now, dueDate = now + loanDays (từ settings, mặc định 14 ngày)
 * 3. Tăng borrowCount của các sách tương ứng (+1)
 * 4. Cập nhật phiếu mượn: status = 'borrowing', handedOverBy = staffId, handedOverAt = now
 * 5. Sau commit: thông báo cho độc giả, emit socket loan:updated, emit staff:counters, ghi audit log
 *
 * @param {string} loanId - ID phiếu mượn
 * @param {string} staffId - ID nhân viên giao sách
 * @param {object} [options] - Tuỳ chọn bổ sung (ip, ...)
 * @returns {Promise<object>} Phiếu mượn sau khi giao sách
 */
async function handoverLoan(loanId, staffId, options = {}) {
  const session = await mongoose.startSession();
  let handedOverLoan;

  try {
    await session.withTransaction(async () => {
      const loan = await Loan.findById(loanId).session(session);
      if (!loan) {
        throw ApiError.notFound('Phiếu mượn không tồn tại');
      }
      if (loan.status !== 'approved') {
        throw ApiError.badRequest('Chỉ có thể giao sách cho phiếu mượn đã được duyệt');
      }

      const settings = await settingsService.getSettings();
      const loanDays = settings.loanDays || 14;
      const now = new Date();
      const dueDate = new Date(now.getTime() + loanDays * 24 * 60 * 60 * 1000);

      for (const item of loan.items) {
        item.status = 'borrowing';
        item.borrowDate = now;
        item.dueDate = dueDate;

        const bookId = item.book && item.book._id ? item.book._id : item.book;
        await Book.findByIdAndUpdate(
          bookId,
          { $inc: { borrowCount: 1 } },
          { session }
        );
      }

      loan.status = 'borrowing';
      loan.handedOverBy = staffId;
      loan.handedOverAt = now;

      await loan.save({ session });
      handedOverLoan = loan;
    });
  } finally {
    await session.endSession();
  }

  // Sau commit: thông báo cho độc giả, emit socket loan:updated, emit staff:counters, ghi audit log
  const readerId = handedOverLoan.reader.toString();
  const firstItemDueDate = handedOverLoan.items[0]?.dueDate;
  const dueDateStr = firstItemDueDate
    ? new Date(firstItemDueDate).toISOString().split('T')[0]
    : '';

  await notifyService.notifyUser(readerId, {
    type: 'loan',
    title: 'Sách đã được giao thành công',
    content: `Phiếu mượn ${handedOverLoan.code} đã được giao. Hạn trả sách là ngày ${dueDateStr}. Chúc bạn đọc sách vui vẻ!`,
    link: `/my/loans/${handedOverLoan._id}`,
    createdBy: staffId,
  });

  notifyService.emitLoanUpdated(readerId, handedOverLoan._id.toString(), 'borrowing');
  await countersService.emitStaffCounters();

  await auditService.log({
    actor: staffId,
    action: 'loan.handover',
    targetType: 'Loan',
    targetId: handedOverLoan._id,
    detail: {
      code: handedOverLoan.code,
      handedOverAt: handedOverLoan.handedOverAt,
      itemsCount: handedOverLoan.items.length,
    },
    ip: options.ip || null,
  });

  return handedOverLoan;
}

/**
 * Nhân viên/Admin lấy danh sách phiếu mượn
 * Hỗ trợ lọc theo trạng thái, độc giả, từ khóa (mã phiếu, tên sách), khoảng thời gian, phân trang.
 *
 * @param {object} query - Tham số truy vấn (status, reader, q, from, to, page, limit, sort)
 * @returns {Promise<{ items: Array, meta: object }>}
 */
async function getAdminLoans(query = {}) {
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  }
  if (query.reader) {
    filter.reader = query.reader;
  }
  if (query.q) {
    const q = query.q.trim();
    const matchingUsers = await User.find(
      {
        $or: [
          { code: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      },
      '_id'
    ).lean();
    const userIds = matchingUsers.map((u) => u._id);

    const orConditions = [
      { code: { $regex: q, $options: 'i' } },
      { 'items.titleSnapshot': { $regex: q, $options: 'i' } },
    ];
    if (userIds.length > 0) {
      orConditions.push({ reader: { $in: userIds } });
    }
    filter.$or = orConditions;
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) {
      filter.createdAt.$gte = new Date(query.from);
    }
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  const { page, limit, skip, sort } = parsePagination(query, {
    defaultLimit: 10,
    defaultSort: '-createdAt',
  });

  const [items, total] = await Promise.all([
    Loan.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('reader', 'code firstName lastName email phone avatar')
      .populate('items.book', 'title slug cover authors authorText price availableCopies')
      .populate('approvedBy', 'code firstName lastName')
      .populate('handedOverBy', 'code firstName lastName')
      .populate('returnedBy', 'code firstName lastName'),
    Loan.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Nhân viên/Admin lấy chi tiết một phiếu mượn theo ID
 *
 * @param {string} loanId - ID phiếu mượn
 * @returns {Promise<object>}
 */
async function getAdminLoanById(loanId) {
  const loan = await Loan.findById(loanId)
    .populate('reader', 'code firstName lastName email phone address avatar status unpaidFineTotal')
    .populate('items.book', 'title slug cover authors authorText price location availableCopies totalCopies')
    .populate('approvedBy', 'code firstName lastName role')
    .populate('handedOverBy', 'code firstName lastName role')
    .populate('returnedBy', 'code firstName lastName role');

  if (!loan) {
    throw ApiError.notFound('Phiếu mượn không tồn tại');
  }

  return loan;
}

module.exports = {
  submitLoan,
  getMyLoans,
  getMyLoanById,
  cancelLoan,
  approveLoan,
  rejectLoan,
  handoverLoan,
  getAdminLoans,
  getAdminLoanById,
};
