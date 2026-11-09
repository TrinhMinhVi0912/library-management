<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Form, Field } from 'vee-validate';
import * as yup from 'yup';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const REMEMBERED_EMAIL_KEY = 'library-user-remembered-email';
const loginSchema = yup.object({
  email: yup.string().trim().email('Nhập email hợp lệ').required('Email là bắt buộc'),
  password: yup.string().required('Mật khẩu là bắt buộc'),
});

function getRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

const rememberedEmail = getRememberedEmail();
const rememberEmail = ref(Boolean(rememberedEmail));
const formError = ref('');
const googleError = ref('');
const googleButton = ref(null);
const googleBusy = ref(false);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
let isUnmounted = false;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-google-identity-services]');
    const onLoad = () => (window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services không sẵn sàng.')));
    const onError = () => reject(new Error('Không tải được dịch vụ đăng nhập Google.'));

    if (script) {
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      return;
    }

    script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentityServices = 'true';
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });
}

function formatApiError(error) {
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || (error.response ? 'Đăng nhập chưa thành công. Vui lòng kiểm tra thông tin.' : 'Không kết nối được máy chủ. Hãy thử lại sau.');
}

function getSafeRedirect() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : { name: 'home' };
}

async function handleGoogleCredential(response) {
  if (isUnmounted || !response?.credential || googleBusy.value) return;
  googleBusy.value = true;
  googleError.value = '';

  try {
    const user = await auth.loginWithGoogle(response.credential);
    if (user?.role !== 'reader') {
      try {
        await auth.logout();
      } catch {
        auth.clearSession();
      }
      googleError.value = 'Tài khoản nhân viên hoặc quản trị viên cần đăng nhập tại website quản trị.';
      return;
    }
    await router.replace(getSafeRedirect());
  } catch (error) {
    googleError.value = formatApiError(error);
  } finally {
    googleBusy.value = false;
  }
}

onMounted(async () => {
  if (!googleClientId) {
    googleError.value = 'Đăng nhập Google chưa được cấu hình. Vui lòng dùng email và mật khẩu.';
    return;
  }

  try {
    await loadGoogleIdentityServices();
    if (isUnmounted || !googleButton.value) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleButton.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rect',
      width: Math.min(400, Math.floor(googleButton.value.clientWidth || 400)),
      logo_alignment: 'left',
    });
  } catch {
    if (!isUnmounted) googleError.value = 'Không tải được dịch vụ Google. Hãy kiểm tra kết nối mạng rồi thử lại.';
  }
});

onBeforeUnmount(() => {
  isUnmounted = true;
});

async function submit(values) {
  formError.value = '';
  try {
    const user = await auth.login({ email: values.email.trim(), password: values.password });
    if (user?.role !== 'reader') {
      try {
        await auth.logout();
      } catch {
        auth.clearSession();
      }
      formError.value = 'Tài khoản nhân viên hoặc quản trị viên cần đăng nhập tại website quản trị.';
      return;
    }

    try {
      if (rememberEmail.value) localStorage.setItem(REMEMBERED_EMAIL_KEY, values.email.trim());
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Keep successful sign-in working when browser storage is unavailable.
    }
    await router.replace(getSafeRedirect());
  } catch (error) {
    formError.value = formatApiError(error);
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <div
        class="auth-brand-mark mb-4"
        aria-hidden="true"
      >
        <i class="bi bi-book-half" />
      </div>
      <p class="text-uppercase text-secondary small fw-semibold mb-2">
        Thư viện trực tuyến
      </p>
      <h1 class="h2 fw-bold mb-2">
        Đăng nhập
      </h1>
      <p class="text-secondary mb-4">
        Đăng nhập để quản lý giỏ mượn và hoạt động thư viện của bạn.
      </p>

      <div
        v-if="formError"
        class="alert alert-danger"
        role="alert"
      >
        {{ formError }}
      </div>

      <Form
        v-slot="{ isSubmitting }"
        :validation-schema="loginSchema"
        :initial-values="{ email: rememberedEmail, password: '' }"
        @submit="submit"
      >
        <Field
          v-slot="{ field, errorMessage: fieldError }"
          name="email"
        >
          <div class="mb-3">
            <label
              class="form-label"
              for="login-email"
            >Email</label>
            <input
              id="login-email"
              v-bind="field"
              class="form-control"
              :class="{ 'is-invalid': fieldError }"
              type="email"
              autocomplete="email"
              inputmode="email"
              required
            >
            <div
              v-if="fieldError"
              class="invalid-feedback"
            >
              {{ fieldError }}
            </div>
          </div>
        </Field>

        <Field
          v-slot="{ field, errorMessage: fieldError }"
          name="password"
        >
          <div class="mb-3">
            <label
              class="form-label"
              for="login-password"
            >Mật khẩu</label>
            <input
              id="login-password"
              v-bind="field"
              class="form-control"
              :class="{ 'is-invalid': fieldError }"
              type="password"
              autocomplete="current-password"
              required
            >
            <div
              v-if="fieldError"
              class="invalid-feedback"
            >
              {{ fieldError }}
            </div>
          </div>
        </Field>

        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
          <label class="form-check d-flex align-items-center gap-2 mb-0">
            <input
              v-model="rememberEmail"
              class="form-check-input mt-0"
              type="checkbox"
            >
            <span class="form-check-label">Ghi nhớ email trên thiết bị này</span>
          </label>
          <RouterLink :to="{ name: 'forgot-password' }">
            Quên mật khẩu?
          </RouterLink>
        </div>

        <button
          class="btn btn-primary w-100"
          type="submit"
          :disabled="isSubmitting"
        >
          <span
            v-if="isSubmitting"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Đăng nhập
        </button>
      </Form>

      <div
        class="auth-google-separator"
        aria-hidden="true"
      >
        <span>hoặc</span>
      </div>

      <div class="auth-google-login">
        <div
          ref="googleButton"
          class="auth-google-login__button"
          :class="{ 'auth-google-login__button--busy': googleBusy }"
          aria-label="Tiếp tục bằng Google"
        />
        <p class="small text-secondary text-center mt-2 mb-0">
          Đóng cửa sổ Google để quay lại đăng nhập bằng email và mật khẩu.
        </p>
        <p
          v-if="googleBusy"
          class="small text-secondary text-center mt-2 mb-0"
          role="status"
          aria-live="polite"
        >
          <span
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Đang xác minh tài khoản Google…
        </p>
        <div
          v-if="googleError"
          class="alert alert-warning mt-3 mb-0"
          role="alert"
        >
          {{ googleError }}
        </div>
      </div>

      <p class="text-center text-secondary mt-4 mb-0">
        Chưa có tài khoản?
        <RouterLink
          :to="{ name: 'register' }"
          class="fw-semibold"
        >
          Đăng ký
        </RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.auth-google-separator {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.25rem 0;
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
}

.auth-google-separator::before,
.auth-google-separator::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--bs-border-color);
}

.auth-google-login__button {
  display: flex;
  justify-content: center;
  min-height: 40px;
}

.auth-google-login__button--busy {
  opacity: 0.65;
  pointer-events: none;
}
</style>
