<script setup>
import { computed, ref } from 'vue';
import { Form, Field } from 'vee-validate';
import * as yup from 'yup';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const registerSchema = yup.object({
  firstName: yup.string().trim().min(1, 'Họ lót là bắt buộc').max(50, 'Họ lót tối đa 50 ký tự').required('Họ lót là bắt buộc'),
  lastName: yup.string().trim().min(1, 'Tên là bắt buộc').max(50, 'Tên tối đa 50 ký tự').required('Tên là bắt buộc'),
  email: yup.string().trim().email('Email không đúng định dạng').required('Email là bắt buộc'),
  password: yup.string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(100, 'Mật khẩu không được vượt quá 100 ký tự')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/, 'Mật khẩu phải có ít nhất một chữ cái và một chữ số')
    .required('Mật khẩu là bắt buộc'),
  birthDate: yup.date().nullable().transform((value, originalValue) => (originalValue === '' ? null : value)),
  gender: yup.string().oneOf(['', 'male', 'female', 'other']).nullable(),
  address: yup.string().trim().max(255, 'Địa chỉ tối đa 255 ký tự').nullable(),
  phone: yup.string()
    .test('phone-format', 'Số điện thoại không đúng định dạng', (value) => !value || /^[0-9+() -]{8,20}$/.test(value))
    .nullable(),
});

const password = ref('');
const formError = ref('');
const router = useRouter();
const auth = useAuthStore();
const strengthChecks = computed(() => [
  password.value.length >= 8,
  /[A-Za-z]/.test(password.value) && /\d/.test(password.value),
  password.value.length >= 12 || /[^A-Za-z0-9]/.test(password.value),
]);
const strength = computed(() => strengthChecks.value.filter(Boolean).length);
const strengthLabel = computed(() => ['Chưa nhập mật khẩu', 'Yếu', 'Đạt yêu cầu', 'Mạnh'][strength.value]);
const strengthColor = computed(() => ['#e5e7eb', '#dc2626', '#f59e0b', '#16a34a'][strength.value]);

function apiErrorMessage(error) {
  return error.response?.data?.message
    || (error.response ? 'Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.' : 'Không kết nối được máy chủ. Hãy thử lại sau.');
}

async function submit(values, { setFieldError }) {
  formError.value = '';
  const payload = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    password: values.password,
    birthDate: values.birthDate || null,
    gender: values.gender || null,
    address: values.address?.trim() || null,
    phone: values.phone?.trim() || null,
  };

  try {
    const user = await auth.register(payload);
    if (user?.role !== 'reader') {
      try {
        await auth.logout();
      } catch {
        auth.clearSession();
      }
      formError.value = 'Tài khoản nhân viên hoặc quản trị viên cần đăng nhập tại website quản trị.';
      return;
    }
    await router.replace({ name: 'home' });
  } catch (error) {
    const backendErrors = error.response?.data?.errors || [];
    backendErrors.forEach(({ field, message }) => {
      if (field && message) setFieldError(field, message);
    });
    formError.value = apiErrorMessage(error);
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
        Tạo tài khoản độc giả
      </h1>
      <p class="text-secondary mb-4">
        Đăng ký để khám phá và mượn sách tại thư viện.
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
        :validation-schema="registerSchema"
        @submit="submit"
      >
        <div class="row g-3">
          <Field
            v-slot="{ field, errorMessage }"
            name="firstName"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-first-name"
              >Họ lót <span class="text-danger">*</span></label>
              <input
                id="register-first-name"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                autocomplete="given-name"
                maxlength="50"
                required
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="lastName"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-last-name"
              >Tên <span class="text-danger">*</span></label>
              <input
                id="register-last-name"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                autocomplete="family-name"
                maxlength="50"
                required
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="email"
          >
            <div class="col-12">
              <label
                class="form-label"
                for="register-email"
              >Email <span class="text-danger">*</span></label>
              <input
                id="register-email"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                type="email"
                autocomplete="email"
                inputmode="email"
                required
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="password"
          >
            <div class="col-12">
              <label
                class="form-label"
                for="register-password"
              >Mật khẩu <span class="text-danger">*</span></label>
              <input
                id="register-password"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                type="password"
                autocomplete="new-password"
                required
                @input="password = $event.target.value"
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
              <div
                class="auth-password-meter mt-2"
                role="meter"
                aria-label="Độ mạnh mật khẩu"
                :aria-valuenow="strength"
                aria-valuemin="0"
                aria-valuemax="3"
              >
                <span :style="{ width: `${(strength / 3) * 100}%`, backgroundColor: strengthColor }" />
              </div>
              <small class="text-secondary">Độ mạnh: {{ strengthLabel }}. Cần ít nhất 8 ký tự, gồm chữ cái và chữ số.</small>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="birthDate"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-birth-date"
              >Ngày sinh</label>
              <input
                id="register-birth-date"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                type="date"
                autocomplete="bday"
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="gender"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-gender"
              >Giới tính</label>
              <select
                id="register-gender"
                v-bind="field"
                class="form-select"
                :class="{ 'is-invalid': errorMessage }"
              >
                <option value="">
                  Chọn giới tính
                </option>
                <option value="male">
                  Nam
                </option>
                <option value="female">
                  Nữ
                </option>
                <option value="other">
                  Khác
                </option>
              </select>
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="phone"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-phone"
              >Số điện thoại</label>
              <input
                id="register-phone"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                type="tel"
                autocomplete="tel"
                maxlength="20"
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>

          <Field
            v-slot="{ field, errorMessage }"
            name="address"
          >
            <div class="col-sm-6">
              <label
                class="form-label"
                for="register-address"
              >Địa chỉ</label>
              <input
                id="register-address"
                v-bind="field"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                autocomplete="street-address"
                maxlength="255"
              >
              <div
                v-if="errorMessage"
                class="invalid-feedback"
              >
                {{ errorMessage }}
              </div>
            </div>
          </Field>
        </div>

        <button
          class="btn btn-primary w-100 mt-4"
          type="submit"
          :disabled="isSubmitting"
        >
          <span
            v-if="isSubmitting"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Tạo tài khoản
        </button>
      </Form>

      <p class="text-center text-secondary mt-4 mb-0">
        Đã có tài khoản?
        <RouterLink
          :to="{ name: 'login' }"
          class="fw-semibold"
        >
          Đăng nhập
        </RouterLink>
      </p>
    </div>
  </section>
</template>
