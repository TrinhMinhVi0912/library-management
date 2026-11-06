<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import DataTable from '@/components/admin/DataTable.vue';
import { getAdminLoan, getAdminLoans } from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const selectedLoan = ref(null);
const detailLoading = ref(false);
const detailError = ref(false);
const statusLabels = {
  pending: 'Chờ duyệt', approved: 'Đã duyệt', borrowing: 'Đang mượn', overdue: 'Quá hạn',
  returned: 'Đã trả', rejected: 'Từ chối', cancelled: 'Đã hủy', expired: 'Hết hạn nhận',
};
const columns = [
  { key: 'code', label: 'Mã phiếu', sortable: true },
  { key: 'reader', label: 'Độc giả' },
  { key: 'items', label: 'Sách' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày tạo', sortable: true },
  { key: 'actions', label: 'Chi tiết' },
];
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const search = computed(() => String(route.query.q || ''));
const status = computed(() => String(route.query.status || ''));
const from = computed(() => String(route.query.from || ''));
const to = computed(() => String(route.query.to || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');

onMounted(loadLoans);
watch(() => [route.query.page, route.query.q, route.query.status, route.query.from, route.query.to, route.query.sort], loadLoans);

async function loadLoans() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminLoans({
      q: search.value || undefined,
      status: status.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.items) ? result.items : (Array.isArray(result.data) ? result.data : []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function setQuery(values) {
  const query = { ...route.query, ...values, page: undefined };
  Object.keys(query).forEach((key) => {
    if (query[key] === '' || query[key] == null) delete query[key];
  });
  router.replace({ query });
}

function updateSearch(value) { setQuery({ q: value.trim() || undefined }); }
function updateStatus(value) { setQuery({ status: value || undefined }); }
function updateDate(key, value) {
  if (key === 'from' && value && to.value && value > to.value) {
    toast.error('Ngày bắt đầu không thể sau ngày kết thúc.');
    return;
  }
  if (key === 'to' && value && from.value && value < from.value) {
    toast.error('Ngày kết thúc không thể trước ngày bắt đầu.');
    return;
  }
  setQuery({ [key]: value || undefined });
}
function updatePage(value) { router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } }); }
function updateSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key }); }

async function openDetails(loan) {
  selectedLoan.value = loan;
  detailLoading.value = true;
  detailError.value = false;
  try {
    selectedLoan.value = await getAdminLoan(loan._id);
  } catch (error) {
    detailError.value = true;
    toast.error(error.response?.data?.message || 'Không tải được chi tiết phiếu mượn.');
  } finally {
    detailLoading.value = false;
  }
}

function closeDetails() { selectedLoan.value = null; }
function printLoan() { window.print(); }
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}
function fullName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';
}
</script>

