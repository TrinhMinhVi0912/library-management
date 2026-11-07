<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import {
  createAdminNotification,
  deleteAdminNotification,
  findAdminNotificationRecipients,
  getAdminNotifications,
  getAdminUser,
  updateAdminNotification,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const notifications = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);
const actionId = ref('');
const modalOpen = ref(false);
const editingNotification = ref(null);
const recipientQuery = ref('');
const recipientResults = ref([]);
const recipientLoading = ref(false);
const selectedRecipient = ref(null);
const form = reactive({ audience: 'readers', type: 'system', title: '', content: '', link: '', expiresAt: '' });

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const query = computed(() => String(route.query.q || ''));
const audienceFilter = computed(() => String(route.query.audience || ''));
const typeFilter = computed(() => String(route.query.type || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const columns = [
  { key: 'title', label: 'Tiêu đề', sortable: true },
  { key: 'audience', label: 'Đối tượng' },
  { key: 'type', label: 'Loại' },
  { key: 'content', label: 'Nội dung' },
  { key: 'expiresAt', label: 'Hạn hiển thị', sortable: true },
  { key: 'createdAt', label: 'Ngày gửi', sortable: true },
];
const audienceLabels = { all: 'Mọi người', readers: 'Độc giả', staff: 'Nhân viên', user: 'Một người' };
const typeLabels = { loan: 'Mượn sách', renewal: 'Gia hạn', due: 'Sắp đến hạn', overdue: 'Quá hạn', fine: 'Phạt', reservation: 'Đặt trước', forum: 'Diễn đàn', system: 'Hệ thống' };
const userRoleLabels = { reader: 'Độc giả', staff: 'Nhân viên', admin: 'Quản trị viên' };
const audienceOptions = [
  { value: 'all', label: 'Mọi người' },
  { value: 'readers', label: 'Tất cả độc giả' },
  { value: 'staff', label: 'Tất cả nhân viên' },
  { value: 'user', label: 'Một người cụ thể' },
];
const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }));

onMounted(loadNotifications);
watch(() => [route.query.page, route.query.q, route.query.audience, route.query.type, route.query.sort], loadNotifications);
watch(() => form.audience, (value) => {
  if (value !== 'user') {
    selectedRecipient.value = null;
    recipientQuery.value = '';
    recipientResults.value = [];
  }
});

