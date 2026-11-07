import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { pinia } from '@/stores/pinia';
import PublicLayout from '@/layouts/PublicLayout.vue';
import PlaceholderPage from '@/views/public/PlaceholderPage.vue';
import Forbidden from '@/views/Forbidden.vue';
import NotFound from '@/views/NotFound.vue';
import Login from '@/views/public/Login.vue';
import Register from '@/views/public/Register.vue';
import ForgotPassword from '@/views/public/ForgotPassword.vue';
import ResetPassword from '@/views/public/ResetPassword.vue';
import Home from '@/views/public/Home.vue';
import BookList from '@/views/public/BookList.vue';
import BookDetail from '@/views/public/BookDetail.vue';
import Author from '@/views/public/Author.vue';
import Cart from '@/views/reader/Cart.vue';
import MyLoans from '@/views/reader/MyLoans.vue';
import MyFines from '@/views/reader/MyFines.vue';
import Profile from '@/views/reader/Profile.vue';

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
        { path: '', name: 'home', component: Home, meta: { title: 'Trang chủ' } },
        { path: 'books', name: 'books', component: BookList, meta: { title: 'Danh mục sách' } },
        { path: 'books/:slug', name: 'book-detail', component: BookDetail, meta: { title: 'Chi tiết sách' } },
        { path: 'authors/:id', name: 'author-detail', component: Author, meta: { title: 'Tác giả' } },
        { path: 'login', name: 'login', component: Login, meta: { title: 'Đăng nhập', guestOnly: true } },
        { path: 'register', name: 'register', component: Register, meta: { title: 'Đăng ký', guestOnly: true } },
        { path: 'forgot-password', name: 'forgot-password', component: ForgotPassword, meta: { title: 'Quên mật khẩu', guestOnly: true } },
        { path: 'reset-password/:token', name: 'reset-password', component: ResetPassword, meta: { title: 'Đặt lại mật khẩu', guestOnly: true } },
        placeholderRoute('forum', 'forum', 'Diễn đàn'),
        placeholderRoute('forum/c/:slug', 'forum-category', 'Chuyên mục diễn đàn'),
        placeholderRoute('forum/t/:slug', 'forum-thread', 'Chủ đề diễn đàn'),
        placeholderRoute('about', 'about', 'Giới thiệu'),
        { path: '404', name: 'not-found', component: NotFound, meta: { title: 'Không tìm thấy trang' } },
        { path: '403', name: 'forbidden', component: Forbidden, meta: { title: 'Không có quyền truy cập' } },
        { path: 'cart', name: 'cart', component: Cart, meta: { title: 'Giỏ mượn sách', requiresAuth: true, roles: ['reader'] } },
        { path: 'my/loans', name: 'my-loans', component: MyLoans, meta: { title: 'Lịch sử mượn', requiresAuth: true, roles: ['reader'] } },
        { path: 'my/fines', name: 'my-fines', component: MyFines, meta: { title: 'Phạt của tôi', requiresAuth: true, roles: ['reader'] } },
        placeholderRoute('my/shelves', 'my-shelves', 'Kệ sách của tôi', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/reviews', 'my-reviews', 'Đánh giá của tôi', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('my/reservations', 'my-reservations', 'Sách đặt trước', { requiresAuth: true, roles: ['reader'] }),
        placeholderRoute('notifications', 'notifications', 'Thông báo', { requiresAuth: true, roles: ['reader'] }),
        { path: 'profile', name: 'profile', component: Profile, meta: { title: 'Hồ sơ', requiresAuth: true, roles: ['reader'] } },
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
  router.addRoute({
    path: '/dev/books',
    name: 'dev-book-components',
    component: () => import('@/views/dev/BookComponentsPlayground.vue'),
    meta: { title: 'Thử component sách', skipSessionRestore: true },
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
