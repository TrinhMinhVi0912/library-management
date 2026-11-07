import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { pinia } from '@/stores/pinia';
import AdminLayout from '@/layouts/AdminLayout.vue';
import AdminLogin from '@/views/auth/AdminLogin.vue';
import AdminPlaceholder from '@/views/admin/AdminPlaceholder.vue';
import AdminDashboard from '@/views/admin/Dashboard.vue';
import AdminRequests from '@/views/admin/Requests.vue';
import AdminHandover from '@/views/admin/Handover.vue';
import AdminReturns from '@/views/admin/Returns.vue';
import AdminRenewals from '@/views/admin/Renewals.vue';
import AdminLoans from '@/views/admin/Loans.vue';
import AdminFines from '@/views/admin/Fines.vue';
import AdminBooks from '@/views/admin/Books.vue';
import AdminCatalog from '@/views/admin/Catalog.vue';
import AdminUsers from '@/views/admin/Users.vue';
import AdminNotifications from '@/views/admin/Notifications.vue';
import AdminSettings from '@/views/admin/Settings.vue';
import AdminAuditLogs from '@/views/admin/AuditLogs.vue';
import Forbidden from '@/views/Forbidden.vue';
import NotFound from '@/views/NotFound.vue';

const section = (path, name, title, roles = ['staff', 'admin']) => ({
  path,
  name,
  component: AdminPlaceholder,
  meta: { title, roles },
});

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/admin' },
    { path: '/login', name: 'admin-login', component: AdminLogin, meta: { guestOnly: true, title: 'Đăng nhập quản trị' } },
    { path: '/403', name: 'admin-forbidden', component: Forbidden, meta: { title: 'Không có quyền truy cập' } },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, roles: ['staff', 'admin'] },
      children: [
        { path: '', name: 'admin-dashboard', component: AdminDashboard, meta: { title: 'Tổng quan', roles: ['staff', 'admin'] } },
        { path: 'requests', name: 'admin-requests', component: AdminRequests, meta: { title: 'Duyệt yêu cầu mượn', roles: ['staff', 'admin'] } },
        { path: 'handover', name: 'admin-handover', component: AdminHandover, meta: { title: 'Giao sách', roles: ['staff', 'admin'] } },
        { path: 'returns', name: 'admin-returns', component: AdminReturns, meta: { title: 'Nhận trả sách', roles: ['staff', 'admin'] } },
        { path: 'renewals', name: 'admin-renewals', component: AdminRenewals, meta: { title: 'Duyệt gia hạn', roles: ['staff', 'admin'] } },
        { path: 'loans', name: 'admin-loans', component: AdminLoans, meta: { title: 'Phiếu mượn', roles: ['staff', 'admin'] } },
        { path: 'fines', name: 'admin-fines', component: AdminFines, meta: { title: 'Quản lý phạt', roles: ['staff', 'admin'] } },
        { path: 'books', name: 'admin-books', component: AdminBooks, meta: { title: 'Quản lý sách', roles: ['staff', 'admin'] } },
        { path: 'catalog', name: 'admin-catalog', component: AdminCatalog, meta: { title: 'Danh mục', roles: ['staff', 'admin'] } },
        { path: 'users', name: 'admin-users', component: AdminUsers, meta: { title: 'Người dùng', roles: ['staff', 'admin'] } },
        { path: 'notifications', name: 'admin-notifications', component: AdminNotifications, meta: { title: 'Thông báo', roles: ['staff', 'admin'] } },
        section('forum', 'admin-forum', 'Kiểm duyệt diễn đàn'),
        section('staff', 'admin-staff', 'Quản lý nhân viên', ['admin']),
        { path: 'settings', name: 'admin-settings', component: AdminSettings, meta: { title: 'Cài đặt', roles: ['admin'] } },
        { path: 'audit-logs', name: 'admin-audit-logs', component: AdminAuditLogs, meta: { title: 'Nhật ký hệ thống', roles: ['admin'] } },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound, meta: { title: 'Không tìm thấy trang' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (to.meta.requiresAuth && !auth.initialized) {
    await auth.restoreSession();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    if (auth.rejectedReader) return { name: 'admin-forbidden' };
    return { name: 'admin-login', query: { redirect: to.fullPath } };
  }

  if (to.meta.roles?.length && !to.meta.roles.includes(auth.user?.role)) {
    return { name: 'admin-forbidden' };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'admin-dashboard' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Quản trị thư viện` : 'Quản trị thư viện';
});

export default router;
