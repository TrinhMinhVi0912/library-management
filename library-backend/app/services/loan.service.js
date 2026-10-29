const mongoose = require('mongoose');
const ApiError = require('../api-error');
const { Loan, Book, User, Cart } = require('../models');
const settingsService = require('./settings.service');
const notifyService = require('./notify.service');
const countersService = require('./counters.service');
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

module.exports = {
  submitLoan,
  getMyLoans,
  getMyLoanById,
  cancelLoan,
};
