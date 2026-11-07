<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'vue-toastification';
import ImageUploader from '@/components/common/ImageUploader.vue';
import userService from '@/services/user.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate, formatMoney } from '@/utils/format';

const authStore = useAuthStore();
const toast = useToast();

const activeTab = ref('profile'); // 'profile' | 'password'
const pageLoading = ref(true);

// State form Thông tin cá nhân
const profileForm = reactive({
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: '',
  phone: '',
  address: '',
  code: '',
  email: '',
  avatar: null,
});

const profileSubmitting = ref(false);
const profileError = ref('');
const profileSuccess = ref('');

// State form Đổi mật khẩu
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordSubmitting = ref(false);
const passwordError = ref('');
const passwordSuccess = ref('');

// Computed
const fullName = computed(() => {
  return [profileForm.firstName, profileForm.lastName].filter(Boolean).join(' ')
    || authStore.user?.email
    || 'Độc giả';
});

const unpaidFineTotal = computed(() => Number(authStore.user?.unpaidFineTotal || 0));

// Tính độ mạnh mật khẩu mới
const passwordStrength = computed(() => {
  const pwd = passwordForm.newPassword;
  if (!pwd) return { score: 0, text: '', color: 'bg-secondary' };

  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (pwd.length >= 12) score += 15;
  if (/[A-Za-z]/.test(pwd)) score += 25;
  if (/\d/.test(pwd)) score += 25;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 10;

  if (score < 40) return { score, text: 'Yếu', color: 'bg-danger' };
  if (score < 75) return { score, text: 'Trung bình', color: 'bg-warning' };
  return { score: Math.min(100, score), text: 'Mạnh', color: 'bg-success' };
});

const hasMinLength = computed(() => passwordForm.newPassword.length >= 8);
const hasLetter = computed(() => /[A-Za-z]/.test(passwordForm.newPassword));
const hasNumber = computed(() => /\d/.test(passwordForm.newPassword));
const isPasswordSameAsOld = computed(() => {
  return Boolean(passwordForm.currentPassword && passwordForm.newPassword && passwordForm.currentPassword === passwordForm.newPassword);
});
const isPasswordMatch = computed(() => {
  return Boolean(passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword);
});

function syncFormDataFromUser(user) {
  if (!user) return;
  profileForm.firstName = user.firstName || '';
  profileForm.lastName = user.lastName || '';
  profileForm.gender = user.gender || '';
  profileForm.phone = user.phone || '';
  profileForm.address = user.address || '';
  profileForm.code = user.code || '';
  profileForm.email = user.email || '';
  profileForm.avatar = user.avatar || null;

  // Format birthDate to YYYY-MM-DD
  if (user.birthDate) {
    try {
      const d = new Date(user.birthDate);
      if (!Number.isNaN(d.getTime())) {
        profileForm.birthDate = d.toISOString().slice(0, 10);
      } else {
        profileForm.birthDate = '';
      }
    } catch {
      profileForm.birthDate = '';
    }
  } else {
    profileForm.birthDate = '';
  }
}

async function loadProfile() {
  pageLoading.value = true;
  profileError.value = '';
  try {
    const data = await userService.getProfile();
    syncFormDataFromUser(data);
    authStore.updateUser(data);
  } catch (err) {
    profileError.value = err.response?.data?.message || 'Không thể tải thông tin hồ sơ.';
    // Fallback sang authStore nếu API lỗi
    if (authStore.user) {
      syncFormDataFromUser(authStore.user);
    }
  } finally {
    pageLoading.value = false;
  }
}

onMounted(() => {
  loadProfile();
});

// Xử lý đổi avatar
async function onAvatarSuccess(result) {
  const avatarData = result?.avatar || { url: result?.url, publicId: result?.publicId };
  profileForm.avatar = avatarData;
  authStore.updateUser({ avatar: avatarData });
  toast.success('Cập nhật ảnh đại diện thành công!');
}

