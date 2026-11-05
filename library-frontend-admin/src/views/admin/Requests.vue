<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import DataTable from '@/components/admin/DataTable.vue';
import {
  approveLoan,
  getAdminLoan,
  getAdminLoans,
  getCounters,
  getDashboardSummary,
  rejectLoan,
} from '@/services/admin.service';
import { useNotificationStore } from '@/stores/notification.store';

dayjs.locale('vi');
const route = useRoute();
const router = useRouter();
const toast = useToast();
const notifications = useNotificationStore();
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const selectedIds = ref(new Set());
const actingId = ref('');
const bulkLoading = ref(false);
const detail = ref(null);
const selectedLoan = ref(null);
const detailLoading = ref(false);
const detailError = ref(false);
const activeLoanCount = ref(0);

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const searchQuery = computed(() => String(route.query.q || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const allVisibleSelected = computed(() => rows.value.length > 0 && rows.value.every((loan) => selectedIds.value.has(loan._id)));
const columns = [
  { key: 'select', label: '' },
  { key: 'code', label: 'Mã phiếu', sortable: true },
  { key: 'readerName', label: 'Độc giả' },
  { key: 'itemCount', label: 'Số sách' },
  { key: 'createdAt', label: 'Ngày gửi', sortable: true },
];

onMounted(loadRequests);
watch(() => [route.query.page, route.query.q, route.query.sort], loadRequests);

async function loadRequests() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminLoans({
      status: 'pending',
      q: searchQuery.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.data) ? result.data : [];
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
    selectedIds.value = new Set([...selectedIds.value].filter((id) => rows.value.some((loan) => loan._id === id)));
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function updateQuery(value) {
  router.replace({
    query: { ...route.query, q: value.trim() || undefined, page: undefined },
  });
}

function updatePage(value) {
  router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } });
}

function updateSort({ key, order }) {
  router.replace({ query: { ...route.query, sort: order === 'desc' ? `-${key}` : key, page: undefined } });
}

function toggleSelected(id, checked) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedIds.value = next;
}

function toggleVisible(checked) {
  selectedIds.value = checked ? new Set(rows.value.map((loan) => loan._id)) : new Set();
}

async function openDetail(loan) {
  selectedLoan.value = loan;
  detail.value = null;
  detailError.value = false;
  detailLoading.value = true;
  activeLoanCount.value = 0;
  try {
    const loanDetail = await getAdminLoan(loan._id);
    detail.value = loanDetail;
    const readerId = loanDetail?.reader?._id;
    if (readerId) {
      const [borrowing, overdue] = await Promise.all([
        getAdminLoans({ reader: readerId, status: 'borrowing', page: 1, limit: 1 }),
        getAdminLoans({ reader: readerId, status: 'overdue', page: 1, limit: 1 }),
      ]);
      activeLoanCount.value = Number(borrowing.meta?.total || 0) + Number(overdue.meta?.total || 0);
    }
  } catch {
    detailError.value = true;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  detail.value = null;
  selectedLoan.value = null;
  detailError.value = false;
}

async function handleApprove(loan) {
  const target = loan || detail.value;
  if (!target?._id || actingId.value) return;
  actingId.value = target._id;
  try {
    await approveLoan(target._id);
    toast.success(`Đã duyệt phiếu ${target.code}.`);
    closeDetail();
    await refreshAfterMutation();
  } catch (error) {
    const message = error.response?.data?.message || 'Không thể duyệt phiếu mượn. Vui lòng thử lại.';
    toast.error(`Phiếu ${target.code}: ${message}`);
    await loadRequests();
  } finally {
    actingId.value = '';
  }
}

async function handleReject(loan) {
  const target = loan || detail.value;
  if (!target?._id || actingId.value) return;
  const result = await Swal.fire({
    title: `Từ chối phiếu ${target.code}?`,
    text: 'Vui lòng nhập lý do để thông báo cho độc giả.',
    input: 'textarea',
    inputLabel: 'Lý do từ chối',
    inputPlaceholder: 'Nhập lý do (bắt buộc)',
    inputAttributes: { maxlength: 500, 'aria-label': 'Lý do từ chối' },
    showCancelButton: true,
    confirmButtonText: 'Từ chối phiếu',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: '#dc2626',
    inputValidator: (value) => (value?.trim() ? undefined : 'Vui lòng nhập lý do từ chối.'),
  });
  if (!result.isConfirmed) return;

  actingId.value = target._id;
  try {
    await rejectLoan(target._id, result.value.trim());
    toast.success(`Đã từ chối phiếu ${target.code}.`);
    closeDetail();
    await refreshAfterMutation();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể từ chối phiếu mượn. Vui lòng thử lại.');
    await loadRequests();
  } finally {
    actingId.value = '';
  }
}

async function handleBulkApprove() {
  const ids = [...selectedIds.value];
  if (!ids.length || bulkLoading.value) return;
  const confirmation = await Swal.fire({
    title: `Duyệt ${ids.length} yêu cầu?`,
    text: 'Mỗi phiếu được kiểm tra tồn kho riêng. Phiếu lỗi sẽ được giữ lại để xử lý.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Duyệt các phiếu',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#2563eb',
  });
  if (!confirmation.isConfirmed) return;

  bulkLoading.value = true;
  const failures = [];
  let succeeded = 0;
  for (const id of ids) {
    const loan = rows.value.find((item) => item._id === id);
    try {
      await approveLoan(id);
      succeeded += 1;
    } catch (error) {
      const code = loan?.code || id;
      const message = error.response?.data?.message || 'Không thể duyệt phiếu.';
      failures.push(`${code}: ${message}`);
    }
  }
  selectedIds.value = new Set();
  if (succeeded) toast.success(`Đã duyệt ${succeeded} phiếu.`);
  if (failures.length) toast.error(`Không duyệt được ${failures.length} phiếu: ${failures.slice(0, 2).join(' · ')}`);
  await refreshAfterMutation();
  bulkLoading.value = false;
}

async function refreshAfterMutation() {
  const [listResult, counterResult, summaryResult] = await Promise.allSettled([
    loadRequests(),
    getCounters(),
    getDashboardSummary(),
  ]);
  if (counterResult.status === 'fulfilled') notifications.setCounters(counterResult.value);
  else if (summaryResult.status === 'fulfilled') {
    notifications.setCounters({
      pendingLoans: summaryResult.value.pendingLoans,
      pendingRenewals: summaryResult.value.pendingRenewals,
    });
  }
  if (listResult.status === 'rejected') loadError.value = true;
}

function formatName(reader) {
  return [reader?.firstName, reader?.lastName].filter(Boolean).join(' ') || 'Độc giả';
}

function formatDate(value) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
}
</script>

