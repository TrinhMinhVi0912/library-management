import { createRouter, createWebHistory } from 'vue-router';

const EmptyPage = () => null;

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: EmptyPage },
    { path: '/login', name: 'login', component: EmptyPage },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

if (import.meta.env.DEV) {
  router.addRoute({
    path: '/dev/components',
    name: 'dev-components',
    component: () => import('@/views/dev/ComponentPlayground.vue'),
  });
}

export default router;
