<script setup>
import { ref } from 'vue';
import { Form, Field } from 'vee-validate';
import * as yup from 'yup';
import authService from '@/services/auth.service';

const success = ref(false);
const formError = ref('');
const schema = yup.object({
  code: yup.string().trim().length(32, 'Mã khôi phục không hợp lệ').matches(/^[\da-f]+$/i, 'Mã khôi phục không hợp lệ').required('Mã khôi phục là bắt buộc'),
  newPassword: yup.string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu không được vượt quá 100 ký tự')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/, 'Mật khẩu phải có ít nhất một chữ cái và một chữ số')
    .required('Mật khẩu mới là bắt buộc'),
  confirmPassword: yup.string().oneOf([yup.ref('newPassword')], 'Mật khẩu nhập lại không khớp').required('Vui lòng nhập lại mật khẩu'),
});

function formatApiError(error) {
  return error.response?.data?.errors?.[0]?.message
    || error.response?.data?.message
    || (error.response ? 'Không thể đặt lại mật khẩu. Mã có thể đã hết hạn hoặc được sử dụng.' : 'Không kết nối được máy chủ. Hãy thử lại sau.');
}

async function submit(values) {
  formError.value = '';
  try {
    await authService.resetPassword(values.code.trim(), values.newPassword);
    success.value = true;
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
        <i class="bi bi-shield-lock" />
      </div>
      <template v-if="success">
        <p class="text-uppercase text-secondary small fw-semibold mb-2">
          Bảo mật tài khoản
        </p>
        <h1 class="h2 fw-bold mb-2">
          Đã đổi mật khẩu
        </h1>
        <p class="text-secondary">
          Bạn có thể đăng nhập bằng mật khẩu mới.
        </p>
        <RouterLink
          class="btn btn-primary w-100 mt-3"
          :to="{ name: 'login' }"
        >
          Đến trang đăng nhập
        </RouterLink>
      </template>
      <template v-else>
        <p class="text-uppercase text-secondary small fw-semibold mb-2">
          Bảo mật tài khoản
        </p>
        <h1 class="h2 fw-bold mb-2">
          Đặt mật khẩu mới
        </h1>
        <p class="text-secondary mb-4">
          Nhập mã do nhân viên cấp, sau đó tạo mật khẩu mới gồm ít nhất 8 ký tự, có chữ cái và chữ số.
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
          :validation-schema="schema"
          @submit="submit"
        >
          <Field
            v-slot="{ field, errorMessage: fieldError }"
            name="code"
          >
            <div class="mb-3">
              <label
                class="form-label"
                for="reset-code"
              >Mã khôi phục</label>
              <input
                id="reset-code"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': fieldError }"
                type="text"
                autocomplete="one-time-code"
                maxlength="32"
                spellcheck="false"
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
            name="newPassword"
          >
            <div class="mb-3">
              <label
                class="form-label"
                for="reset-password"
              >Mật khẩu mới</label>
              <input
                id="reset-password"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': fieldError }"
                type="password"
                autocomplete="new-password"
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
            name="confirmPassword"
          >
            <div class="mb-4">
              <label
                class="form-label"
                for="reset-confirm-password"
              >Nhập lại mật khẩu mới</label>
              <input
                id="reset-confirm-password"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': fieldError }"
                type="password"
                autocomplete="new-password"
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
            Đặt lại mật khẩu
          </button>
        </Form>
      </template>
    </div>
  </section>
</template>
