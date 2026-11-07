import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { pinia } from '@/stores/pinia';
import PublicLayout from '@/layouts/PublicLayout.vue';
import PlaceholderPage from '@/views/public/PlaceholderPage.vue';
import Forbidden from '@/views/Forbidden.vue';
import NotFound from '@/views/NotFound.vue';

const placeholderRoute = (path, name, title, meta = {}) => ({
  path,
  name,
  component: PlaceholderPage,
  meta: { title, ...meta },
});

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: PublicLayout,
      children: [
        placeholderRoute('', 'home', 'Trang chủ'),
        placeholderRoute('books', 'books', 'Danh mục sách'),
        placeholderRoute('books/:slug', 'book-detail', 'Chi tiết sách'),
        placeholderRoute('authors/:id', 'author-detail', 'Tác giả'),
        placeholderRoute('login', 'login', 'Đăng nhập', { guestOnly: true }),
        placeholderRoute('register', 'register', 'Đăng ký', { guestOnly: true }),
        placeholderRoute('forgot-password', 'forgot-password', 'Quên mật khẩu', { guestOnly: true }),
        placeholderRoute('reset-password/:token', 'reset-password', 'Đặt lại mật khẩu', { guestOnly: true }),
        placeholderRoute('forum', 'forum', 'Diễn đàn'),
        placeholderRoute('forum/c/:slug', 'forum-category', 'Chuyên mục diễn đàn'),
        placeholderRoute('forum/t/:slug', 'forum-thread', 'Chủ đề diễn đàn'),
        placeholderRoute('about', 'about', 'Giới thiệu'),
        { path: '404', name: 'not-found', component: NotFound, meta: { title: 'Không tìm thấy trang' } },
        { path: '403', name: 'forbidden', component: Forbidden, meta: { title: 'Không có quyền truy cập' } },
        placeholderRoute('cart', 'cart', 'Giỏ mượn', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/loans', 'my-loans', 'Lịch sử mượn', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/fines', 'my-fines', 'Phạt của tôi', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/shelves', 'my-shelves', 'Kệ sách của tôi', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/reviews', 'my-reviews', 'Đánh giá của tôi', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/reservations', 'my-reservations', 'Sách đặt trước', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('notifications', 'notifications', 'Thông báo', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('profile', 'profile', 'Hồ sơ', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('forum/new', 'forum-new', 'Tạo chủ đề', { requiresAuth: true, roles: ['reader'] }),
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'not-found' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

if (import.meta.env.DEV) {
  router.addRoute({
    path: '/dev/components',
    name: 'dev-components',
    component: () => import('@/views/dev/ComponentPlayground.vue'),
    meta: { skipSessionRestore: true },
  });
}

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (!to.meta.skipSessionRestore && !auth.initialized && (to.meta.requiresAuth || to.meta.guestOnly)) {
    await auth.restoreSession();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.roles?.length && !to.meta.roles.includes(auth.role)) {
    return { name: 'forbidden' };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '';
    return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : { name: 'home' };
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Thư viện trực tuyến` : 'Thư viện trực tuyến';
});

export default router;
