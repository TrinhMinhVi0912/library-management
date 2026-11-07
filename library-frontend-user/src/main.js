import { createApp } from 'vue';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'vue-toastification/dist/index.css';
import '@/styles/main.scss';
import App from '@/App.vue';
import router from '@/router';
import { pinia } from '@/stores/pinia';

createApp(App)
  .use(pinia)
  .use(router)
  .mount('#app');