<template>
  <section>
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span>
      <i
        class="bi bi-chevron-right"
        aria-hidden="true"
      />
      <span aria-current="page">Duyệt yêu cầu mượn</span>
    </nav>

    <div class="page-heading requests-heading">
      <div>
        <h1>Duyệt yêu cầu mượn</h1>
        <p class="text-muted-strong mb-0">
          {{ total }} phiếu đang chờ xử lý
        </p>
      </div>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="!selectedIds.size || bulkLoading"
        @click="handleBulkApprove"
      >
        <span
          v-if="bulkLoading"
          class="spinner-border spinner-border-sm me-1"
          aria-hidden="true"
        />
        Duyệt đã chọn ({{ selectedIds.size }})
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :query="searchQuery"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @update:query="updateQuery"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadRequests"
    >
      <template #toolbar>
        <label class="select-visible">
          <input
            type="checkbox"
            :checked="allVisibleSelected"
            :disabled="loading || !rows.length"
            @change="toggleVisible($event.target.checked)"
          >
          <span>Chọn trang này</span>
        </label>
      </template>

      <template #cell-select="{ row }">
        <input
          type="checkbox"
          :aria-label="`Chọn phiếu ${row.code}`"
          :checked="selectedIds.has(row._id)"
          @change="toggleSelected(row._id, $event.target.checked)"
        >
      </template>
      <template #cell-code="{ row }">
        <button
          class="link-button"
          type="button"
          @click="openDetail(row)"
        >
          {{ row.code }}
        </button>
      </template>
      <template #cell-readerName="{ row }">
        <span>{{ formatName(row.reader) }}</span>
        <small class="d-block text-muted-strong">{{ row.reader?.code || row.reader?.email || '' }}</small>
      </template>
      <template #cell-itemCount="{ row }">
        {{ row.items?.length || 0 }}
      </template>
      <template #cell-createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>
      <template #row="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-outline-primary btn-sm"
            type="button"
            :disabled="Boolean(actingId)"
            @click="openDetail(row)"
          >
            Chi tiết
          </button>
          <button
            class="btn btn-primary btn-sm"
            type="button"
            :disabled="Boolean(actingId)"
            @click="handleApprove(row)"
          >
            Duyệt
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-inbox"
            aria-hidden="true"
          />
          <span>Không có yêu cầu mượn nào đang chờ duyệt.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách yêu cầu.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadRequests"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="detail || detailLoading || detailError"
      class="detail-backdrop"
      @click.self="closeDetail"
    >
      <aside
        class="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-detail-title"
      >
        <header class="detail-header">
          <div>
            <p class="mb-1 text-muted-strong">
              Chi tiết yêu cầu
            </p>
            <h2 id="loan-detail-title">
              {{ detail?.code || 'Phiếu mượn' }}
            </h2>
          </div>
          <button
            class="btn-close"
            type="button"
            aria-label="Đóng chi tiết"
            @click="closeDetail"
          />
        </header>

        <div
          v-if="detailLoading"
          class="panel-state"
          role="status"
        >
          <span
            class="spinner-border text-primary"
            aria-hidden="true"
          />
          Đang tải thông tin phiếu và độc giả...
        </div>
        <div
          v-else-if="detailError"
          class="panel-state text-danger"
          role="alert"
        >
          Không tải được chi tiết phiếu.
          <button
            class="btn btn-outline-primary btn-sm"
            type="button"
            @click="selectedLoan && openDetail(selectedLoan)"
          >
            Thử lại
          </button>
        </div>
        <template v-else-if="detail">
          <section class="detail-section">
            <h3>Thông tin độc giả</h3>
            <dl class="detail-list">
              <div><dt>Họ tên</dt><dd>{{ formatName(detail.reader) }}</dd></div>
              <div><dt>Mã độc giả</dt><dd>{{ detail.reader?.code || '—' }}</dd></div>
              <div><dt>Email</dt><dd>{{ detail.reader?.email || '—' }}</dd></div>
              <div><dt>Đang mượn</dt><dd>{{ activeLoanCount }} phiếu</dd></div>
              <div><dt>Nợ phạt</dt><dd>{{ formatMoney(detail.reader?.unpaidFineTotal) }}</dd></div>
            </dl>
          </section>

          <section class="detail-section">
            <h3>Sách yêu cầu ({{ detail.items?.length || 0 }})</h3>
            <ul class="book-list">
              <li
                v-for="item in detail.items"
                :key="item._id"
              >
                <div>
                  <strong>{{ item.titleSnapshot || item.book?.title || 'Sách' }}</strong>
                  <small class="d-block text-muted-strong">{{ item.book?.code || '' }}</small>
                </div>
                <span
                  class="availability"
                  :class="{ 'text-danger': item.book && item.book.availableCopies < 1 }"
                >
                  {{ item.book ? `${item.book.availableCopies} bản khả dụng` : 'Không có dữ liệu tồn kho' }}
                </span>
              </li>
            </ul>
            <p
              v-if="detail.items?.some((item) => item.book && item.book.availableCopies < 1)"
              class="stock-note"
              role="note"
            >
              Một số sách đang không còn bản khả dụng. Backend sẽ kiểm tra tồn kho nguyên tử khi duyệt và trả về tên sách hết nếu không thể cấp; trường hợp có bản giữ theo đặt trước vẫn được backend xác minh.
            </p>
          </section>

          <section
            v-if="detail.requestNote"
            class="detail-section"
          >
            <h3>Ghi chú của độc giả</h3>
            <p class="mb-0">
              {{ detail.requestNote }}
            </p>
          </section>

          <footer class="detail-actions">
            <button
              class="btn btn-outline-danger"
              type="button"
              :disabled="Boolean(actingId)"
              @click="handleReject()"
            >
              Từ chối
            </button>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="Boolean(actingId)"
              @click="handleApprove()"
            >
              <span
                v-if="actingId === detail._id"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />
              Duyệt yêu cầu
            </button>
          </footer>
        </template>
      </aside>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #6b7280;
  font-size: 0.825rem;
}

