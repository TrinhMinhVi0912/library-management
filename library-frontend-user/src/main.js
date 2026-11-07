import { createApp } from 'vue';
import Toast from 'vue-toastification';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'vue-toastification/dist/index.css';
import '@/assets/styles/main.scss';
import App from '@/App.vue';
import router from '@/router';
import { pinia } from '@/stores/pinia';

const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(Toast, { position: 'top-right', timeout: 4000 });
app.mount('#app');
