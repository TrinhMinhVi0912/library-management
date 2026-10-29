const { Loan, RenewalRequest } = require('../models');
const notifyService = require('./notify.service');

/**
 * Đếm số lượng phiếu mượn và yêu cầu gia hạn đang chờ nhân viên xử lý
 * @returns {Promise<{ pendingLoans: number, pendingRenewals: number }>}
 */
async function getCounters() {
  const [pendingLoans, pendingRenewals] = await Promise.all([
    Loan.countDocuments({ status: 'pending' }),
    RenewalRequest.countDocuments({ status: 'pending' }),
  ]);

  return {
    pendingLoans,
    pendingRenewals,
  };
}

/**
 * Phát sự kiện cập nhật số đếm tới tất cả nhân viên (role:staff)
 * @returns {Promise<{ pendingLoans: number, pendingRenewals: number }>}
 */
async function emitStaffCounters() {
  const counters = await getCounters();
  notifyService.emit('role:staff', 'staff:counters', counters);
  return counters;
}

module.exports = {
  getCounters,
  emitStaffCounters,
};

