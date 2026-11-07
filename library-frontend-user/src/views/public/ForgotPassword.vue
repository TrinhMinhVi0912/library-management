<script setup>
import { ref } from 'vue';
import { Form, Field } from 'vee-validate';
import * as yup from 'yup';
import authService from '@/services/auth.service';

const schema = yup.object({
  email: yup.string().trim().email('Nhập email hợp lệ').required('Email là bắt buộc'),
});
const message = ref('');
const formError = ref('');

function formatApiError(error) {
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || (error.response ? 'Chưa thể gửi yêu cầu. Vui lòng thử lại.' : 'Không kết nối được máy chủ. Hãy thử lại sau.');
}

async function submit(values) {
  message.value = '';
  formError.value = '';
  try {
    await authService.forgotPassword(values.email.trim());
    message.value = 'Nếu email thuộc một tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư đó.';
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
        <i class="bi bi-key" />
      </div>
      <p class="text-uppercase text-secondary small fw-semibold mb-2">
        Khôi phục tài khoản
      </p>
      <h1 class="h2 fw-bold mb-2">
        Quên mật khẩu?
      </h1>
      <p class="text-secondary mb-4">
        Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.
      </p>

      <div
        v-if="message"
        class="alert alert-success"
        role="status"
      >
        {{ message }}
      </div>
      <div
        v-if="formError"
        class="alert alert-danger"
        role="alert"
      >
        {{ formError }}
      </div>

      <Form
        v-slot="{ isSubmitting }"
        :validation-schema="schema"
        @submit="submit"
      >
        <Field
          v-slot="{ field, errorMessage: fieldError }"
          name="email"
        >
          <div class="mb-4">
            <label
              class="form-label"
              for="forgot-email"
            >Email</label>
            <input
              id="forgot-email"
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
          Gửi hướng dẫn
        </button>
      </Form>

      <p class="text-center mt-4 mb-0">
        <RouterLink :to="{ name: 'login' }">
          <i
            class="bi bi-arrow-left me-1"
            aria-hidden="true"
          />Quay lại đăng nhập
        </RouterLink>
      </p>
    </div>
  </section>
</template>
