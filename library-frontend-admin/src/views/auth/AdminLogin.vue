<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const form = ref({ email: '', password: '' });
const submitting = ref(false);
const errorMessage = ref('');
const userAppUrl = import.meta.env.VITE_USER_APP_URL;

async function handleSubmit() {
  if (submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    await auth.login(form.value);
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
      ? route.query.redirect
      : '/admin';
    toast.success('Đăng nhập thành công.');
    await router.replace(redirect);
  } catch (error) {
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message;
    } else if (!error.response || error.code === 'ERR_NETWORK') {
      errorMessage.value = 'Không kết nối được API. Hãy kiểm tra backend đang chạy, VITE_API_URL và cấu hình CORS cho địa chỉ frontend.';
    } else {
      errorMessage.value = 'Không thể đăng nhập. Vui lòng thử lại.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section
      class="login-card surface-card"
      aria-labelledby="login-title"
    >
      <div
        class="login-brand"
        aria-hidden="true"
      >
        <i class="bi bi-book-half" />
      </div>
      <p class="eyebrow">
        HỆ THỐNG THƯ VIỆN
      </p>
      <h1 id="login-title">
        Đăng nhập quản trị
      </h1>
      <p class="intro">
        Dành cho nhân viên và quản trị viên thư viện.
      </p>

      <div
        v-if="errorMessage"
        class="alert alert-danger"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <form
        class="login-form"
        @submit.prevent="handleSubmit"
      >
        <div>
          <label
            class="form-label"
            for="email"
          >Email</label>
          <input
            id="email"
            v-model.trim="form.email"
            class="form-control"
            type="email"
            name="email"
            autocomplete="username"
            required
            maxlength="254"
          >
        </div>
        <div>
          <label
            class="form-label"
            for="password"
          >Mật khẩu</label>
          <input
            id="password"
            v-model="form.password"
            class="form-control"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            maxlength="100"
          >
        </div>
        <button
          class="btn btn-primary w-100"
          type="submit"
          :disabled="submitting"
        >
          <span
            v-if="submitting"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
          {{ submitting ? 'Đang đăng nhập...' : 'Đăng nhập' }}
        </button>
      </form>

      <p
        v-if="userAppUrl"
        class="reader-link"
      >
        Bạn là độc giả?
        <a :href="userAppUrl">Đến website dành cho độc giả</a>
      </p>
    </section>
  </main>
</template>

<style scoped lang="scss">
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 1.25rem;
  background: #f8f9fa;
}

.login-card {
  width: min(100%, 440px);
  padding: clamp(1.4rem, 5vw, 2rem);
}

.login-brand {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 1.5rem;
  place-items: center;
  border-radius: 8px;
  background: #f8f9fa;
  color: #2563eb;
  font-size: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

h1 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 650;
}

.intro {
  margin: 0.55rem 0 1.5rem;
  color: #6b7280;
}

.login-form {
  display: grid;
  gap: 1rem;
}

.reader-link {
  margin: 1.3rem 0 0;
  color: #6b7280;
  font-size: 0.875rem;
  text-align: center;
}

.reader-link a {
  color: #1d4ed8;
  font-weight: 600;
}
</style>