async function loadNotifications() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminNotifications({
      q: query.value || undefined,
      audience: audienceFilter.value || undefined,
      type: typeFilter.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    notifications.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
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

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return 'Không hết hạn';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function recipientName(recipient) {
  return [recipient?.firstName, recipient?.lastName].filter(Boolean).join(' ') || recipient?.email || 'Người dùng';
}

function resetForm() {
  modalOpen.value = false;
  editingNotification.value = null;
  recipientQuery.value = '';
  recipientResults.value = [];
  selectedRecipient.value = null;
  Object.assign(form, { audience: 'readers', type: 'system', title: '', content: '', link: '', expiresAt: '' });
}

function openCreate() {
  resetForm();
  modalOpen.value = true;
}

async function openEdit(notification) {
  editingNotification.value = notification;
  Object.assign(form, {
    audience: notification.audience,
    type: notification.type,
    title: notification.title || '',
    content: notification.content || '',
    link: notification.link || '',
    expiresAt: localDateTime(notification.expiresAt),
  });
  recipientQuery.value = '';
  selectedRecipient.value = null;
  if (notification.audience === 'user' && notification.recipient) {
    const recipientId = typeof notification.recipient === 'object' ? notification.recipient._id : notification.recipient;
    try {
      selectedRecipient.value = await getAdminUser(recipientId);
      recipientQuery.value = `${selectedRecipient.value.code || ''} — ${recipientName(selectedRecipient.value)}`;
    } catch {
      recipientQuery.value = `ID: ${recipientId}`;
      toast.error('Không tải được thông tin người nhận. Hãy tìm và chọn lại người dùng.');
    }
  }
  modalOpen.value = true;
}

async function searchRecipients() {
  const value = recipientQuery.value.trim();
  if (!value) {
    recipientResults.value = [];
    return;
  }
  recipientLoading.value = true;
  try {
    recipientResults.value = await findAdminNotificationRecipients(value);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tìm được người nhận.');
  } finally {
    recipientLoading.value = false;
  }
}

function chooseRecipient(user) {
  selectedRecipient.value = user;
  recipientResults.value = [];
  recipientQuery.value = `${user.code || ''} — ${recipientName(user)}`;
}

async function submitNotification() {
  if (saving.value) return;
  if (form.audience === 'user' && !selectedRecipient.value?._id) {
    toast.error('Hãy tìm và chọn người nhận thông báo.');
    return;
  }
  const payload = {
    audience: form.audience,
    type: form.type,
    title: form.title.trim(),
    content: form.content.trim(),
    link: form.link.trim() || null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  };
  if (form.audience === 'user') payload.recipient = selectedRecipient.value._id;
  saving.value = true;
  try {
    if (editingNotification.value?._id) {
      await updateAdminNotification(editingNotification.value._id, payload);
      toast.success('Đã cập nhật thông báo.');
    } else {
      await createAdminNotification(payload);
      toast.success('Đã gửi thông báo.');
    }
    resetForm();
    await loadNotifications();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể lưu thông báo.');
  } finally {
    saving.value = false;
  }
}

async function removeNotification(notification) {
  const confirmation = await Swal.fire({
    title: 'Xóa thông báo?',
    text: `“${notification.title}” sẽ bị xóa khỏi danh sách thông báo người nhận.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Xóa thông báo',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!confirmation.isConfirmed) return;
  actionId.value = notification._id;
  try {
    await deleteAdminNotification(notification._id);
    toast.success('Đã xóa thông báo.');
    await loadNotifications();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể xóa thông báo.');
  } finally {
    actionId.value = '';
  }
}
</script>

<template>
  <section class="notifications-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Thông báo</span>
    </nav>
    <div class="page-heading notifications-heading">
      <div>
        <h1>Quản lý thông báo</h1><p class="text-muted-strong mb-0">
          Soạn và quản lý thông báo gửi tới người dùng.
        </p>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        @click="openCreate"
      >
        <i
          class="bi bi-send me-1"
          aria-hidden="true"
        />Soạn thông báo
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="notifications"
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
      @retry="loadNotifications"
    >
      <template #toolbar>
        <div class="filters">
          <label class="filter-field"><span>Đối tượng</span><select
            class="form-select form-select-sm"
            :value="audienceFilter"
            @change="updateFilter('audience', $event.target.value)"
          ><option value="">Tất cả</option><option value="all">Mọi người</option><option value="readers">Độc giả</option><option value="staff">Nhân viên</option><option value="user">Một người</option></select></label>
          <label class="filter-field"><span>Loại</span><select
            class="form-select form-select-sm"
            :value="typeFilter"
            @change="updateFilter('type', $event.target.value)"
          ><option value="">Tất cả</option><option
            v-for="option in typeOptions"
            :key="option.value"
            :value="option.value"
          >{{ option.label }}</option></select></label>
        </div>
      </template>
      <template #cell-title="{ row }">
        <div class="title-cell">
          <strong>{{ row.title }}</strong><small v-if="row.audience === 'user'">Người nhận: {{ row.recipient }}</small>
        </div>
      </template>
      <template #cell-audience="{ value }">
        <span
          class="audience-badge"
          :class="`audience-${value}`"
        >{{ audienceLabels[value] || value }}</span>
      </template>
      <template #cell-type="{ value }">
        {{ typeLabels[value] || value }}
      </template>
      <template #cell-content="{ value }">
        <span class="content-cell">{{ value }}</span>
      </template>
      <template #cell-expiresAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #row="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-sm btn-outline-primary"
            type="button"
            :disabled="Boolean(actionId)"
            @click="openEdit(row)"
          >
            Sửa
          </button><button
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(actionId)"
            @click="removeNotification(row)"
          >
            <span
              v-if="actionId === row._id"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />Xóa
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-bell-slash"
            aria-hidden="true"
          /><span>Chưa có thông báo phù hợp.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách thông báo.<button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadNotifications"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="modalOpen"
      class="modal-backdrop-custom"
      @click.self="resetForm"
    >
      <section
        class="notification-modal surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
      >
        <header class="modal-heading">
          <div>
            <span class="eyebrow">Thông báo thư viện</span><h2 id="notification-modal-title">
              {{ editingNotification ? 'Sửa thông báo' : 'Soạn thông báo' }}
            </h2>
          </div><button
            class="icon-close"
            type="button"
            aria-label="Đóng biểu mẫu"
            @click="resetForm"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <form @submit.prevent="submitNotification">
          <div class="form-grid">
            <label class="form-field"><span>Đối tượng nhận *</span><select
              v-model="form.audience"
              class="form-select"
              required
            ><option
              v-for="option in audienceOptions"
              :key="option.value"
              :value="option.value"
            >{{ option.label }}</option></select></label>
            <label class="form-field"><span>Loại thông báo *</span><select
              v-model="form.type"
              class="form-select"
              required
            ><option
              v-for="option in typeOptions"
              :key="option.value"
              :value="option.value"
            >{{ option.label }}</option></select></label>
          </div>
          <div
            v-if="form.audience === 'user'"
            class="form-field recipient-field"
          >
            <label for="recipient-search">Người nhận *</label>
            <div class="search-row">
              <input
                id="recipient-search"
                v-model="recipientQuery"
                class="form-control"
                type="search"
                placeholder="Mã, tên, email hoặc số điện thoại"
              ><button
                class="btn btn-outline-primary"
                type="button"
                :disabled="recipientLoading"
                @click="searchRecipients"
              >
                Tìm
              </button>
            </div>
            <small
              v-if="selectedRecipient"
              class="selected-recipient"
            ><i class="bi bi-person-check" /> Đã chọn {{ recipientName(selectedRecipient) }} · {{ selectedRecipient.email }}</small>
            <div
              v-if="recipientResults.length"
              class="recipient-results"
            >
              <button
                v-for="user in recipientResults"
                :key="user._id"
                class="recipient-option"
                type="button"
                @click="chooseRecipient(user)"
              >
                <strong>{{ user.code }} · {{ recipientName(user) }}</strong><small>{{ userRoleLabels[user.role] || user.role }} · {{ user.email }}</small>
              </button>
            </div>
          </div>
          <label class="form-field"><span>Tiêu đề *</span><input
            v-model.trim="form.title"
            class="form-control"
            maxlength="150"
            required
          ></label>
          <label class="form-field"><span>Nội dung *</span><textarea
            v-model.trim="form.content"
            class="form-control"
            rows="5"
            maxlength="5000"
            required
          /></label>
          <div class="form-grid">
            <label class="form-field"><span>Đường dẫn khi bấm (không bắt buộc)</span><input
              v-model.trim="form.link"
              class="form-control"
              maxlength="500"
              placeholder="/my/loans"
            ></label>
            <label class="form-field"><span>Hạn hiển thị (không bắt buộc)</span><input
              v-model="form.expiresAt"
              class="form-control"
              type="datetime-local"
            ></label>
          </div>
          <p class="send-hint">
            <i
              class="bi bi-info-circle"
              aria-hidden="true"
            /> Thông báo mới sẽ được gửi realtime tới người nhận đang trực tuyến.
          </p>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="saving"
              @click="resetForm"
            >
              Hủy
            </button><button
              class="btn btn-primary"
              type="submit"
              :disabled="saving || !form.title.trim() || !form.content.trim() || (form.audience === 'user' && !selectedRecipient)"
            >
              <span
                v-if="saving"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />{{ editingNotification ? 'Lưu thay đổi' : 'Gửi thông báo' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }.notifications-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.notifications-heading p { margin-top: .35rem; font-size: .9rem; }
.filters { display: flex; flex-wrap: wrap; gap: .75rem; }.filter-field { display: grid; min-width: 150px; gap: .25rem; color: #6b7280; font-size: .75rem; }.title-cell { display: grid; min-width: 150px; gap: .2rem; }.title-cell small { color: #6b7280; font-size: .75rem; }.content-cell { display: block; max-width: 320px; white-space: normal; }.audience-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: .75rem; font-weight: 600; white-space: nowrap; }.audience-all { background: #f5f3ff; color: #6d28d9; }.audience-staff { background: #fff7ed; color: #c2410c; }.audience-user { background: #ecfdf5; color: #047857; }.row-actions { display: flex; gap: .4rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: grid; overflow-y: auto; place-items: center; padding: 1rem; background: rgb(17 24 39 / 45%); }.notification-modal { width: min(100%, 720px); max-height: calc(100vh - 2rem); overflow-y: auto; padding: 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.1rem; }.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }.search-row { display: flex; gap: .5rem; }.selected-recipient { display: block; margin-top: .5rem; color: #047857; }.recipient-results { display: grid; max-height: 180px; overflow-y: auto; margin-top: .4rem; border: 1px solid #e5e7eb; border-radius: .5rem; }.recipient-option { display: grid; gap: .2rem; padding: .65rem .75rem; border: 0; border-bottom: 1px solid #e5e7eb; background: #fff; text-align: left; }.recipient-option:hover { background: #f9fafb; }.recipient-option small { color: #6b7280; }.send-hint { display: flex; align-items: flex-start; gap: .45rem; color: #6b7280; font-size: .8rem; }.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 650px) { .notifications-heading { align-items: flex-start; flex-direction: column; }.notifications-heading > button { width: 100%; }.form-grid { grid-template-columns: 1fr; gap: 0; }.notification-modal { padding: 1rem; }.row-actions { align-items: flex-start; flex-direction: column; } }
</style>
