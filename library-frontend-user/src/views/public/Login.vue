<script setup>
import { ref } from 'vue';
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
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

function formatApiError(error) {
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || (error.response ? 'Đăng nhập chưa thành công. Vui lòng kiểm tra thông tin.' : 'Không kết nối được máy chủ. Hãy thử lại sau.');
}

function getSafeRedirect() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : { name: 'home' };
}

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
