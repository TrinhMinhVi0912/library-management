<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import ReturnItemRow from '@/components/loan/ReturnItemRow.vue';
import {
  getAdminBook,
  getAdminLoan,
  getAdminLoans,
  getLoanReturnPolicy,
  returnLoan,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const searchInput = ref(String(route.query.q || ''));
const searchLoading = ref(false);
const searchError = ref('');
const matches = ref([]);
const selectedLoan = ref(null);
const detailLoading = ref(false);
const detailError = ref(false);
const finePolicy = ref(null);
const policyLoading = ref(false);
const policyError = ref(false);
const returnSelections = ref({});
const returnLoading = ref(false);
const operationResult = ref(null);

const returnableItems = computed(() => (selectedLoan.value?.items || []).filter((item) => item.status === 'borrowing'));
const selectedItems = computed(() => returnableItems.value.filter((item) => returnSelections.value[item._id]?.selected));
const previewTotal = computed(() => selectedItems.value.reduce((sum, item) => sum + previewFine(item), 0));
const searchColumns = [
  { key: 'code', label: 'Mã phiếu' },
  { key: 'readerName', label: 'Độc giả' },
  { key: 'statusLabel', label: 'Trạng thái' },
  { key: 'dueDate', label: 'Hạn trả' },
];

onMounted(() => {
  loadFinePolicy();
  if (searchInput.value.trim()) searchLoans();
});

async function loadFinePolicy() {
  policyLoading.value = true;
  policyError.value = false;
  try {
    finePolicy.value = await getLoanReturnPolicy();
    if (!finePolicy.value) throw new Error('Missing return policy');
  } catch {
    finePolicy.value = null;
    policyError.value = true;
  } finally {
    policyLoading.value = false;
  }
}

async function searchLoans() {
  const query = searchInput.value.trim();
  if (!query) {
    searchError.value = 'Nhập mã phiếu hoặc mã độc giả để tìm.';
    matches.value = [];
    selectedLoan.value = null;
    return;
  }

  searchError.value = '';
  matches.value = [];
  selectedLoan.value = null;
  operationResult.value = null;
  searchLoading.value = true;
  router.replace({ query: { ...route.query, q: query } });
  try {
    const results = await Promise.all(['borrowing', 'overdue'].map((status) => getAdminLoans({
      status,
      q: query,
      page: 1,
      limit: 10,
      sort: '-createdAt',
    })));
    matches.value = results.flatMap((result) => Array.isArray(result.data) ? result.data : []);
    if (!matches.value.length) searchError.value = 'Không tìm thấy phiếu đang mượn hoặc quá hạn phù hợp.';
    else if (matches.value.length === 1) await openLoan(matches.value[0]);
  } catch (error) {
    searchError.value = error.response?.data?.message || 'Không tìm được phiếu. Vui lòng thử lại.';
  } finally {
    searchLoading.value = false;
  }
}

async function openLoan(loan) {
  selectedLoan.value = null;
  detailError.value = false;
  detailLoading.value = true;
  operationResult.value = null;
  try {
    selectedLoan.value = await getAdminLoan(loan._id);
    initializeSelections();
  } catch {
    detailError.value = true;
  } finally {
    detailLoading.value = false;
  }
}

async function reloadLoan() {
  if (!selectedLoan.value?._id) return;
  const current = { _id: selectedLoan.value._id };
  const previousResult = operationResult.value;
  await openLoan(current);
  operationResult.value = previousResult;
}

function initializeSelections() {
  returnSelections.value = Object.fromEntries((selectedLoan.value?.items || []).map((item) => [
    item._id,
    { selected: false, condition: 'good', damagedFineAmount: 0 },
  ]));
}

function updateSelection(itemId, value) {
  returnSelections.value = { ...returnSelections.value, [itemId]: value };
}

function previewFine(item) {
  const selection = returnSelections.value[item._id];
  if (!selection || !finePolicy.value) return 0;
  const daysLate = item.dueDate
    ? Math.max(0, Math.ceil((Date.now() - new Date(item.dueDate).getTime()) / 86400000))
    : 0;
  const lateFee = daysLate * Number(finePolicy.value.lateFeePerDay || 0);
  if (selection.condition === 'damaged') return lateFee + Math.max(0, Number(selection.damagedFineAmount) || 0);
  if (selection.condition === 'lost') {
    return lateFee
      + Number(item.priceSnapshot || 0) * Number(finePolicy.value.lostBookFeeRate || 0)
      + Number(finePolicy.value.lostBookProcessingFee || 0);
  }
  return lateFee;
}

async function confirmReturn() {
  if (!selectedLoan.value?._id || !selectedItems.value.length || !finePolicy.value || returnLoading.value) return;
  const selectedTitles = selectedItems.value.map((item) => item.titleSnapshot || item.book?.title || 'Sách').join(', ');
  const confirmation = await Swal.fire({
    title: `Xác nhận trả ${selectedItems.value.length} quyển?`,
    text: `Phiếu ${selectedLoan.value.code}: ${selectedTitles}. Tiền phạt dự kiến ${formatMoney(previewTotal.value)}.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Xác nhận trả sách',
    cancelButtonText: 'Kiểm tra lại',
    confirmButtonColor: '#2563eb',
  });
  if (!confirmation.isConfirmed) return;

  returnLoading.value = true;
  try {
    const payload = selectedItems.value.map((item) => {
      const selection = returnSelections.value[item._id];
      const entry = { bookId: item.book?._id || item.book, condition: selection.condition };
      if (selection.condition === 'damaged') entry.fineAmount = Math.max(0, Number(selection.damagedFineAmount) || 0);
      return entry;
    });
    const result = await returnLoan(selectedLoan.value._id, payload);
    const returnedIds = result?.returned || selectedItems.value.map((item) => item.book?._id || item.book);
    const returnedIdSet = new Set(returnedIds.map(String));
    const returnedDetails = selectedItems.value
      .filter((item) => returnedIdSet.has(String(item.book?._id || item.book)))
      .map((item) => ({
        id: item.book?._id || item.book,
        title: item.titleSnapshot || item.book?.title || 'Sách',
        condition: returnSelections.value[item._id]?.condition || 'good',
      }));
    const stock = await loadStockResults(returnedDetails);
    operationResult.value = {
      code: selectedLoan.value.code,
      status: result?.loan?.status || 'borrowing',
      returnedDetails,
      totalFine: Number(result?.totalFine) || 0,
      fines: Array.isArray(result?.fines) ? result.fines : [],
      stock,
    };
    toast.success(`Đã ghi nhận trả ${returnedDetails.length} quyển sách.`);
    await reloadLoan();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể ghi nhận trả sách. Vui lòng tải lại phiếu.');
    await reloadLoan();
  } finally {
    returnLoading.value = false;
  }
}

async function loadStockResults(returnedDetails) {
  const ids = [...new Set(returnedDetails.map((item) => String(item.id)).filter(Boolean))];
  const results = await Promise.allSettled(ids.map((id) => getAdminBook(id)));
  return results.flatMap((result, index) => (result.status === 'fulfilled' && result.value
    ? [{
      id: ids[index],
      title: result.value.title || returnedDetails.find((item) => String(item.id) === ids[index])?.title || 'Sách',
      availableCopies: result.value.availableCopies,
      totalCopies: result.value.totalCopies,
    }]
    : []));
}

function formatReader(reader) {
  return [reader?.firstName, reader?.lastName].filter(Boolean).join(' ') || 'Độc giả';
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
}

function statusLabel(status) {
  if (status === 'overdue') return 'Quá hạn';
  if (status === 'returned') return 'Đã trả';
  return 'Đang mượn';
}

function conditionLabel(condition) {
  return { good: 'Tốt', damaged: 'Hư hỏng', lost: 'Mất' }[condition] || condition;
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
      <span aria-current="page">Nhận trả sách</span>
    </nav>

    <div class="page-heading">
      <h1>Nhận trả sách</h1>
      <p class="text-muted-strong mb-0">
        Quét hoặc nhập mã phiếu rồi nhấn Enter để tra cứu.
      </p>
    </div>

    <form
      class="surface-card lookup-card"
      @submit.prevent="searchLoans"
    >
      <label
        for="loan-code"
        class="form-label"
      >Mã phiếu mượn hoặc mã độc giả</label>
      <div class="lookup-controls">
        <input
          id="loan-code"
          v-model="searchInput"
          class="form-control"
          type="search"
          autocomplete="off"
          placeholder="Quét hoặc nhập mã phiếu..."
          :disabled="searchLoading || returnLoading"
        >
        <button
          class="btn btn-primary"
          type="submit"
          :disabled="searchLoading || !searchInput.trim()"
        >
          <span
            v-if="searchLoading"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          />
          <i
            v-else
            class="bi bi-search me-1"
            aria-hidden="true"
          />
          Tìm phiếu
        </button>
      </div>
      <p
        v-if="searchError"
        class="lookup-error mb-0"
        role="alert"
      >
        {{ searchError }}
      </p>
    </form>

    <div
      v-if="policyError"
      class="alert alert-warning d-flex align-items-center justify-content-between gap-3"
      role="alert"
    >
      <span>Không tải được mức phạt hiện hành; chưa thể tính preview chính xác.</span>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        :disabled="policyLoading"
        @click="loadFinePolicy"
      >
        Thử lại
      </button>
    </div>
    <div
      v-else-if="policyLoading"
      class="policy-loading text-muted-strong"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm text-primary me-2"
        aria-hidden="true"
      />Đang tải chính sách phạt...
    </div>

    <div
      v-if="matches.length > 1 && !selectedLoan"
      class="match-list surface-card"
    >
      <h2>Chọn phiếu cần xử lý</h2>
      <DataTable
        :columns="searchColumns"
        :rows="matches"
        :total="matches.length"
        :total-pages="1"
      >
        <template #cell-code="{ row }">
          <strong>{{ row.code }}</strong>
        </template>
        <template #cell-readerName="{ row }">
          {{ formatReader(row.reader) }} <small class="text-muted-strong">{{ row.reader?.code }}</small>
        </template>
        <template #cell-statusLabel="{ row }">
          {{ statusLabel(row.status) }}
        </template>
        <template #cell-dueDate="{ row }">
          {{ formatDate(row.items?.find((item) => item.status === 'borrowing')?.dueDate) }}
        </template>
        <template #row="{ row }">
          <button
            class="btn btn-outline-primary btn-sm"
            type="button"
            @click="openLoan(row)"
          >
            Chọn phiếu
          </button>
        </template>
      </DataTable>
    </div>

    <div
      v-if="detailLoading"
      class="surface-card detail-loading"
      role="status"
    >
      <span
        class="spinner-border text-primary"
        aria-hidden="true"
      />Đang tải chi tiết phiếu...
    </div>
    <div
      v-else-if="detailError"
      class="surface-card detail-error"
      role="alert"
    >
      <p>Không tải được chi tiết phiếu.</p>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        @click="reloadLoan"
      >
        Thử lại
      </button>
    </div>

    <section
      v-if="selectedLoan && !detailLoading"
      class="loan-return-section"
    >
      <header class="surface-card loan-summary">
        <div>
          <p class="mb-1 text-muted-strong">
            {{ formatReader(selectedLoan.reader) }} · {{ selectedLoan.reader?.code || selectedLoan.reader?.email }}
          </p>
          <h2>{{ selectedLoan.code }}</h2>
        </div>
        <span
          class="badge"
          :class="selectedLoan.status === 'overdue' ? 'text-bg-danger' : 'text-bg-primary'"
        >{{ statusLabel(selectedLoan.status) }}</span>
        <dl class="loan-dates">
          <div><dt>Ngày giao</dt><dd>{{ formatDate(selectedLoan.handedOverAt) }}</dd></div>
          <div><dt>Hạn trả</dt><dd>{{ formatDate(selectedLoan.items?.find((item) => item.status === 'borrowing')?.dueDate) }}</dd></div>
        </dl>
      </header>

      <div
        v-if="operationResult"
        class="surface-card result-card"
        role="status"
      >
        <h3>Kết quả trả sách – {{ operationResult.code }}</h3>
        <p class="mb-2">
          Đã ghi nhận {{ operationResult.returnedDetails.length }} quyển. Trạng thái phiếu: <strong>{{ statusLabel(operationResult.status) }}</strong>.
        </p>
        <p class="mb-2">
          Tổng tiền phạt đã tạo: <strong>{{ formatMoney(operationResult.totalFine) }}</strong>
        </p>
        <ul class="result-list">
          <li
            v-for="item in operationResult.returnedDetails"
            :key="item.id"
          >
            {{ item.title }} — {{ conditionLabel(item.condition) }}
          </li>
        </ul>
        <ul
          v-if="operationResult.fines.length"
          class="result-list"
        >
          <li
            v-for="(fine, index) in operationResult.fines"
            :key="fine._id || `${fine.type}-${index}`"
          >
            {{ fine.reason || fine.type }} — {{ formatMoney(fine.amount) }}
          </li>
        </ul>
        <p
          v-else
          class="mb-2 text-muted-strong"
        >
          Không phát sinh tiền phạt.
        </p>
        <div
          v-if="operationResult.stock.length"
          class="stock-results"
        >
          <h4>Tồn kho sau khi cập nhật</h4>
          <ul class="result-list">
            <li
              v-for="book in operationResult.stock"
              :key="book.id"
            >
              {{ book.title }} — {{ book.availableCopies }} bản khả dụng / {{ book.totalCopies }} bản tổng
            </li>
          </ul>
          <small class="text-muted-strong">Bản vừa trả có thể được chuyển cho người đặt trước đang chờ.</small>
        </div>
      </div>

      <div
        v-if="returnableItems.length"
        class="return-items"
      >
        <div class="items-heading">
          <div>
            <h3>Sách đang mượn</h3>
            <p class="mb-0 text-muted-strong">
              Chọn các quyển được nhận trả trong lần này.
            </p>
          </div>
          <strong>{{ selectedItems.length }} đã chọn</strong>
        </div>

        <ReturnItemRow
          v-for="item in returnableItems"
          :key="item._id"
          :item="item"
          :model-value="returnSelections[item._id]"
          :fine-policy="finePolicy"
          :disabled="returnLoading"
          @update:model-value="updateSelection(item._id, $event)"
        />

        <footer class="return-footer">
          <div>
            <span class="text-muted-strong">Tổng phạt dự kiến</span>
            <strong>{{ formatMoney(previewTotal) }}</strong>
          </div>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!selectedItems.length || !finePolicy || returnLoading"
            @click="confirmReturn"
          >
            <span
              v-if="returnLoading"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />
            Xác nhận trả sách
          </button>
        </footer>
      </div>
      <div
        v-else
        class="surface-card all-returned-state"
      >
        <i
          class="bi bi-check-circle text-success"
          aria-hidden="true"
        />
        Tất cả sách trong phiếu đã được ghi nhận trả.
      </div>
    </section>
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

.page-heading p { margin-top: 0.35rem; font-size: 0.9rem; }

.lookup-card {
  display: grid;
  gap: 0.6rem;
  margin-bottom: 1rem;
  padding: 1.25rem;
}

.lookup-controls {
  display: flex;
  gap: 0.75rem;
}

.lookup-controls input { min-width: 0; }
.lookup-error { color: #b91c1c; font-size: 0.85rem; }
.policy-loading { padding: 0.5rem 0 1rem; font-size: 0.85rem; }

.match-list,
.loan-return-section { margin-top: 1rem; }

.match-list { padding: 1rem; }
.match-list h2 { margin: 0 0 0.75rem; font-size: 1rem; }

.loan-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.25rem;
}

.loan-summary h2 { margin: 0; font-size: 1.15rem; }

.loan-dates {
  display: flex;
  grid-column: 1 / -1;
  gap: 2rem;
  margin: 0;
}

.loan-dates div { display: flex; gap: 0.5rem; }
.loan-dates dt { color: #6b7280; font-weight: 400; }
.loan-dates dd { margin: 0; }

.return-items {
  display: grid;
  gap: 0.75rem;
}

.items-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.5rem 0;
}

.items-heading h3 { margin: 0 0 0.3rem; font-size: 1rem; }
.items-heading p { font-size: 0.85rem; }

.return-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
}

.return-footer > div { display: grid; gap: 0.15rem; text-align: right; }
.detail-loading,
.detail-error,
.all-returned-state { display: flex; min-height: 120px; align-items: center; justify-content: center; gap: 0.75rem; padding: 1.25rem; }
.detail-error { flex-direction: column; }
.detail-error p { margin: 0; }
.result-card { margin-bottom: 1rem; padding: 1.25rem; border-color: #bbf7d0; }
.result-card h3 { margin: 0 0 0.75rem; font-size: 1rem; }
.stock-results { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; }
.stock-results h4 { font-size: 0.9rem; }
.result-list { display: grid; gap: 0.35rem; margin-bottom: 0.5rem; padding-left: 1.25rem; }

@media (max-width: 575.98px) {
  .lookup-controls { flex-direction: column; }
  .lookup-controls button { width: 100%; }
  .loan-summary { grid-template-columns: minmax(0, 1fr); }
  .loan-dates { flex-direction: column; gap: 0.5rem; }
  .items-heading { align-items: flex-start; flex-direction: column; }
  .return-footer { align-items: stretch; flex-direction: column; }
  .return-footer > div { text-align: left; }
  .return-footer button { width: 100%; }
}
</style>