function onAvatarError(errMessage) {
  toast.error(errMessage || 'Không thể cập nhật ảnh đại diện.');
}

// Xử lý lưu thông tin cá nhân
async function handleUpdateProfile() {
  profileError.value = '';
  profileSuccess.value = '';

  if (!profileForm.firstName.trim()) {
    profileError.value = 'Họ và tên đệm không được để trống.';
    return;
  }
  if (!profileForm.lastName.trim()) {
    profileError.value = 'Tên không được để trống.';
    return;
  }

  profileSubmitting.value = true;
  try {
    const payload = {
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      gender: profileForm.gender || undefined,
      phone: profileForm.phone.trim() || undefined,
      address: profileForm.address.trim() || undefined,
      birthDate: profileForm.birthDate ? new Date(profileForm.birthDate).toISOString() : null,
    };

    const updatedUser = await userService.updateProfile(payload);
    syncFormDataFromUser(updatedUser);
    authStore.updateUser(updatedUser);

    profileSuccess.value = 'Cập nhật thông tin cá nhân thành công!';
    toast.success('Cập nhật thông tin cá nhân thành công!');
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.message
      || err.response?.data?.message
      || 'Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại thông tin.';
    profileError.value = msg;
    toast.error(msg);
  } finally {
    profileSubmitting.value = false;
  }
}

function handleResetProfile() {
  syncFormDataFromUser(authStore.user);
  profileError.value = '';
  profileSuccess.value = '';
}

// Xử lý đổi mật khẩu
async function handleChangePassword() {
  passwordError.value = '';
  passwordSuccess.value = '';

  if (!passwordForm.currentPassword) {
    passwordError.value = 'Vui lòng nhập mật khẩu hiện tại.';
    return;
  }

  if (!passwordForm.newPassword) {
    passwordError.value = 'Vui lòng nhập mật khẩu mới.';
    return;
  }

  if (!hasMinLength.value || !hasLetter.value || !hasNumber.value) {
    passwordError.value = 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số.';
    return;
  }

  if (isPasswordSameAsOld.value) {
    passwordError.value = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Xác nhận mật khẩu mới không khớp.';
    return;
  }

  passwordSubmitting.value = true;
  try {
    await userService.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });

    passwordSuccess.value = 'Đổi mật khẩu thành công! Mật khẩu mới của bạn đã có hiệu lực.';
    toast.success('Đổi mật khẩu thành công!');

    // Reset form
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  } catch (err) {
    // Hiển thị lỗi rõ ràng nếu sai mật khẩu cũ hoặc lỗi khác
    const msg = err.response?.data?.errors?.[0]?.message
      || err.response?.data?.message
      || 'Đổi mật khẩu không thành công. Vui lòng kiểm tra lại.';
    passwordError.value = msg;
    toast.error(msg);
  } finally {
    passwordSubmitting.value = false;
  }
}
</script>