<template>
  <section class="loans-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Phiếu mượn</span>
    </nav>

    <div class="page-heading loans-heading">
      <div>
        <h1>Tất cả phiếu mượn</h1>
        <p class="text-muted-strong mb-0">
          Tra cứu trạng thái, thông tin độc giả và in phiếu.
        </p>
      </div>
      <strong class="result-count">{{ total }} phiếu</strong>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :query="search"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @update:query="updateSearch"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadLoans"
    >
      <template #toolbar>
        <div class="filter-controls">
          <label class="filter-field">
            <span>Trạng thái</span>
            <select
              class="form-select form-select-sm"
              :value="status"
              @change="updateStatus($event.target.value)"
            >
              <option value="">Tất cả</option>
              <option
                v-for="(label, value) in statusLabels"
                :key="value"
                :value="value"
              >{{ label }}</option>
            </select>
          </label>
          <label class="filter-field">
            <span>Từ ngày</span>
            <input
              class="form-control form-control-sm"
              type="date"
              :value="from"
              :max="to || undefined"
              @change="updateDate('from', $event.target.value)"
            >
          </label>
          <label class="filter-field">
            <span>Đến ngày</span>
            <input
              class="form-control form-control-sm"
              type="date"
              :value="to"
              :min="from || undefined"
              @change="updateDate('to', $event.target.value)"
            >
          </label>
        </div>
      </template>
      <template #cell-reader="{ row }">
        <div class="reader-cell">
          <strong>{{ fullName(row.reader) }}</strong>
          <small>{{ row.reader?.code || 'Chưa có mã độc giả' }}</small>
        </div>
      </template>
      <template #cell-items="{ row }">
        <span>{{ row.items?.length || 0 }} cuốn</span>
        <small
          v-if="row.items?.length"
          class="book-summary"
        >{{ row.items[0].titleSnapshot }}<template v-if="row.items.length > 1"> và {{ row.items.length - 1 }} cuốn khác</template></small>
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
        <button
          class="btn btn-sm btn-outline-primary"
          type="button"
          @click="openDetails(row)"
        >
          Xem chi tiết
        </button>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-journal-x"
            aria-hidden="true"
          /><span>Không có phiếu mượn phù hợp bộ lọc.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách phiếu mượn.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadLoans"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="selectedLoan"
      class="detail-backdrop"
      @click.self="closeDetails"
    >
      <aside
        class="loan-detail"
        role="dialog"
        aria-modal="true"
        :aria-label="`Chi tiết phiếu ${selectedLoan.code}`"
      >
        <header class="detail-header">
          <div><span class="eyebrow">Chi tiết phiếu mượn</span><h2>{{ selectedLoan.code }}</h2></div>
          <button
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
          <span class="spinner-border spinner-border-sm text-primary" /> Đang tải chi tiết...
        </div>
        <div
          v-else-if="detailError"
          class="detail-state text-danger"
        >
          Không tải được dữ liệu. Đóng bảng và thử lại.
        </div>
        <template v-else>
          <div class="detail-content">
            <div class="detail-status">
              <span>Trạng thái</span><span
                class="status-badge"
                :class="`status-${selectedLoan.status}`"
              >{{ statusLabels[selectedLoan.status] || selectedLoan.status }}</span>
            </div>
            <section class="detail-section">
              <h3>Độc giả</h3>
              <dl><dt>Họ tên</dt><dd>{{ fullName(selectedLoan.reader) }}</dd><dt>Mã độc giả</dt><dd>{{ selectedLoan.reader?.code || '—' }}</dd><dt>Email</dt><dd>{{ selectedLoan.reader?.email || '—' }}</dd><dt>Số điện thoại</dt><dd>{{ selectedLoan.reader?.phone || '—' }}</dd></dl>
            </section>
            <section class="detail-section">
              <h3>Sách trong phiếu</h3>
              <article
                v-for="item in selectedLoan.items || []"
                :key="item._id"
                class="detail-book"
              >
                <strong>{{ item.titleSnapshot }}</strong>
                <span>Trạng thái: {{ statusLabels[item.status] || (item.status === 'lost' ? 'Báo mất' : item.status) }}</span>
                <span>Ngày mượn: {{ formatDate(item.borrowDate) }} · Hạn trả: {{ formatDate(item.dueDate) }}</span>
                <span v-if="item.returnDate">Ngày trả: {{ formatDate(item.returnDate) }} · Tình trạng: {{ item.condition === 'good' ? 'Tốt' : item.condition === 'damaged' ? 'Hư hỏng' : 'Báo mất' }}</span>
              </article>
            </section>
            <section class="detail-section">
              <h3>Mốc thời gian</h3>
              <dl><dt>Ngày tạo</dt><dd>{{ formatDate(selectedLoan.createdAt) }}</dd><dt>Ngày duyệt</dt><dd>{{ formatDate(selectedLoan.approvedAt) }}</dd><dt>Hạn nhận sách</dt><dd>{{ formatDate(selectedLoan.pickupDeadline) }}</dd><dt>Ngày giao sách</dt><dd>{{ formatDate(selectedLoan.handedOverAt) }}</dd><dt>Ngày đóng phiếu</dt><dd>{{ formatDate(selectedLoan.closedAt) }}</dd></dl>
            </section>
            <p
              v-if="selectedLoan.requestNote"
              class="request-note"
            >
              <strong>Ghi chú:</strong> {{ selectedLoan.requestNote }}
            </p>
            <p
              v-if="selectedLoan.rejectReason"
              class="request-note"
            >
              <strong>Lý do từ chối:</strong> {{ selectedLoan.rejectReason }}
            </p>
          </div>
          <footer class="detail-footer">
            <button
              class="btn btn-outline-secondary"
              type="button"
              @click="closeDetails"
            >
              Đóng
            </button><button
              class="btn btn-primary"
              type="button"
              @click="printLoan"
            >
              <i class="bi bi-printer me-1" />In phiếu
            </button>
          </footer>
        </template>
      </aside>
      <article class="print-document">
        <header>
          <div class="print-brand">
            THƯ VIỆN
          </div><h1>PHIẾU MƯỢN SÁCH</h1><p>Mã phiếu: {{ selectedLoan.code }}</p>
        </header>
        <section><h2>Thông tin độc giả</h2><p>Họ tên: {{ fullName(selectedLoan.reader) }}</p><p>Mã độc giả: {{ selectedLoan.reader?.code || '—' }}</p><p>Email: {{ selectedLoan.reader?.email || '—' }} · Điện thoại: {{ selectedLoan.reader?.phone || '—' }}</p></section>
        <section>
          <h2>Danh sách sách</h2><table>
            <thead><tr><th>STT</th><th>Tên sách</th><th>Trạng thái</th><th>Hạn trả</th></tr></thead><tbody>
              <tr
                v-for="(item, index) in selectedLoan.items || []"
                :key="item._id"
              >
                <td>{{ index + 1 }}</td><td>{{ item.titleSnapshot }}</td><td>{{ statusLabels[item.status] || item.status }}</td><td>{{ formatDate(item.dueDate) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <p>Ngày tạo phiếu: {{ formatDate(selectedLoan.createdAt) }} · Trạng thái: {{ statusLabels[selectedLoan.status] || selectedLoan.status }}</p>
        <footer><div>Độc giả<br><br><br>(Ký, ghi rõ họ tên)</div><div>Nhân viên thư viện<br><br><br>(Ký, ghi rõ họ tên)</div></footer>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.loans-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.loans-heading p { margin-top: .35rem; font-size: .9rem; }
.result-count { color: #6b7280; font-size: .875rem; }
.filter-controls { display: flex; flex-wrap: wrap; gap: .75rem; }
.filter-field { display: grid; min-width: 145px; gap: .25rem; color: #6b7280; font-size: .75rem; }
.filter-field select,.filter-field input { min-width: 145px; }
.reader-cell { display: grid; gap: .2rem; }
.reader-cell small,.book-summary { color: #6b7280; font-size: .75rem; }
.book-summary { display: block; max-width: 250px; margin-top: .2rem; }
.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: .75rem; font-weight: 600; white-space: nowrap; }
.status-pending { background: #fff7ed; color: #c2410c; }.status-approved,.status-borrowing { background: #eff6ff; color: #1d4ed8; }.status-overdue { background: #fef2f2; color: #b91c1c; }.status-returned { background: #ecfdf5; color: #047857; }.status-rejected,.status-cancelled,.status-expired { background: #f3f4f6; color: #6b7280; }
.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.detail-backdrop { position: fixed; z-index: 1050; inset: 0; display: flex; justify-content: flex-end; background: rgb(17 24 39 / 42%); }
.loan-detail { display: flex; width: min(100%, 620px); height: 100%; flex-direction: column; background: #fff; box-shadow: -12px 0 36px rgb(17 24 39 / 15%); }
.detail-header,.detail-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
.detail-header h2 { margin: .2rem 0 0; font-size: 1.25rem; }.eyebrow { color: #6b7280; font-size: .75rem; }
.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }
.detail-content { overflow-y: auto; padding: 1.25rem 1.5rem; }.detail-status { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; color: #6b7280; font-size: .875rem; }
.detail-section { margin-bottom: 1.25rem; }.detail-section h3 { margin-bottom: .65rem; font-size: .95rem; }
.detail-section dl { display: grid; grid-template-columns: minmax(110px, .7fr) 1.3fr; gap: .45rem .75rem; margin: 0; font-size: .85rem; }.detail-section dt { color: #6b7280; font-weight: 400; }.detail-section dd { margin: 0; overflow-wrap: anywhere; }
.detail-book { display: grid; gap: .3rem; padding: .75rem 0; border-bottom: 1px solid #e5e7eb; font-size: .825rem; }.detail-book span { color: #6b7280; }.request-note { padding: .75rem; border-radius: .5rem; background: #f9fafb; font-size: .85rem; }
.detail-footer { margin-top: auto; border-top: 1px solid #e5e7eb; border-bottom: 0; }.detail-state { display: flex; align-items: center; justify-content: center; gap: .5rem; min-height: 220px; }
.print-document { display: none; }
@media (max-width: 767.98px) { .loans-heading { align-items: flex-start; flex-direction: column; }.filter-controls { display: grid; width: 100%; grid-template-columns: 1fr; }.filter-field,.filter-field select,.filter-field input { width: 100%; }.loan-detail { width: 100%; }.detail-header,.detail-content,.detail-footer { padding-right: 1rem; padding-left: 1rem; } }
@media print {
  :global(body *) { visibility: hidden !important; }
  :global(body) { background: #fff !important; }
  .print-document,.print-document * { visibility: visible !important; }
  .print-document { position: absolute; inset: 0 auto auto 0; display: block !important; width: 100%; padding: 12mm; color: #111827; background: #fff; font: 11pt/1.5 Arial, sans-serif; }
  .print-document header { text-align: center; }.print-brand { font-weight: 700; letter-spacing: .1em; }.print-document h1 { margin: .5rem 0; font-size: 18pt; }.print-document h2 { margin: 1rem 0 .35rem; font-size: 12pt; }
  .print-document table { width: 100%; border-collapse: collapse; }.print-document th,.print-document td { padding: .45rem; border: 1px solid #6b7280; text-align: left; }.print-document footer { display: flex; justify-content: space-around; margin-top: 2rem; text-align: center; }
  @page { size: A4; margin: 10mm; }
}
</style>
