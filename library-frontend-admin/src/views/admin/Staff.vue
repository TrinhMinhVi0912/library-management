<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import {
  createAdminStaff,
  getAdminUser,
  getAdminUsers,
  lockAdminUser,
  requestAdminPasswordReset,
  unlockAdminUser,
  updateAdminUserRole,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const staff = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const busyId = ref('');
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailStaff = ref(null);
const showCreateModal = ref(false);
const creating = ref(false);
const staffForm = reactive({ firstName: '', lastName: '', email: '', password: '', position: '', phone: '', address: '' });

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const query = computed(() => String(route.query.q || ''));
const status = computed(() => String(route.query.status || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const columns = [
  { key: 'code', label: 'Mã nhân viên', sortable: true },
  { key: 'name', label: 'Nhân viên' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày tạo', sortable: true },
];

onMounted(loadStaff);
watch(() => [route.query.page, route.query.q, route.query.status, route.query.sort], loadStaff);

async function loadStaff() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminUsers({
      role: 'staff',
      q: query.value || undefined,
      status: status.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    staff.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function setQuery(values) {
  const nextQuery = { ...route.query, ...values };
  Object.keys(nextQuery).forEach((key) => {
    if (nextQuery[key] === '' || nextQuery[key] == null) delete nextQuery[key];
  });
  router.replace({ query: nextQuery });
}

function updateSearch(value) { setQuery({ q: value.trim() || undefined, page: undefined }); }
function updateStatus(value) { setQuery({ status: value || undefined, page: undefined }); }
function updatePage(value) { setQuery({ page: value === 1 ? undefined : String(value) }); }
function updateSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key, page: undefined }); }

function fullName(user) { return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'; }
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

async function openDetails(user) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailStaff.value = user;
  try {
    detailStaff.value = await getAdminUser(user._id);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tải được hồ sơ nhân viên.');
  } finally {
    detailLoading.value = false;
  }
}

function closeDetails() {
  detailOpen.value = false;
  detailStaff.value = null;
}

async function lockStaff(user) {
  const confirmation = await Swal.fire({
    title: `Khóa tài khoản ${fullName(user)}?`,
    text: 'Các phiên đăng nhập hiện tại của tài khoản sẽ bị thu hồi.',
    input: 'textarea',
    inputLabel: 'Lý do khóa',
    inputPlaceholder: 'Nhập lý do (bắt buộc)',
    inputAttributes: { maxlength: 500, 'aria-label': 'Lý do khóa tài khoản' },
    showCancelButton: true,
    confirmButtonText: 'Khóa tài khoản',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
    inputValidator: (value) => (value?.trim() ? undefined : 'Vui lòng nhập lý do khóa.'),
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    await lockAdminUser(user._id, confirmation.value.trim());
    toast.success(`Đã khóa tài khoản ${user.code}.`);
    await refreshStaff(user._id);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể khóa tài khoản.');
  } finally {
    busyId.value = '';
  }
}

async function unlockStaff(user) {
  const confirmation = await Swal.fire({
    title: `Mở khóa tài khoản ${fullName(user)}?`,
    text: 'Nhân viên sẽ có thể đăng nhập trở lại.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Mở khóa',
    cancelButtonText: 'Hủy',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    await unlockAdminUser(user._id);
    toast.success(`Đã mở khóa tài khoản ${user.code}.`);
    await refreshStaff(user._id);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể mở khóa tài khoản.');
  } finally {
    busyId.value = '';
  }
}

async function sendPasswordReset(user) {
  const confirmation = await Swal.fire({
    title: 'Tạo mã khôi phục mật khẩu?',
    text: 'Chỉ tiếp tục sau khi đã xác minh trực tiếp thẻ nhân viên hoặc giấy tờ của người yêu cầu.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Tạo mã',
    cancelButtonText: 'Hủy',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    const result = await requestAdminPasswordReset(user._id);
    await Swal.fire({
      title: 'Mã khôi phục đã được tạo',
      text: result?.resetCode || 'Không nhận được mã khôi phục. Vui lòng kiểm tra kết quả API.',
      input: 'text',
      inputValue: result?.resetCode || '',
      inputAttributes: { readonly: true, 'aria-label': 'Mã khôi phục dùng một lần' },
      footer: 'Mã chỉ hiển thị lần này, có hiệu lực 30 phút. Ghi nhận việc bàn giao trực tiếp; không gửi mã qua email hoặc kênh công khai.',
      confirmButtonText: 'Đã ghi nhận',
    });
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể tạo mã khôi phục.');
  } finally {
    busyId.value = '';
  }
}

async function promoteToAdmin(user) {
  const confirmation = await Swal.fire({
    title: `Nâng ${fullName(user)} thành quản trị viên?`,
    text: 'Tài khoản sẽ có quyền quản trị và rời khỏi danh sách nhân viên.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Nâng quyền',
    cancelButtonText: 'Hủy',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    await updateAdminUserRole(user._id, 'admin');
    toast.success('Đã cập nhật vai trò thành quản trị viên.');
    if (detailStaff.value?._id === user._id) closeDetails();
    await loadStaff();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể cập nhật vai trò.');
  } finally {
    busyId.value = '';
  }
}

async function refreshStaff(userId) {
  await loadStaff();
  if (detailOpen.value && detailStaff.value?._id === userId) await openDetails(detailStaff.value);
}

function resetStaffForm() {
  showCreateModal.value = false;
  Object.assign(staffForm, { firstName: '', lastName: '', email: '', password: '', position: '', phone: '', address: '' });
}

async function submitStaff() {
  if (creating.value) return;
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/.test(staffForm.password)) {
    toast.error('Mật khẩu cần từ 8 ký tự, có ít nhất một chữ cái và một chữ số.');
    return;
  }
  creating.value = true;
  try {
    await createAdminStaff({
      ...staffForm,
      firstName: staffForm.firstName.trim(),
      lastName: staffForm.lastName.trim(),
      email: staffForm.email.trim(),
    });
    toast.success('Đã tạo tài khoản nhân viên.');
    resetStaffForm();
    setQuery({ page: undefined, status: undefined, q: undefined });
    await loadStaff();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể tạo tài khoản nhân viên.');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <section class="staff-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Quản lý nhân viên</span>
    </nav>

    <div class="page-heading staff-heading">
      <div>
        <span class="eyebrow">NHÂN SỰ THƯ VIỆN</span>
        <h1>Quản lý nhân viên</h1>
        <p class="text-muted-strong mb-0">
          Quản lý tài khoản, trạng thái và quyền truy cập của nhân viên.
        </p>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        @click="showCreateModal = true"
      >
        <i
          class="bi bi-person-plus me-1"
          aria-hidden="true"
        />Thêm nhân viên
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="staff"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :query="query"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @update:query="updateSearch"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadStaff"
    >
      <template #toolbar>
        <label class="filter-field">
          <span>Trạng thái</span>
          <select
            class="form-select form-select-sm"
            :value="status"
            @change="updateStatus($event.target.value)"
          >
            <option value="">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </label>
      </template>
      <template #cell-code="{ value }">
        <strong>{{ value }}</strong>
      </template>
      <template #cell-name="{ row }">
        <div class="name-cell">
          <strong>{{ fullName(row) }}</strong><small>{{ row.phone || 'Chưa có số điện thoại' }}</small>
        </div>
      </template>
      <template #cell-position="{ value }">
        {{ value || 'Chưa cập nhật' }}
      </template>
      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="row.status === 'active' ? 'status-active' : 'status-locked'"
        >
          {{ row.status === 'active' ? 'Đang hoạt động' : 'Đã khóa' }}
        </span>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #row="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-sm btn-outline-primary"
            type="button"
            :disabled="Boolean(busyId)"
            @click="openDetails(row)"
          >
            Chi tiết
          </button>
          <button
            v-if="row.status === 'active'"
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(busyId)"
            @click="lockStaff(row)"
          >
            Khóa
          </button>
          <button
            v-else
            class="btn btn-sm btn-outline-success"
            type="button"
            :disabled="Boolean(busyId)"
            @click="unlockStaff(row)"
          >
            Mở khóa
          </button>
          <button
            v-if="row.status === 'active'"
            class="btn btn-sm btn-outline-secondary"
            type="button"
            :disabled="Boolean(busyId)"
            @click="sendPasswordReset(row)"
          >
            Đặt lại mật khẩu
          </button>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            :disabled="Boolean(busyId)"
            @click="promoteToAdmin(row)"
          >
            Nâng quyền admin
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-person-gear"
            aria-hidden="true"
          /><span>Chưa có nhân viên phù hợp.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách nhân viên.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadStaff"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="detailOpen"
      class="detail-backdrop"
      @click.self="closeDetails"
    >
      <aside
        class="staff-detail surface-card"
        role="dialog"
        aria-modal="true"
        :aria-label="`Hồ sơ ${fullName(detailStaff)}`"
      >
        <header class="detail-header">
          <div><span class="eyebrow">HỒ SƠ NHÂN VIÊN</span><h2>{{ fullName(detailStaff) }}</h2></div>
          <button
            class="icon-close"
            type="button"
            aria-label="Đóng hồ sơ"
            @click="closeDetails"
          >
            <i
              class="bi bi-x-lg"
              aria-hidden="true"
            />
          </button>
        </header>
        <div
          v-if="detailLoading"
          class="detail-state"
        >
          <span class="spinner-border spinner-border-sm text-primary" /> Đang tải hồ sơ...
        </div>
        <div
          v-else-if="detailStaff"
          class="detail-content"
        >
          <dl class="staff-profile">
            <dt>Mã nhân viên</dt><dd>{{ detailStaff.code || '—' }}</dd>
            <dt>Email</dt><dd>{{ detailStaff.email || '—' }}</dd>
            <dt>Chức vụ</dt><dd>{{ detailStaff.position || 'Chưa cập nhật' }}</dd>
            <dt>Số điện thoại</dt><dd>{{ detailStaff.phone || '—' }}</dd>
            <dt>Địa chỉ</dt><dd>{{ detailStaff.address || '—' }}</dd>
            <dt>Trạng thái</dt><dd>{{ detailStaff.status === 'active' ? 'Đang hoạt động' : 'Đã khóa' }}</dd>
            <dt>Ngày tạo</dt><dd>{{ formatDate(detailStaff.createdAt) }}</dd>
            <template v-if="detailStaff.status === 'locked'">
              <dt>Lý do khóa</dt><dd>{{ detailStaff.lockReason || '—' }}</dd>
            </template>
          </dl>
        </div>
      </aside>
    </div>

    <div
      v-if="showCreateModal"
      class="modal-backdrop-custom"
      @click.self="resetStaffForm"
    >
      <section
        class="staff-modal surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-staff-title"
      >
        <header class="modal-heading">
          <div>
            <span class="eyebrow">TẠO TÀI KHOẢN</span><h2 id="create-staff-title">
              Thêm nhân viên
            </h2>
          </div>
          <button
            class="icon-close"
            type="button"
            aria-label="Đóng biểu mẫu"
            @click="resetStaffForm"
          >
            <i
              class="bi bi-x-lg"
              aria-hidden="true"
            />
          </button>
        </header>
        <form @submit.prevent="submitStaff">
          <div class="form-grid">
            <label class="form-field"><span>Họ lót *</span><input
              v-model.trim="staffForm.firstName"
              class="form-control"
              maxlength="50"
              autocomplete="given-name"
              required
            ></label>
            <label class="form-field"><span>Tên *</span><input
              v-model.trim="staffForm.lastName"
              class="form-control"
              maxlength="50"
              autocomplete="family-name"
              required
            ></label>
          </div>
          <label class="form-field"><span>Email *</span><input
            v-model.trim="staffForm.email"
            class="form-control"
            type="email"
            autocomplete="email"
            required
          ></label>
          <label class="form-field"><span>Mật khẩu tạm *</span><input
            v-model="staffForm.password"
            class="form-control"
            type="password"
            minlength="8"
            maxlength="100"
            autocomplete="new-password"
            required
          ><small>Từ 8 ký tự, gồm ít nhất một chữ cái và một chữ số.</small></label>
          <div class="form-grid">
            <label class="form-field"><span>Chức vụ</span><input
              v-model.trim="staffForm.position"
              class="form-control"
              maxlength="100"
              placeholder="Ví dụ: Thủ thư"
            ></label>
            <label class="form-field"><span>Số điện thoại</span><input
              v-model.trim="staffForm.phone"
              class="form-control"
              maxlength="20"
              pattern="[0-9+() -]{8,20}"
              autocomplete="tel"
            ></label>
          </div>
          <label class="form-field"><span>Địa chỉ</span><input
            v-model.trim="staffForm.address"
            class="form-control"
            maxlength="255"
            autocomplete="street-address"
          ></label>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="creating"
              @click="resetStaffForm"
            >
              Hủy
            </button>
            <button
              class="btn btn-primary"
              type="submit"
              :disabled="creating"
            >
              <span
                v-if="creating"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />Tạo nhân viên
            </button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.staff-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.staff-heading h1 { margin: .25rem 0; }
.staff-heading p { margin-top: .35rem; font-size: .9rem; }
.eyebrow { color: #6b7280; font-size: .75rem; font-weight: 600; letter-spacing: .04em; }
.filter-field { display: grid; min-width: 155px; gap: .25rem; color: #6b7280; font-size: .75rem; }
.name-cell { display: grid; gap: .2rem; }
.name-cell small { color: #6b7280; font-size: .75rem; }
.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 600; white-space: nowrap; }
.status-active { background: #ecfdf5; color: #047857; }
.status-locked { background: #fef2f2; color: #b91c1c; }
.row-actions { display: flex; flex-wrap: wrap; gap: .35rem; }
.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.detail-backdrop,.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: flex; justify-content: flex-end; background: rgb(17 24 39 / 42%); }
.staff-detail { display: flex; width: min(100%, 520px); height: 100%; flex-direction: column; overflow: hidden; border-radius: 0; box-shadow: -12px 0 36px rgb(17 24 39 / 15%); }
.detail-header,.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.detail-header h2,.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }
.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }
.detail-content { overflow-y: auto; padding: 1.25rem 1.5rem; }
.staff-profile { display: grid; grid-template-columns: minmax(125px, .65fr) 1.35fr; gap: .7rem 1rem; margin: 0; font-size: .9rem; }
.staff-profile dt { color: #6b7280; font-weight: 400; }
.staff-profile dd { margin: 0; overflow-wrap: anywhere; }
.detail-state { display: flex; align-items: center; justify-content: center; gap: .5rem; min-height: 200px; }
.modal-backdrop-custom { display: grid; overflow-y: auto; place-items: center; padding: 1rem; }
.staff-modal { width: min(100%, 600px); max-height: calc(100vh - 2rem); overflow-y: auto; padding: 0 1.35rem 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }
.staff-modal .modal-heading { margin: 0 -1.35rem 1.1rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }
.form-field small { color: #6b7280; }
.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 700px) {
  .staff-heading { align-items: flex-start; flex-direction: column; }
  .staff-heading > button { width: 100%; }
  .row-actions { align-items: flex-start; flex-direction: column; }
  .detail-header,.detail-content { padding-right: 1rem; padding-left: 1rem; }
  .staff-profile { grid-template-columns: minmax(105px, .65fr) 1.35fr; }
  .form-grid { grid-template-columns: 1fr; gap: 0; }
  .staff-modal { padding-right: 1rem; padding-left: 1rem; }
  .staff-modal .modal-heading { margin-right: -1rem; margin-left: -1rem; }
}
</style>
