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
  <section class="auth-page auth-page--ocean">
    <div class="auth-scene">
      <div class="auth-story">
        <span class="auth-story__eyebrow"><i class="bi bi-water me-2" />Mở ra một đại dương tri thức</span>
        <h1>Tri thức rộng như biển,<br> bắt đầu từ một cuốn sách.</h1>
        <p>Đăng nhập để khám phá kho sách, theo dõi hành trình mượn và lưu lại những cuốn sách bạn yêu thích.</p>
        <div class="auth-story__hint">
          <i
            class="bi bi-book-half"
            aria-hidden="true"
          /><span>Mỗi trang sách là một chuyến đi mới.</span>
        </div>
      </div>

      <div class="auth-card auth-card--ocean">
        <div
          class="auth-brand-mark auth-brand-mark--ocean mb-3"
          aria-hidden="true"
        >
          <i class="bi bi-book-half" />
        </div>
        <p class="auth-kicker mb-1">
          THƯ VIỆN TRỰC TUYẾN
        </p>
        <h2 class="h2 fw-bold mb-2">
          Đăng nhập
        </h2>
        <p class="auth-description mb-4">
          Chào mừng bạn trở lại. Cùng tiếp tục hành trình đọc sách nhé.
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
              <div class="auth-input-wrap">
                <i
                  class="bi bi-envelope"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  v-bind="field"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError }"
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  placeholder="ten.ban@email.com"
                  required
                >
              </div>
              <div
                v-if="fieldError"
                class="invalid-feedback d-block"
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
              <div class="d-flex align-items-center justify-content-between gap-2">
                <label
                  class="form-label"
                  for="login-password"
                >Mật khẩu</label>
                <RouterLink
                  class="auth-forgot-link"
                  :to="{ name: 'forgot-password' }"
                >
                  Quên mật khẩu?
                </RouterLink>
              </div>
              <div class="auth-input-wrap">
                <i
                  class="bi bi-lock"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  v-bind="field"
                  class="form-control"
                  :class="{ 'is-invalid': fieldError }"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Nhập mật khẩu"
                  required
                >
              </div>
              <div
                v-if="fieldError"
                class="invalid-feedback d-block"
              >
                {{ fieldError }}
              </div>
            </div>
          </Field>

          <label class="form-check d-flex align-items-center gap-2 mb-4 auth-remember">
            <input
              v-model="rememberEmail"
              class="form-check-input mt-0"
              type="checkbox"
            >
            <span class="form-check-label">Ghi nhớ email trên thiết bị này</span>
          </label>

          <button
            class="btn btn-primary w-100 auth-submit"
            type="submit"
            :disabled="isSubmitting"
          >
            <span
              v-if="isSubmitting"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            />
            Đăng nhập <i
              class="bi bi-arrow-right ms-1"
              aria-hidden="true"
            />
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
          <p class="auth-google-note small text-center mt-2 mb-0">
            Đóng cửa sổ Google để quay lại đăng nhập.
          </p>
          <p
            v-if="googleBusy"
            class="auth-google-note small text-center mt-2 mb-0"
            role="status"
            aria-live="polite"
          >
            <span
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            />Đang xác minh tài khoản Google…
          </p>
          <div
            v-if="googleError"
            class="alert alert-warning mt-3 mb-0"
            role="alert"
          >
            {{ googleError }}
          </div>
        </div>

        <p class="auth-register text-center mt-4 mb-0">
          Chưa có tài khoản? <RouterLink
            :to="{ name: 'register' }"
            class="fw-semibold"
          >
            Đăng ký ngay
          </RouterLink>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.auth-page--ocean {
  position: relative;
  display: flex;
  min-height: clamp(42rem, calc(100vh - 10rem), 58rem);
  align-items: center;
  overflow: hidden;
  padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 4rem);
  background: #03172a;
  color: #f3fbff;
  isolation: isolate;

  &::before,
  &::after {
    position: absolute;
    z-index: -1;
    content: '';
    inset: 0;
  }

  &::before {
    background-image: linear-gradient(90deg, rgb(2 16 31 / 16%) 0%, rgb(2 16 31 / 24%) 46%, #03172a 100%), url('@/assets/images/ocean-book-login.png');
    background-position: center;
    background-size: cover;
  }

  &::after {
    background: radial-gradient(ellipse at 22% 55%, transparent 0%, rgb(2 13 25 / 12%) 58%, rgb(2 13 25 / 48%) 100%);
  }
}

.auth-scene {
  display: grid;
  width: min(100%, 76rem);
  grid-template-columns: minmax(0, 1fr) minmax(21rem, 27rem);
  align-items: center;
  gap: clamp(2rem, 7vw, 7rem);
  margin: 0 auto;
}

.auth-story {
  max-width: 39rem;
  padding: 1rem 0;
  text-shadow: 0 2px 18px rgb(0 12 25 / 45%);

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    margin-bottom: 1.25rem;
    color: #7ce9f3;
    font-size: 0.82rem;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0 0 1.15rem;
    font-size: clamp(2.4rem, 5vw, 4.6rem);
    font-weight: 800;
    letter-spacing: -0.045em;
    line-height: 1.04;
  }

  > p {
    max-width: 32rem;
    margin: 0;
    color: rgb(237 249 255 / 82%);
    font-size: clamp(1rem, 1.4vw, 1.2rem);
    line-height: 1.75;
  }

  &__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    margin-top: 2rem;
    padding: 0.7rem 1rem;
    border: 1px solid rgb(123 231 242 / 30%);
    border-radius: 999px;
    background: rgb(3 32 53 / 38%);
    color: #d5f8fb;
    font-size: 0.9rem;
    backdrop-filter: blur(10px);

    i { color: #66e3ec; }
  }
}