<template>
  <div class="profile-page container-xl py-4 py-lg-5">
    <!-- Header trang -->
    <div class="page-header mb-4">
      <h1 class="page-title h3 fw-bold mb-1">
        Hồ sơ cá nhân
      </h1>
      <p class="text-muted mb-0">
        Quản lý thông tin tài khoản độc giả, đổi ảnh đại diện và mật khẩu bảo vệ
      </p>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="pageLoading"
      class="text-center py-5"
    >
      <div
        class="spinner-border text-primary"
        role="status"
      >
        <span class="visually-hidden">Đang tải thông tin...</span>
      </div>
      <p class="text-muted mt-2">
        Đang tải thông tin hồ sơ...
      </p>
    </div>

    <!-- Nội dung chính -->
    <div
      v-else
      class="row g-4"
    >
      <!-- Cột trái: Tóm tắt thông tin & Avatar -->
      <div class="col-lg-4">
        <div class="card border shadow-sm profile-sidebar-card">
          <div class="card-body p-4 text-center">
            <!-- ImageUploader -->
            <div class="d-flex justify-content-center mb-3">
              <ImageUploader
                v-model="profileForm.avatar"
                shape="circle"
                size="130px"
                :max-size="2 * 1024 * 1024"
                alt="Ảnh đại diện của bạn"
                button-text="Đổi ảnh đại diện"
                @success="onAvatarSuccess"
                @error="onAvatarError"
              />
            </div>

            <h2 class="h5 fw-bold mb-1 text-truncate">
              {{ fullName }}
            </h2>
            <div class="text-muted small mb-3">
              {{ profileForm.email }}
            </div>

            <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                <i class="bi bi-person-badge me-1" />{{ profileForm.code || 'Mã ĐG' }}
              </span>
              <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                <i class="bi bi-check-circle me-1" />Tài khoản hoạt động
              </span>
            </div>

            <!-- Cảnh báo nếu nợ phạt -->
            <div
              v-if="unpaidFineTotal > 0"
              class="alert alert-danger py-2 px-3 small text-start mb-0"
            >
              <div class="fw-semibold">
                <i class="bi bi-exclamation-octagon-fill me-1" /> Nợ phạt chưa nộp: {{ formatMoney(unpaidFineTotal) }}
              </div>
              <div class="mt-1">
                Tài khoản đang bị tạm khóa mượn sách. Vui lòng thanh toán tại quầy thư viện.
              </div>
            </div>
          </div>

          <!-- Danh sách meta phụ -->
          <ul class="list-group list-group-flush small border-top">
            <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-4">
              <span class="text-muted"><i class="bi bi-calendar3 me-2" />Tham gia:</span>
              <span class="fw-medium">{{ formatDate(authStore.user?.createdAt) || 'Chưa cập nhật' }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-4">
              <span class="text-muted"><i class="bi bi-telephone me-2" />Điện thoại:</span>
              <span class="fw-medium">{{ profileForm.phone || 'Chưa cập nhật' }}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-4">
              <span class="text-muted"><i class="bi bi-geo-alt me-2" />Địa chỉ:</span>
              <span
                class="fw-medium text-truncate text-end ms-2"
                style="max-width: 180px;"
                :title="profileForm.address"
              >
                {{ profileForm.address || 'Chưa cập nhật' }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Cột phải: Tabs chỉnh sửa -->
      <div class="col-lg-8">
        <div class="card border shadow-sm">
          <!-- Card Header Tabs -->
          <div class="card-header bg-white border-bottom pt-3 pb-0">
            <ul
              class="nav nav-tabs card-header-tabs"
              role="tablist"
            >
              <li
                class="nav-item"
                role="presentation"
              >
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'profile' }"
                  type="button"
                  role="tab"
                  :aria-selected="activeTab === 'profile'"
                  @click="activeTab = 'profile'"
                >
                  <i class="bi bi-person me-2" />Thông tin cá nhân
                </button>
              </li>
              <li
                class="nav-item"
                role="presentation"
              >
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'password' }"
                  type="button"
                  role="tab"
                  :aria-selected="activeTab === 'password'"
                  @click="activeTab = 'password'"
                >
                  <i class="bi bi-shield-lock me-2" />Đổi mật khẩu
                </button>
              </li>
            </ul>
          </div>

          <div class="card-body p-4">
            <!-- TAB 1: THÔNG TIN CÁ NHÂN -->
            <div
              v-show="activeTab === 'profile'"
              role="tabpanel"
            >
              <!-- Alert phản hồi -->
              <div
                v-if="profileSuccess"
                class="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4"
                role="alert"
              >
                <i class="bi bi-check-circle-fill me-2 fs-5" />
                <div>{{ profileSuccess }}</div>
                <button
                  type="button"
                  class="btn-close"
                  aria-label="Đóng"
                  @click="profileSuccess = ''"
                />
              </div>

              <div
                v-if="profileError"
                class="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4"
                role="alert"
              >
                <i class="bi bi-exclamation-triangle-fill me-2 fs-5" />
                <div>{{ profileError }}</div>
                <button
                  type="button"
                  class="btn-close"
                  aria-label="Đóng"
                  @click="profileError = ''"
                />
              </div>

              <form @submit.prevent="handleUpdateProfile">
                <div class="row g-3">
                  <!-- Mã độc giả (Read-only) -->
                  <div class="col-sm-6">
                    <label
                      for="profileCode"
                      class="form-label fw-medium text-muted small"
                    >
                      Mã độc giả
                    </label>
                    <input
                      id="profileCode"
                      type="text"
                      class="form-control bg-light"
                      :value="profileForm.code"
                      disabled
                      readonly
                    >
                    <div class="form-text">
                      Mã định danh do thư viện quản lý.
                    </div>
                  </div>

                  <!-- Email (Read-only) -->
                  <div class="col-sm-6">
                    <label
                      for="profileEmail"
                      class="form-label fw-medium text-muted small"
                    >
                      Email tài khoản
                    </label>
                    <input
                      id="profileEmail"
                      type="email"
                      class="form-control bg-light"
                      :value="profileForm.email"
                      disabled
                      readonly
                    >
                    <div class="form-text">
                      Email đăng nhập không thể tự thay đổi.
                    </div>
                  </div>

                  <!-- Họ và tên đệm -->
                  <div class="col-sm-6">
                    <label
                      for="firstName"
                      class="form-label fw-medium small"
                    >
                      Họ và tên lót <span class="text-danger">*</span>
                    </label>
                    <input
                      id="firstName"
                      v-model="profileForm.firstName"
                      type="text"
                      class="form-control"
                      maxlength="50"
                      required
                      placeholder="Nguyễn Văn"
                    >
                  </div>

                  <!-- Tên -->
                  <div class="col-sm-6">
                    <label
                      for="lastName"
                      class="form-label fw-medium small"
                    >
                      Tên <span class="text-danger">*</span>
                    </label>
                    <input
                      id="lastName"
                      v-model="profileForm.lastName"
                      type="text"
                      class="form-control"
                      maxlength="50"
                      required
                      placeholder="An"
                    >
                  </div>

                  <!-- Ngày sinh -->
                  <div class="col-sm-6">
                    <label
                      for="birthDate"
                      class="form-label fw-medium small"
                    >
                      Ngày sinh
                    </label>
                    <input
                      id="birthDate"
                      v-model="profileForm.birthDate"
                      type="date"
                      class="form-control"
                    >
                  </div>

                  <!-- Giới tính -->
                  <div class="col-sm-6">
                    <label
                      for="gender"
                      class="form-label fw-medium small"
                    >
                      Giới tính
                    </label>
                    <select
                      id="gender"
                      v-model="profileForm.gender"
                      class="form-select"
                    >
                      <option value="">
                        -- Chọn giới tính --
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
                  </div>

                  <!-- Số điện thoại -->
                  <div class="col-sm-12">
                    <label
                      for="phone"
                      class="form-label fw-medium small"
                    >
                      Số điện thoại
                    </label>
                    <input
                      id="phone"
                      v-model="profileForm.phone"
                      type="tel"
                      class="form-control"
                      placeholder="0912345678"
                      maxlength="20"
                    >
                    <div class="form-text">
                      Dùng để nhận thông báo khẩn cấp hoặc liên hệ mượn trả sách.
                    </div>
                  </div>

                  <!-- Địa chỉ -->
                  <div class="col-sm-12">
                    <label
                      for="address"
                      class="form-label fw-medium small"
                    >
                      Địa chỉ liên hệ
                    </label>
                    <textarea
                      id="address"
                      v-model="profileForm.address"
                      class="form-control"
                      rows="2"
                      maxlength="255"
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                    />
                  </div>
                </div>

                <!-- Nút thao tác -->
                <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :disabled="profileSubmitting"
                    @click="handleResetProfile"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="profileSubmitting"
                  >
                    <span
                      v-if="profileSubmitting"
                      class="spinner-border spinner-border-sm me-1"
                      role="status"
                    />
                    <i
                      v-else
                      class="bi bi-check2 me-1"
                      aria-hidden="true"
                    />
                    <span>{{ profileSubmitting ? 'Đang lưu...' : 'Lưu thay đổi' }}</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- TAB 2: ĐỔI MẬT KHẨU -->
            <div
              v-show="activeTab === 'password'"
              role="tabpanel"
            >
              <div class="card bg-light border-0 mb-4">
                <div class="card-body p-3">
                  <h6 class="fw-semibold text-primary mb-1">
                    <i class="bi bi-info-circle me-1" /> Quy tắc mật khẩu an toàn
                  </h6>
                  <ul class="small text-muted mb-0 ps-3">
                    <li>Tối thiểu <strong>8 ký tự</strong>.</li>
                    <li>Chứa ít nhất <strong>một chữ cái</strong> và <strong>một chữ số</strong>.</li>
                    <li>Không trùng với mật khẩu hiện tại.</li>
                  </ul>
                </div>
              </div>

              <!-- Alert phản hồi -->
              <div
                v-if="passwordSuccess"
                class="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4"
                role="alert"
              >
                <i class="bi bi-check-circle-fill me-2 fs-5" />
                <div>{{ passwordSuccess }}</div>
                <button
                  type="button"
                  class="btn-close"
                  aria-label="Đóng"
                  @click="passwordSuccess = ''"
                />
              </div>

              <!-- Lỗi rõ ràng khi đổi mật khẩu (VD: sai mật khẩu cũ) -->
              <div
                v-if="passwordError"
                class="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4"
                role="alert"
              >
                <i class="bi bi-exclamation-triangle-fill me-2 fs-5" />
                <div>
                  <strong>Không thể đổi mật khẩu:</strong> {{ passwordError }}
                </div>
                <button
                  type="button"
                  class="btn-close"
                  aria-label="Đóng"
                  @click="passwordError = ''"
                />
              </div>

              <form @submit.prevent="handleChangePassword">
                <!-- Mật khẩu hiện tại -->
                <div class="mb-3">
                  <label
                    for="currentPassword"
                    class="form-label fw-medium small"
                  >
                    Mật khẩu hiện tại <span class="text-danger">*</span>
                  </label>
                  <div class="input-group">
                    <input
                      id="currentPassword"
                      v-model="passwordForm.currentPassword"
                      :type="showCurrentPassword ? 'text' : 'password'"
                      class="form-control"
                      :class="{ 'is-invalid': passwordError && passwordError.includes('Mật khẩu hiện tại') }"
                      required
                      autocomplete="current-password"
                      placeholder="Nhập mật khẩu bạn đang dùng"
                    >
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      :aria-label="showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                      @click="showCurrentPassword = !showCurrentPassword"
                    >
                      <i :class="['bi', showCurrentPassword ? 'bi-eye-slash' : 'bi-eye']" />
                    </button>
                  </div>
                  <div
                    v-if="passwordError && passwordError.includes('Mật khẩu hiện tại')"
                    class="invalid-feedback d-block"
                  >
                    {{ passwordError }}
                  </div>
                </div>

                <!-- Mật khẩu mới -->
                <div class="mb-3">
                  <label
                    for="newPassword"
                    class="form-label fw-medium small"
                  >
                    Mật khẩu mới <span class="text-danger">*</span>
                  </label>
                  <div class="input-group">
                    <input
                      id="newPassword"
                      v-model="passwordForm.newPassword"
                      :type="showNewPassword ? 'text' : 'password'"
                      class="form-control"
                      required
                      autocomplete="new-password"
                      placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                    >
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      :aria-label="showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                      @click="showNewPassword = !showNewPassword"
                    >
                      <i :class="['bi', showNewPassword ? 'bi-eye-slash' : 'bi-eye']" />
                    </button>
                  </div>

                  <!-- Thanh đo độ mạnh mật khẩu -->
                  <div
                    v-if="passwordForm.newPassword"
                    class="mt-2"
                  >
                    <div
                      class="progress"
                      style="height: 6px;"
                    >
                      <div
                        class="progress-bar"
                        :class="passwordStrength.color"
                        role="progressbar"
                        :style="{ width: `${passwordStrength.score}%` }"
                        :aria-valuenow="passwordStrength.score"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1 small">
                      <span class="text-muted">Độ mạnh: <strong :class="passwordStrength.color.replace('bg-', 'text-')">{{ passwordStrength.text }}</strong></span>
                      <span
                        v-if="isPasswordSameAsOld"
                        class="text-danger fw-semibold"
                      >
                        Trùng mật khẩu cũ!
                      </span>
                    </div>
                  </div>

                  <!-- Checklist yêu cầu -->
                  <div class="password-checklist mt-2 small text-muted">
                    <div :class="{ 'text-success': hasMinLength, 'text-muted': !hasMinLength }">
                      <i :class="['bi', hasMinLength ? 'bi-check-circle-fill' : 'bi-circle']" /> Ít nhất 8 ký tự
                    </div>
                    <div :class="{ 'text-success': hasLetter, 'text-muted': !hasLetter }">
                      <i :class="['bi', hasLetter ? 'bi-check-circle-fill' : 'bi-circle']" /> Chứa ít nhất một chữ cái (A-Z, a-z)
                    </div>
                    <div :class="{ 'text-success': hasNumber, 'text-muted': !hasNumber }">
                      <i :class="['bi', hasNumber ? 'bi-check-circle-fill' : 'bi-circle']" /> Chứa ít nhất một chữ số (0-9)
                    </div>
                  </div>
                </div>

                <!-- Nhập lại mật khẩu mới -->
                <div class="mb-4">
                  <label
                    for="confirmPassword"
                    class="form-label fw-medium small"
                  >
                    Xác nhận mật khẩu mới <span class="text-danger">*</span>
                  </label>
                  <div class="input-group">
                    <input
                      id="confirmPassword"
                      v-model="passwordForm.confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      class="form-control"
                      :class="{
                        'is-valid': passwordForm.confirmPassword && isPasswordMatch,
                        'is-invalid': passwordForm.confirmPassword && !isPasswordMatch,
                      }"
                      required
                      autocomplete="new-password"
                      placeholder="Nhập lại chính xác mật khẩu mới"
                    >
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      :aria-label="showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <i :class="['bi', showConfirmPassword ? 'bi-eye-slash' : 'bi-eye']" />
                    </button>
                  </div>
                  <div
                    v-if="passwordForm.confirmPassword && !isPasswordMatch"
                    class="invalid-feedback d-block"
                  >
                    Xác nhận mật khẩu không khớp với mật khẩu mới.
                  </div>
                </div>

                <!-- Nút lưu mật khẩu -->
                <div class="d-flex justify-content-end gap-2 pt-3 border-top">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="passwordSubmitting || !isPasswordMatch || isPasswordSameAsOld"
                  >
                    <span
                      v-if="passwordSubmitting"
                      class="spinner-border spinner-border-sm me-1"
                      role="status"
                    />
                    <i
                      v-else
                      class="bi bi-key-fill me-1"
                      aria-hidden="true"
                    />
                    <span>{{ passwordSubmitting ? 'Đang cập nhật...' : 'Đổi mật khẩu' }}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  min-height: calc(100vh - 12rem);
}

.page-title {
  color: #111827;
}

.profile-sidebar-card {
  border-radius: 0.75rem;
}

.card-header-tabs .nav-link {
  font-weight: 500;
  color: #4b5563;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;

  &.active {
    color: #2563eb;
    font-weight: 600;
    border-color: #e5e7eb #e5e7eb #ffffff;
  }
}

.password-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  .bi {
    margin-right: 0.25rem;
  }
}
</style>

