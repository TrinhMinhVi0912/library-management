import { createApp } from 'vue';
import Toast from 'vue-toastification';
import { useToast } from 'vue-toastification';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'vue-toastification/dist/index.css';
import '@/assets/styles/main.scss';
import App from '@/App.vue';
import router from '@/router';
import { pinia } from '@/stores/pinia';
import { useAuthStore } from '@/stores/auth.store';
import { configureApiAuth } from '@/services/api.service';

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(Toast, { position: 'top-right', timeout: 4000 });

const auth = useAuthStore(pinia);
const toast = useToast();
configureApiAuth({
  getAccessToken: () => auth.accessToken,
  refreshAccessToken: () => auth.refresh(),
  onUnauthorized: () => {
    auth.clearSession();
    if (router.currentRoute.value.name !== 'login') {
      router.replace({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
  },
  notifyError: (message) => toast.error(message),
});

app.mount('#app');
