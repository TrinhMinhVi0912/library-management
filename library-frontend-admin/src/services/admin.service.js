import api from '@/services/api.service';

export async function getCounters() {
  const response = await api.get('/admin/counters');
  return response.data?.data || { pendingLoans: 0, pendingRenewals: 0 };
}

export async function getUnreadCount() {
  const response = await api.get('/me/notifications/unread-count');
  return Number(response.data?.data?.unreadCount) || 0;
}

export async function getDashboardSummary() {
  const response = await api.get('/admin/dashboard/summary');
  return response.data?.data || {};
}

export async function getDashboardCharts(range = '30d') {
  const response = await api.get('/admin/dashboard/charts', { params: { range } });
  return response.data?.data || {};
}

export async function getAdminLoans(params = {}) {
  const response = await api.get('/admin/loans', { params });
  return response.data || {};
}

export async function getAdminLoan(id) {
  const response = await api.get(`/admin/loans/${id}`);
  return response.data?.data || null;
}

export async function approveLoan(id) {
  const response = await api.post(`/admin/loans/${id}/approve`);
  return response.data?.data || null;
}

export async function rejectLoan(id, reason) {
  const response = await api.post(`/admin/loans/${id}/reject`, { reason });
  return response.data?.data || null;
}

export async function handoverLoan(id) {
  const response = await api.post(`/admin/loans/${id}/handover`);
  return response.data?.data || null;
}

export async function getLoanReturnPolicy() {
  const response = await api.get('/admin/loan-return-policy');
  return response.data?.data || null;
}

export async function returnLoan(id, items) {
  const response = await api.post(`/admin/loans/${id}/return`, { items });
  return response.data?.data || null;
}

export async function getAdminBook(id) {
  const response = await api.get(`/admin/books/${id}`);
  return response.data?.data || null;
}

export async function exportLoansReport(params = {}) {
  const response = await api.get('/admin/reports/loans.xlsx', {
    params,
    responseType: 'blob',
  });
  return response.data;
}
