<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import { useAuthStore } from '@/stores/auth.store';
import {
  createAdminStaff,
  getAdminFines,
  getAdminLoans,
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
const auth = useAuthStore();
const users = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const busyId = ref('');
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailUser = ref(null);
const loans = ref([]);
const fines = ref([]);
const showCreateModal = ref(false);
const creating = ref(false);
const staffForm = reactive({ firstName: '', lastName: '', email: '', password: '', position: '', phone: '', address: '' });

const isAdmin = computed(() => auth.isAdmin);
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const query = computed(() => String(route.query.q || ''));
const role = computed(() => String(route.query.role || ''));
const status = computed(() => String(route.query.status || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const columns = computed(() => [
  { key: 'code', label: 'Mã người dùng', sortable: true },
  { key: 'name', label: 'Họ tên' },
  { key: 'email', label: 'Email', sortable: true },
  ...(isAdmin.value ? [{ key: 'role', label: 'Vai trò' }] : []),
  { key: 'status', label: 'Trạng thái' },
  { key: 'unpaidFineTotal', label: 'Nợ phạt', sortable: true },
]);
const roleLabels = { reader: 'Độc giả', staff: 'Nhân viên', admin: 'Quản trị viên' };
const statusLabels = { active: 'Đang hoạt động', locked: 'Đã khóa' };

onMounted(loadUsers);
watch(() => [route.query.page, route.query.q, route.query.role, route.query.status, route.query.sort], loadUsers);

async function loadUsers() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminUsers({
      q: query.value || undefined,
      role: isAdmin.value ? role.value || undefined : undefined,
      status: status.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    users.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
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
function updateFilter(key, value) { setQuery({ [key]: value || undefined, page: undefined }); }
function updatePage(value) { setQuery({ page: value === 1 ? undefined : String(value) }); }
function updateSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key, page: undefined }); }

function fullName(user) { return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'; }
function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

async function openDetails(user) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailUser.value = user;
  loans.value = [];
  fines.value = [];
  const results = await Promise.allSettled([
    getAdminUser(user._id),
    getAdminLoans({ reader: user._id, page: 1, limit: 5, sort: '-createdAt' }),
    getAdminFines({ reader: user._id, page: 1, limit: 5, sort: '-createdAt' }),
  ]);
  if (results[0].status === 'fulfilled') detailUser.value = results[0].value;
  else toast.error(results[0].reason.response?.data?.message || 'Không tải được hồ sơ người dùng.');
  if (results[1].status === 'fulfilled') loans.value = results[1].value.data || results[1].value.items || [];
  if (results[2].status === 'fulfilled') fines.value = results[2].value.data || results[2].value.items || [];
  detailLoading.value = false;
}

function closeDetails() { detailOpen.value = false; detailUser.value = null; }

async function lockUser(user) {
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
    await refreshCurrentData(user._id);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể khóa tài khoản.');
  } finally {
    busyId.value = '';
  }
}

async function unlockUser(user) {
  const confirmation = await Swal.fire({
    title: `Mở khóa tài khoản ${fullName(user)}?`,
    text: 'Người dùng sẽ có thể đăng nhập trở lại.',
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
    await refreshCurrentData(user._id);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể mở khóa tài khoản.');
  } finally {
    busyId.value = '';
  }
}

async function sendPasswordReset(user) {
  const confirmation = await Swal.fire({
    title: 'Gửi liên kết đặt lại mật khẩu?',
    text: `Liên kết sẽ được gửi tới ${user.email}.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Gửi email',
    cancelButtonText: 'Hủy',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    const result = await requestAdminPasswordReset(user._id);
    toast.success(result?.message || 'Đã gửi email hướng dẫn đặt lại mật khẩu.');
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể gửi email đặt lại mật khẩu.');
  } finally {
    busyId.value = '';
  }
}

async function changeRole(user) {
  if (!isAdmin.value || user._id === auth.user?._id) return;
  const choices = ['reader', 'staff', 'admin'].filter((value) => value !== user.role);
  const confirmation = await Swal.fire({
    title: `Đổi vai trò ${fullName(user)}?`,
    input: 'select',
    inputOptions: Object.fromEntries(choices.map((value) => [value, roleLabels[value]])),
    inputPlaceholder: 'Chọn vai trò mới',
    showCancelButton: true,
    confirmButtonText: 'Cập nhật vai trò',
    cancelButtonText: 'Hủy',
    inputValidator: (value) => (value ? undefined : 'Vui lòng chọn vai trò.'),
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = user._id;
  try {
    await updateAdminUserRole(user._id, confirmation.value);
    toast.success('Đã cập nhật vai trò.');
    await loadUsers();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể đổi vai trò.');
  } finally {
    busyId.value = '';
  }
}

async function refreshCurrentData(userId) {
  await loadUsers();
  if (detailOpen.value && detailUser.value?._id === userId) await openDetails({ ...detailUser.value });
}

function resetStaffForm() {
  showCreateModal.value = false;
  Object.assign(staffForm, { firstName: '', lastName: '', email: '', password: '', position: '', phone: '', address: '' });
}

async function submitStaff() {
  if (!isAdmin.value || creating.value) return;
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/.test(staffForm.password)) {
    toast.error('Mật khẩu cần từ 8 ký tự, có ít nhất một chữ cái và một chữ số.');
    return;
  }
  creating.value = true;
  try {
    await createAdminStaff({ ...staffForm, firstName: staffForm.firstName.trim(), lastName: staffForm.lastName.trim(), email: staffForm.email.trim() });
    toast.success('Đã tạo tài khoản nhân viên.');
    resetStaffForm();
    await loadUsers();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể tạo tài khoản nhân viên.');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <section class="users-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Người dùng</span>
    </nav>
    <div class="page-heading users-heading">
      <div>
        <h1>Quản lý người dùng</h1><p class="text-muted-strong mb-0">
          Tra cứu tài khoản và xử lý quyền truy cập.
        </p>
      </div>
      <button
        v-if="isAdmin"
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
      :rows="users"
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
      @retry="loadUsers"
    >
      <template #toolbar>
        <div class="filters">
          <label class="filter-field"><span>Trạng thái</span><select
            class="form-select form-select-sm"
            :value="status"
            @change="updateFilter('status', $event.target.value)"
          ><option value="">Tất cả</option><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select></label>
          <label
            v-if="isAdmin"
            class="filter-field"
          ><span>Vai trò</span><select
            class="form-select form-select-sm"
            :value="role"
            @change="updateFilter('role', $event.target.value)"
          ><option value="">Tất cả</option><option value="reader">Độc giả</option><option value="staff">Nhân viên</option><option value="admin">Quản trị viên</option></select></label>
        </div>
      </template>
      <template #cell-code="{ value }">
        <strong>{{ value }}</strong>
      </template>
      <template #cell-name="{ row }">
        <div class="name-cell">
          <strong>{{ fullName(row) }}</strong><small>{{ row.phone || 'Chưa có số điện thoại' }}</small>
        </div>
      </template>
      <template #cell-role="{ row }">
        <span
          class="role-badge"
          :class="`role-${row.role}`"
        >{{ roleLabels[row.role] || row.role }}</span>
      </template>
      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="row.status === 'active' ? 'status-active' : 'status-locked'"
        >{{ statusLabels[row.status] || row.status }}</span>
      </template>
      <template #cell-unpaidFineTotal="{ value }">
        {{ formatMoney(value) }}
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
            v-if="row.status === 'active' && row._id !== auth.user?._id"
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(busyId)"
            @click="lockUser(row)"
          >
            Khóa
          </button>
          <button
            v-if="row.status === 'locked'"
            class="btn btn-sm btn-outline-success"
            type="button"
            :disabled="Boolean(busyId)"
            @click="unlockUser(row)"
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
            v-if="isAdmin && row._id !== auth.user?._id"
            class="btn btn-sm btn-outline-secondary"
            type="button"
            :disabled="Boolean(busyId)"
            @click="changeRole(row)"
          >
            Đổi vai trò
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-people"
            aria-hidden="true"
          /><span>Không tìm thấy người dùng phù hợp.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách người dùng.<button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadUsers"
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
        class="user-detail surface-card"
        role="dialog"
        aria-modal="true"
        :aria-label="`Chi tiết ${fullName(detailUser)}`"
      >
        <header class="detail-header">
          <div><span class="eyebrow">Hồ sơ người dùng</span><h2>{{ fullName(detailUser) }}</h2></div><button
            class="icon-close"
            type="button"
            aria-label="Đóng chi tiết"
            @click="closeDetails"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <div
          v-if="detailLoading"
          class="detail-state"
        >
          <span class="spinner-border spinner-border-sm text-primary" /> Đang tải hồ sơ...
        </div>
        <div
          v-else-if="detailUser"
          class="detail-content"
        >
          <section class="detail-section">
            <h3>Thông tin tài khoản</h3><dl><dt>Mã</dt><dd>{{ detailUser.code }}</dd><dt>Email</dt><dd>{{ detailUser.email }}</dd><dt>Vai trò</dt><dd>{{ roleLabels[detailUser.role] }}</dd><dt>Trạng thái</dt><dd>{{ statusLabels[detailUser.status] }}</dd><dt>Điện thoại</dt><dd>{{ detailUser.phone || '—' }}</dd><dt>Địa chỉ</dt><dd>{{ detailUser.address || '—' }}</dd><dt>Nợ phạt chưa thu</dt><dd>{{ formatMoney(detailUser.unpaidFineTotal) }}</dd><dt>Lý do khóa</dt><dd>{{ detailUser.lockReason || '—' }}</dd></dl>
          </section>
          <section class="detail-section">
            <h3>Lịch sử mượn gần đây</h3><div
              v-if="!loans.length"
              class="muted-empty"
            >
              Chưa có phiếu mượn.
            </div><article
              v-for="loan in loans"
              :key="loan._id"
              class="history-row"
            >
              <strong>{{ loan.code }}</strong><span>{{ loan.items?.map((item) => item.titleSnapshot).join(', ') || 'Không có tên sách' }}</span><small>{{ formatDate(loan.createdAt) }} · {{ loan.status }}</small>
            </article>
          </section>
          <section class="detail-section">
            <h3>Các khoản phạt gần đây</h3><div
              v-if="!fines.length"
              class="muted-empty"
            >
              Chưa có khoản phạt.
            </div><article
              v-for="fine in fines"
              :key="fine._id"
              class="history-row"
            >
              <strong>{{ formatMoney(fine.amount) }} · {{ fine.type }}</strong><span>{{ fine.reason || '—' }}</span><small>{{ formatDate(fine.createdAt) }} · {{ fine.status }}</small>
            </article>
          </section>
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
            <span class="eyebrow">Chỉ quản trị viên</span><h2 id="create-staff-title">
              Tạo tài khoản nhân viên
            </h2>
          </div><button
            class="icon-close"
            type="button"
            aria-label="Đóng biểu mẫu"
            @click="resetStaffForm"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <form @submit.prevent="submitStaff">
          <div class="form-grid">
            <label class="form-field"><span>Họ lót *</span><input
              v-model.trim="staffForm.firstName"
              class="form-control"
              maxlength="50"
              required
            ></label><label class="form-field"><span>Tên *</span><input
              v-model.trim="staffForm.lastName"
              class="form-control"
              maxlength="50"
              required
            ></label>
          </div>
          <label class="form-field"><span>Email *</span><input
            v-model.trim="staffForm.email"
            class="form-control"
            type="email"
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
          ><small>Tối thiểu 8 ký tự, gồm chữ cái và chữ số.</small></label>
          <div class="form-grid">
            <label class="form-field"><span>Chức vụ</span><input
              v-model.trim="staffForm.position"
              class="form-control"
              maxlength="100"
            ></label><label class="form-field"><span>Số điện thoại</span><input
              v-model.trim="staffForm.phone"
              class="form-control"
              maxlength="20"
            ></label>
          </div>
          <label class="form-field"><span>Địa chỉ</span><input
            v-model.trim="staffForm.address"
            class="form-control"
            maxlength="255"
          ></label>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="creating"
              @click="resetStaffForm"
            >
              Hủy
            </button><button
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
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }.users-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.users-heading p { margin-top: .35rem; font-size: .9rem; }
.filters { display: flex; flex-wrap: wrap; gap: .75rem; }.filter-field { display: grid; min-width: 150px; gap: .25rem; color: #6b7280; font-size: .75rem; }.name-cell { display: grid; gap: .2rem; }.name-cell small { color: #6b7280; font-size: .75rem; }
.role-badge,.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: .75rem; font-weight: 600; white-space: nowrap; }.role-admin { background: #f5f3ff; color: #6d28d9; }.role-staff { background: #eff6ff; color: #1d4ed8; }.role-reader { background: #f3f4f6; color: #4b5563; }.status-active { background: #ecfdf5; color: #047857; }.status-locked { background: #fef2f2; color: #b91c1c; }
.row-actions { display: flex; flex-wrap: wrap; gap: .35rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.detail-backdrop,.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: flex; justify-content: flex-end; background: rgb(17 24 39 / 42%); }.user-detail { display: flex; width: min(100%, 620px); height: 100%; flex-direction: column; overflow: hidden; border-radius: 0; box-shadow: -12px 0 36px rgb(17 24 39 / 15%); }.detail-header,.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }.detail-header h2,.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }.detail-content { overflow-y: auto; padding: 1.25rem 1.5rem; }.detail-section { margin-bottom: 1.25rem; }.detail-section h3 { margin-bottom: .65rem; font-size: .95rem; }.detail-section dl { display: grid; grid-template-columns: minmax(130px, .7fr) 1.3fr; gap: .45rem .75rem; margin: 0; font-size: .85rem; }.detail-section dt { color: #6b7280; font-weight: 400; }.detail-section dd { margin: 0; overflow-wrap: anywhere; }.history-row { display: grid; gap: .2rem; padding: .65rem 0; border-bottom: 1px solid #e5e7eb; font-size: .8rem; }.history-row span,.history-row small,.muted-empty { color: #6b7280; }.detail-state { display: flex; align-items: center; justify-content: center; gap: .5rem; min-height: 200px; }
.modal-backdrop-custom { display: grid; overflow-y: auto; place-items: center; padding: 1rem; }.staff-modal { width: min(100%, 600px); max-height: calc(100vh - 2rem); overflow-y: auto; padding: 0 1.35rem 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }.staff-modal .modal-heading { margin: 0 -1.35rem 1.1rem; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }.form-field small { color: #6b7280; }.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 700px) { .users-heading { align-items: flex-start; flex-direction: column; }.users-heading > button { width: 100%; }.row-actions { align-items: flex-start; flex-direction: column; }.detail-header,.detail-content { padding-right: 1rem; padding-left: 1rem; }.form-grid { grid-template-columns: 1fr; gap: 0; }.staff-modal { padding-right: 1rem; padding-left: 1rem; }.staff-modal .modal-heading { margin-right: -1rem; margin-left: -1rem; } }
</style>
