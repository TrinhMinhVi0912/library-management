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

export async function getAdminRenewals(params = {}) {
  const response = await api.get('/admin/renewals', { params });
  return response.data || {};
}

export async function approveRenewal(id) {
  const response = await api.post(`/admin/renewals/${id}/approve`);
  return response.data?.data || null;
}

export async function rejectRenewal(id, reason) {
  const response = await api.post(`/admin/renewals/${id}/reject`, { reason });
  return response.data?.data || null;
}

export async function exportLoansReport(params = {}) {
  const response = await api.get('/admin/reports/loans.xlsx', {
    params,
    responseType: 'blob',
  });
  return response.data;
}

export async function getAdminFines(params = {}) {
  const response = await api.get('/admin/fines', { params });
  return response.data || {};
}

export async function createManualFine(data) {
  const response = await api.post('/admin/fines', data);
  return response.data?.data || null;
}

export async function payFine(id) {
  const response = await api.patch(`/admin/fines/${id}/pay`);
  return response.data?.data || null;
}

export async function waiveFine(id, reason) {
  const response = await api.patch(`/admin/fines/${id}/waive`, { reason });
  return response.data?.data || null;
}

export async function searchAdminReaders(q) {
  const response = await api.get('/admin/users', { params: { role: 'reader', q, limit: 10 } });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function getAdminBooks(params = {}) {
  const response = await api.get('/admin/books', { params });
  return response.data || {};
}

export async function createAdminBook(data) {
  const response = await api.post('/admin/books', data);
  return response.data?.data || null;
}

export async function updateAdminBook(id, data) {
  const response = await api.patch(`/admin/books/${id}`, data);
  return response.data?.data || null;
}

export async function updateAdminBookStatus(id, status) {
  const response = await api.patch(`/admin/books/${id}/status`, { status });
  return response.data?.data || null;
}

export async function deleteAdminBook(id) {
  const response = await api.delete(`/admin/books/${id}`);
  return response.data?.data || null;
}

export async function getCatalogOptions() {
  const [categories, authors, publishers] = await Promise.all([
    api.get('/categories', { params: { all: true } }),
    api.get('/authors', { params: { all: true } }),
    api.get('/publishers', { params: { all: true } }),
  ]);
  return {
    categories: categories.data?.data || [],
    authors: authors.data?.data || [],
    publishers: publishers.data?.data || [],
  };
}

export async function createAdminAuthor(data) {
  const response = await api.post('/admin/authors', data);
  return response.data?.data || null;
}

export async function createAdminCategory(data) {
  const response = await api.post('/admin/categories', data);
  return response.data?.data || null;
}

const catalogEndpoints = {
  publishers: '/admin/publishers',
  authors: '/admin/authors',
  categories: '/admin/categories',
};

export async function getAdminCatalogItems(type, params = {}) {
  const response = await api.get(catalogEndpoints[type], { params });
  return response.data || {};
}

export async function createAdminCatalogItem(type, data) {
  const response = await api.post(catalogEndpoints[type], data);
  return response.data?.data || null;
}

export async function updateAdminCatalogItem(type, id, data) {
  const response = await api.patch(`${catalogEndpoints[type]}/${id}`, data);
  return response.data?.data || null;
}

export async function deleteAdminCatalogItem(type, id) {
  const response = await api.delete(`${catalogEndpoints[type]}/${id}`);
  return response.data?.data || null;
}

export async function getAdminUsers(params = {}) {
  const response = await api.get('/admin/users', { params });
  return response.data || {};
}

export async function getAdminUser(id) {
  const response = await api.get(`/admin/users/${id}`);
  return response.data?.data || null;
}

export async function lockAdminUser(id, reason) {
  const response = await api.patch(`/admin/users/${id}/lock`, { reason });
  return response.data?.data || null;
}

export async function unlockAdminUser(id) {
  const response = await api.patch(`/admin/users/${id}/unlock`);
  return response.data?.data || null;
}

export async function requestAdminPasswordReset(id) {
  const response = await api.post(`/admin/users/${id}/password-reset`);
  return response.data?.data || null;
}

export async function createAdminStaff(data) {
  const response = await api.post('/admin/users', data);
  return response.data?.data || null;
}

export async function updateAdminUserRole(id, role) {
  const response = await api.patch(`/admin/users/${id}/role`, { role });
  return response.data?.data || null;
}

export async function getAdminNotifications(params = {}) {
  const response = await api.get('/admin/notifications', { params });
  return response.data || {};
}

export async function createAdminNotification(data) {
  const response = await api.post('/admin/notifications', data);
  return response.data?.data || null;
}

export async function updateAdminNotification(id, data) {
  const response = await api.patch(`/admin/notifications/${id}`, data);
  return response.data?.data || null;
}

export async function deleteAdminNotification(id) {
  const response = await api.delete(`/admin/notifications/${id}`);
  return response.data?.data || null;
}

export async function findAdminNotificationRecipients(q) {
  const response = await api.get('/admin/users', { params: { q, limit: 10 } });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function uploadAdminImage(file, folder = 'books') {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/admin/uploads', formData, {
    params: { folder },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data || null;
}
