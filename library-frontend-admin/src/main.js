import { createApp } from 'vue';
import Toast from 'vue-toastification';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'vue-toastification/dist/index.css';
import '@/styles/main.scss';
import App from '@/App.vue';
import router from '@/router';
import { pinia } from '@/stores/pinia';
import { useAuthStore } from '@/stores/auth.store';
import { configureApiAuth } from '@/services/api.service';
import { configureSocketAuth } from '@/services/socket.service';

const app = createApp(App);
app.use(pinia);
app.use(Toast, { position: 'top-right', timeout: 4000 });

const auth = useAuthStore(pinia);
configureApiAuth({
  getAccessToken: () => auth.accessToken,
  refreshAccessToken: () => auth.refreshSession(),
  onUnauthorized: () => {
    auth.clearSession();
    const target = auth.rejectedReader ? { name: 'admin-forbidden' } : {
      name: 'admin-login',
      query: { redirect: router.currentRoute.value.fullPath },
    };
    router.replace(target);
  },
});
configureSocketAuth({
  getToken: () => auth.accessToken,
  refreshToken: () => auth.refreshSession(),
});

app.use(router);
app.mount('#app');