.requests-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.requests-heading p {
  margin-top: 0.35rem;
  font-size: 0.9rem;
}

.select-visible,
.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.select-visible {
  color: #6b7280;
  font-size: 0.825rem;
  white-space: nowrap;
}

.link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
}

.link-button:hover { text-decoration: underline; }

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem;
}

.detail-backdrop {
  position: fixed;
  z-index: 1080;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(17, 24, 39, 0.4);
}

.detail-panel {
  display: flex;
  width: min(100%, 560px);
  height: 100%;
  flex-direction: column;
  overflow-y: auto;
  background: #fff;
  box-shadow: 0 0.5rem 1.5rem rgba(17, 24, 39, 0.16);
}

.detail-header {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.detail-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.detail-section {
  padding: 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail-section h3 {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.detail-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.detail-list > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.detail-list dt { color: #6b7280; font-weight: 400; }
.detail-list dd { margin: 0; text-align: right; overflow-wrap: anywhere; }

.book-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.book-list li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.availability {
  flex: 0 0 auto;
  color: #166534;
  font-size: 0.8rem;
}

.stock-note {
  margin: 1rem 0 0;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.825rem;
}

.panel-state {
  display: grid;
  min-height: 220px;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  text-align: center;
}

.detail-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: auto;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

@media (max-width: 575.98px) {
  .requests-heading { align-items: flex-start; flex-direction: column; }
  .requests-heading > button { width: 100%; }
  .detail-panel { width: 100%; }
  .book-list li { flex-direction: column; }
}
</style>
