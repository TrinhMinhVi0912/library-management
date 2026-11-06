<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import { getAdminLoans, getCounters, handoverLoan } from '@/services/admin.service';
import { useNotificationStore } from '@/stores/notification.store';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const notifications = useNotificationStore();
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const handoverLoadingId = ref('');

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const searchQuery = computed(() => String(route.query.q || ''));
const sortValue = computed(() => String(route.query.sort || 'pickupDeadline'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');

const columns = [
  { key: 'code', label: 'Mã phiếu', sortable: true },
  { key: 'readerName', label: 'Độc giả' },
  { key: 'itemsCount', label: 'Số sách' },
  { key: 'approvedAt', label: 'Ngày duyệt', sortable: true },
  { key: 'pickupDeadline', label: 'Hạn nhận', sortable: true },
];

onMounted(loadApprovedLoans);
watch(() => [route.query.page, route.query.q, route.query.sort], loadApprovedLoans);

async function loadApprovedLoans() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminLoans({
      status: 'approved',
      q: searchQuery.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.data) ? result.data : [];
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function updateQuery(value) {
  router.replace({ query: { ...route.query, q: value.trim() || undefined, page: undefined } });
}

function updatePage(value) {
  router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } });
}

function updateSort({ key, order }) {
  router.replace({ query: { ...route.query, sort: order === 'desc' ? `-${key}` : key, page: undefined } });
}

function readerName(reader) {
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

function deadlineState(value) {
  if (!value) return { label: 'Chưa có hạn nhận', className: 'text-bg-secondary' };
  const remainingMs = new Date(value).getTime() - Date.now();
  if (remainingMs <= 0) return { label: 'Đã quá hạn nhận', className: 'text-bg-danger' };
  if (remainingMs <= 3 * 24 * 60 * 60 * 1000) {
    const days = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    return { label: `Còn ${days} ngày`, className: 'text-bg-warning' };
  }
  return { label: 'Còn thời hạn', className: 'text-bg-success' };
}

async function confirmHandover(loan) {
  if (handoverLoadingId.value) return;
  const deadline = deadlineState(loan.pickupDeadline);
  const confirmation = await Swal.fire({
    title: `Xác nhận đã giao phiếu ${loan.code}?`,
    text: `Độc giả: ${readerName(loan.reader)} · ${loan.items?.length || 0} quyển sách.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Đã giao sách',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: '#2563eb',
    footer: deadline.label === 'Đã quá hạn nhận' ? 'Phiếu đã quá hạn nhận; xác nhận chỉ khi sách đã được giao thực tế.' : undefined,
  });
  if (!confirmation.isConfirmed) return;

  handoverLoadingId.value = loan._id;
  try {
    await handoverLoan(loan._id);
    toast.success(`Đã xác nhận giao phiếu ${loan.code}.`);
    await Promise.all([loadApprovedLoans(), refreshCounters()]);
  } catch (error) {
    toast.error(error.response?.data?.message || `Không thể xác nhận giao phiếu ${loan.code}.`);
    await loadApprovedLoans();
  } finally {
    handoverLoadingId.value = '';
  }
}

async function refreshCounters() {
  try {
    notifications.setCounters(await getCounters());
  } catch {
    // The page remains usable if refreshing the sidebar counters fails.
  }
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
      <span aria-current="page">Giao sách</span>
    </nav>

    <div class="page-heading handover-heading">
      <div>
        <h1>Xác nhận giao sách</h1>
        <p class="text-muted-strong mb-0">
          {{ total }} phiếu đã duyệt đang chờ nhận
        </p>
      </div>
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
      @retry="loadApprovedLoans"
    >
      <template #cell-code="{ row }">
        <strong>{{ row.code }}</strong>
      </template>
      <template #cell-readerName="{ row }">
        <span>{{ readerName(row.reader) }}</span>
        <small class="d-block text-muted-strong">{{ row.reader?.code || row.reader?.email || '' }}</small>
      </template>
      <template #cell-itemsCount="{ row }">
        {{ row.items?.length || 0 }}
      </template>
      <template #cell-approvedAt="{ row }">
        {{ formatDate(row.approvedAt) }}
      </template>
      <template #cell-pickupDeadline="{ row }">
        <span>{{ formatDate(row.pickupDeadline) }}</span>
        <span
          class="badge deadline-badge"
          :class="deadlineState(row.pickupDeadline).className"
        >
          {{ deadlineState(row.pickupDeadline).label }}
        </span>
      </template>
      <template #row="{ row }">
        <button
          class="btn btn-primary btn-sm handover-button"
          type="button"
          :disabled="Boolean(handoverLoadingId)"
          @click="confirmHandover(row)"
        >
          <span
            v-if="handoverLoadingId === row._id"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          />
          Xác nhận đã giao
        </button>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-box-seam"
            aria-hidden="true"
          />
          <span>Không có phiếu nào đang chờ nhận sách.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách phiếu chờ nhận.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadApprovedLoans"
        >
          Thử lại
        </button>
      </template>
    </DataTable>
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

.handover-heading p {
  margin-top: 0.35rem;
  font-size: 0.9rem;
}

.deadline-badge {
  display: block;
  width: fit-content;
  margin-top: 0.35rem;
  font-weight: 500;
}

.handover-button { white-space: nowrap; }

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem;
}

@media (max-width: 575.98px) {
  .handover-button { width: 100%; }
}
</style>