.auth-card--ocean {
  width: 100%;
  border: 1px solid rgb(91 212 230 / 22%);
  border-top: 3px solid #29cbd8;
  border-radius: 1.25rem;
  background: linear-gradient(155deg, rgb(8 31 52 / 96%), rgb(4 22 40 / 95%));
  padding: clamp(1.5rem, 3vw, 2.25rem);
  box-shadow: 0 1.5rem 5rem rgb(0 9 20 / 45%), inset 0 1px 0 rgb(255 255 255 / 5%);
  backdrop-filter: blur(18px);

  :deep(.form-label) {
    margin-bottom: 0.5rem;
    color: #d8eaf4;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  :deep(.form-control) {
    min-height: 3rem;
    border-color: rgb(124 180 204 / 20%);
    border-radius: 0.7rem;
    background: #06172a;
    color: #f3fbff;
    box-shadow: none;

    &::placeholder { color: #7893a7; }
    &:focus { border-color: #28c9d8; box-shadow: 0 0 0 0.2rem rgb(40 201 216 / 17%); }
  }

  :deep(.form-check-input) {
    border-color: #58778c;
    background-color: #06172a;
    &:checked { border-color: #25c7d5; background-color: #17b9ca; }
  }
}

.auth-brand-mark--ocean {
  width: 3.5rem;
  height: 3.5rem;
  display: grid;
  place-items: center;
  margin-inline: auto;
  border: 1px solid rgb(44 207 221 / 45%);
  border-radius: 1rem;
  background: linear-gradient(145deg, rgb(14 157 180 / 28%), rgb(6 54 82 / 68%));
  color: #68e9f1;
  font-size: 1.55rem;
  box-shadow: 0 0 1.6rem rgb(20 198 214 / 16%);
}

.auth-kicker {
  color: #5bdce8;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-align: center;
}

.auth-card--ocean h2 { color: #f4fbff; text-align: center; }
.auth-description, .auth-remember, .auth-google-note { color: #a9bfce; }
.auth-description { font-size: 0.9rem; text-align: center; }
.auth-input-wrap { position: relative; }
.auth-input-wrap > i { position: absolute; z-index: 1; top: 50%; left: 0.9rem; color: #7b9caf; transform: translateY(-50%); }
.auth-input-wrap :deep(.form-control) { padding-left: 2.55rem; }
.auth-forgot-link, .auth-register a { color: #60dce8; text-decoration: none; }
.auth-forgot-link { font-size: 0.82rem; }
.auth-forgot-link:hover, .auth-register a:hover { color: #a5f3fc; text-decoration: underline; }
.auth-remember { font-size: 0.83rem; }

.auth-submit {
  min-height: 3.05rem;
  border: 0;
  border-radius: 0.7rem;
  background: linear-gradient(100deg, #21cabb, #28bfe8);
  color: #03253a;
  font-weight: 800;
  box-shadow: 0 0.5rem 1.5rem rgb(21 197 203 / 22%);
  &:hover:not(:disabled) { background: linear-gradient(100deg, #3be0ca, #45d0f2); color: #03253a; transform: translateY(-1px); }
}

.auth-google-separator {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.25rem 0;
  color: #8fa9b9;
  font-size: 0.875rem;
}

.auth-google-separator::before,
.auth-google-separator::after {
  content: '';
  flex: 1;
  border-top: 1px solid rgb(143 169 185 / 24%);
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

.auth-register { color: #a9bfce; font-size: 0.88rem; }

@media (min-width: 768px) and (max-height: 900px) {
  .auth-page--ocean { min-height: calc(100vh - 14rem); padding-block: .75rem; }
  .auth-story { padding-block: .5rem; }
  .auth-story__eyebrow { margin-bottom: .75rem; }
  .auth-story h1 { margin-bottom: .8rem; font-size: clamp(2rem, 6vh, 3.5rem); }
  .auth-story > p { line-height: 1.55; }
  .auth-story__hint { margin-top: 1rem; padding: .55rem .8rem; }

  .auth-card--ocean { padding: 1.15rem; }
  .auth-brand-mark--ocean { display: none; }
  .auth-card--ocean h2 { font-size: 1.65rem; }
  .auth-card--ocean :deep(.form-label) { margin-bottom: .25rem; }
  .auth-card--ocean :deep(.form-control) { min-height: 2.5rem; }
  .auth-card--ocean :deep(.mb-3) { margin-bottom: .5rem !important; }
  .auth-description.mb-4 { margin-bottom: .6rem !important; }
  .auth-remember.mb-4 { margin-bottom: .5rem !important; }
  .auth-submit { min-height: 2.6rem; }
  .auth-google-separator { margin-block: .6rem; }
  .auth-register.mt-4 { margin-top: .5rem !important; }
}

@media (max-width: 767.98px) {
  .auth-page--ocean { min-height: auto; padding: 2.25rem 1rem; }
  .auth-page--ocean::before { background-position: 36% center; }
  .auth-scene { max-width: 30rem; grid-template-columns: 1fr; gap: 1.25rem; }
  .auth-story { padding: 0.5rem 0.25rem; }
  .auth-story h1 { font-size: clamp(2rem, 9vw, 3rem); }
  .auth-story > p { max-width: 28rem; font-size: 0.95rem; }
  .auth-story__hint { display: none; }
  .auth-card--ocean { padding: 1.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .auth-submit { transition: none; }
}
</style>
