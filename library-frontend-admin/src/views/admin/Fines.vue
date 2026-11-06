<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import { useAuthStore } from '@/stores/auth.store';
import {
  createManualFine,
  getAdminFines,
  payFine,
  searchAdminReaders,
  waiveFine,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const actionId = ref('');
const showCreateModal = ref(false);
const saving = ref(false);
const readerQuery = ref('');
const readerMatches = ref([]);
const readerSearching = ref(false);
const selectedReader = ref(null);
const form = ref({ type: 'other', amount: '', reason: '' });

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const status = computed(() => String(route.query.status || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const isAdmin = computed(() => auth.isAdmin);
const unpaidVisibleTotal = computed(() => rows.value
  .filter((fine) => fine.status === 'unpaid')
  .reduce((sum, fine) => sum + Number(fine.amount || 0), 0));
const columns = [
  { key: 'reader', label: 'Độc giả' },
  { key: 'type', label: 'Loại phạt' },
  { key: 'reason', label: 'Lý do' },
  { key: 'amount', label: 'Số tiền', sortable: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày ghi nhận', sortable: true },
  { key: 'actions', label: 'Thao tác' },
];
const typeLabels = { late: 'Trả trễ', damaged: 'Sách hư hỏng', lost: 'Mất sách', other: 'Khác' };
const statusLabels = { unpaid: 'Chưa thu', paid: 'Đã thu', waived: 'Đã miễn' };

onMounted(loadFines);
watch(() => [route.query.page, route.query.status, route.query.sort], loadFines);

async function loadFines() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminFines({
      status: status.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function updateStatus(value) {
  const query = { ...route.query, status: value || undefined, page: undefined };
  router.replace({ query });
}

function updatePage(value) {
  router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } });
}

function updateSort({ key, order }) {
  router.replace({ query: { ...route.query, sort: order === 'desc' ? `-${key}` : key, page: undefined } });
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

function readerName(reader) {
  return [reader?.firstName, reader?.lastName].filter(Boolean).join(' ') || '—';
}

async function findReaders() {
  const query = readerQuery.value.trim();
  if (!query) {
    readerMatches.value = [];
    return;
  }
  readerSearching.value = true;
  try {
    readerMatches.value = await searchAdminReaders(query);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tìm được độc giả.');
  } finally {
    readerSearching.value = false;
  }
}

function chooseReader(reader) {
  selectedReader.value = reader;
  readerMatches.value = [];
  readerQuery.value = `${reader.code || ''} — ${readerName(reader)}`;
}

function resetCreateForm() {
  showCreateModal.value = false;
  selectedReader.value = null;
  readerQuery.value = '';
  readerMatches.value = [];
  form.value = { type: 'other', amount: '', reason: '' };
}

async function submitManualFine() {
  if (!selectedReader.value?._id || !form.value.amount || Number(form.value.amount) <= 0 || !form.value.reason.trim()) {
    toast.error('Vui lòng chọn độc giả và nhập số tiền, lý do hợp lệ.');
    return;
  }
  saving.value = true;
  try {
    await createManualFine({
      reader: selectedReader.value._id,
      type: form.value.type,
      amount: Number(form.value.amount),
      reason: form.value.reason.trim(),
    });
    toast.success('Đã ghi nhận khoản phạt.');
    resetCreateForm();
    await loadFines();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể ghi nhận khoản phạt.');
  } finally {
    saving.value = false;
  }
}

async function confirmPayment(fine) {
  const confirmation = await Swal.fire({
    title: 'Xác nhận đã thu tiền?',
    text: `Xác nhận đã thu ${formatMoney(fine.amount)} tại quầy từ ${readerName(fine.reader)}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Đã thu tiền',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: '#2563eb',
  });
  if (!confirmation.isConfirmed) return;
  actionId.value = fine._id;
  try {
    await payFine(fine._id);
    toast.success('Đã xác nhận thu phạt tại quầy.');
    await loadFines();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể xác nhận đã thu khoản phạt.');
  } finally {
    actionId.value = '';
  }
}

async function confirmWaiver(fine) {
  if (!isAdmin.value) return;
  const result = await Swal.fire({
    title: 'Miễn khoản phạt này?',
    text: `Khoản phạt ${formatMoney(fine.amount)} sẽ được miễn và cần lưu lý do.`,
    input: 'textarea',
    inputLabel: 'Lý do miễn phạt',
    inputPlaceholder: 'Nhập lý do (bắt buộc)',
    inputAttributes: { maxlength: 500, 'aria-label': 'Lý do miễn phạt' },
    showCancelButton: true,
    confirmButtonText: 'Miễn phạt',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
    inputValidator: (value) => (value?.trim() ? undefined : 'Vui lòng nhập lý do miễn phạt.'),
  });
  if (!result.isConfirmed) return;
  actionId.value = fine._id;
  try {
    await waiveFine(fine._id, result.value.trim());
    toast.success('Đã miễn khoản phạt.');
    await loadFines();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể miễn khoản phạt.');
  } finally {
    actionId.value = '';
  }
}
</script>

<template>
  <section class="fines-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Quản lý phạt</span>
    </nav>
    <div class="page-heading fines-heading">
      <div>
        <h1>Quản lý phạt</h1>
        <p class="text-muted-strong mb-0">
          Ghi nhận khoản phạt và xác nhận thu tiền tại quầy.
        </p>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        @click="showCreateModal = true"
      >
        <i
          class="bi bi-plus-lg me-1"
          aria-hidden="true"
        />Thêm phạt thủ công
      </button>
    </div>

    <div class="fine-summary surface-card">
      <div class="summary-icon">
        <i
          class="bi bi-cash-coin"
          aria-hidden="true"
        />
      </div>
      <div><span>Tổng phạt chưa thu trên trang này</span><strong>{{ formatMoney(unpaidVisibleTotal) }}</strong></div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :searchable="false"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadFines"
    >
      <template #toolbar>
        <label class="status-filter">
          <span>Lọc trạng thái</span>
          <select
            class="form-select form-select-sm"
            :value="status"
            @change="updateStatus($event.target.value)"
          >
            <option value="">Tất cả</option>
            <option value="unpaid">Chưa thu</option>
            <option value="paid">Đã thu</option>
            <option value="waived">Đã miễn</option>
          </select>
        </label>
      </template>
      <template #cell-reader="{ row }">
        <div class="reader-cell">
          <strong>{{ readerName(row.reader) }}</strong><small>{{ row.reader?.code || row.reader?.email || '—' }}</small>
        </div>
      </template>
      <template #cell-type="{ value }">
        {{ typeLabels[value] || value }}
      </template>
      <template #cell-reason="{ row }">
        <span class="reason-cell">{{ row.status === 'waived' ? `${row.reason || ''} (Lý do miễn: ${row.waivedReason || '—'})` : row.reason || '—' }}</span>
      </template>
      <template #cell-amount="{ value }">
        {{ formatMoney(value) }}
      </template>
      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="`status-${row.status}`"
        >{{ statusLabels[row.status] || row.status }}</span>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            v-if="row.status === 'unpaid'"
            class="btn btn-sm btn-primary"
            type="button"
            :disabled="Boolean(actionId)"
            @click="confirmPayment(row)"
          >
            <span
              v-if="actionId === row._id"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />
            Đã thu tại quầy
          </button>
          <button
            v-if="isAdmin && row.status === 'unpaid'"
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(actionId)"
            @click="confirmWaiver(row)"
          >
            Miễn phạt
          </button>
          <span
            v-if="row.status === 'paid'"
            class="text-muted-strong"
          >{{ formatDate(row.paidAt) }}</span>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-cash-stack"
            aria-hidden="true"
          /><span>Không có khoản phạt phù hợp.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách phạt.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadFines"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="showCreateModal"
      class="modal-backdrop-custom"
      @click.self="resetCreateForm"
    >
      <section
        class="fine-modal surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-fine-title"
      >
        <header class="modal-heading">
          <div>
            <span class="eyebrow">Quản lý phạt</span><h2 id="create-fine-title">
              Thêm phạt thủ công
            </h2>
          </div><button
            class="icon-close"
            type="button"
            aria-label="Đóng"
            @click="resetCreateForm"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <form @submit.prevent="submitManualFine">
          <label
            class="form-label"
            for="reader-search"
          >Độc giả</label>
          <div class="reader-search-row">
            <input
              id="reader-search"
              v-model="readerQuery"
              class="form-control"
              type="search"
              placeholder="Mã, tên, email hoặc số điện thoại"
            ><button
              class="btn btn-outline-primary"
              type="button"
              :disabled="readerSearching"
              @click="findReaders"
            >
              Tìm
            </button>
          </div>
          <span
            v-if="selectedReader"
            class="selected-reader"
          ><i class="bi bi-person-check" /> Đã chọn: {{ selectedReader.code }} — {{ readerName(selectedReader) }}</span>
          <div
            v-if="readerMatches.length"
            class="reader-results"
          >
            <button
              v-for="reader in readerMatches"
              :key="reader._id"
              type="button"
              class="reader-option"
              @click="chooseReader(reader)"
            >
              <strong>{{ reader.code }} · {{ readerName(reader) }}</strong><small>{{ reader.email }} · {{ reader.phone || 'Chưa có số điện thoại' }}</small>
            </button>
          </div>
          <div class="form-grid">
            <label class="form-field"><span>Loại phạt</span><select
              v-model="form.type"
              class="form-select"
            ><option value="damaged">Sách hư hỏng</option><option value="lost">Mất sách</option><option value="other">Khác</option></select></label>
            <label class="form-field"><span>Số tiền (VND)</span><input
              v-model="form.amount"
              class="form-control"
              type="number"
              min="1"
              step="1"
              required
            ></label>
          </div>
          <label class="form-field"><span>Lý do</span><textarea
            v-model="form.reason"
            class="form-control"
            rows="3"
            maxlength="500"
            required
          /></label>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="saving"
              @click="resetCreateForm"
            >
              Hủy
            </button><button
              class="btn btn-primary"
              type="submit"
              :disabled="saving || !selectedReader"
            >
              <span
                v-if="saving"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />Ghi nhận khoản phạt
            </button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.fines-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.fines-heading p { margin-top: .35rem; font-size: .9rem; }
.fine-summary { display: flex; align-items: center; gap: .85rem; margin-bottom: 1rem; padding: 1rem 1.25rem; }
.summary-icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border-radius: .75rem; background: #eff6ff; color: #2563eb; font-size: 1.25rem; }
.fine-summary > div:last-child { display: grid; gap: .2rem; }.fine-summary span { color: #6b7280; font-size: .8rem; }.fine-summary strong { font-size: 1.15rem; }
.status-filter { display: flex; align-items: center; gap: .5rem; color: #6b7280; font-size: .8rem; }.status-filter select { min-width: 145px; }
.reader-cell { display: grid; gap: .2rem; }.reader-cell small { color: #6b7280; font-size: .75rem; }.reason-cell { display: block; max-width: 300px; white-space: normal; }
.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: .75rem; font-weight: 600; white-space: nowrap; }.status-unpaid { background: #fff7ed; color: #c2410c; }.status-paid { background: #ecfdf5; color: #047857; }.status-waived { background: #eff6ff; color: #1d4ed8; }
.row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: grid; overflow-y: auto; place-items: center; padding: 1rem; background: rgb(17 24 39 / 45%); }
.fine-modal { width: min(100%, 560px); padding: 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }
.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }.reader-search-row { display: flex; gap: .5rem; }.selected-reader { display: block; margin-top: .5rem; color: #047857; font-size: .8rem; }.reader-results { display: grid; max-height: 180px; overflow-y: auto; margin: .5rem 0 1rem; border: 1px solid #e5e7eb; border-radius: .5rem; }.reader-option { display: grid; gap: .2rem; padding: .65rem .75rem; border: 0; border-bottom: 1px solid #e5e7eb; background: #fff; text-align: left; }.reader-option:hover { background: #f9fafb; }.reader-option small { color: #6b7280; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin: 1rem 0; }.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 575.98px) { .fines-heading { align-items: flex-start; flex-direction: column; }.fines-heading > button { width: 100%; }.form-grid { grid-template-columns: 1fr; gap: 0; }.fine-modal { padding: 1rem; }.row-actions { align-items: flex-start; flex-direction: column; } }
</style>
