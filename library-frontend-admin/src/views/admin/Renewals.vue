<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import RenewalRequestRow from '@/components/loan/RenewalRequestRow.vue';
import {
  approveRenewal,
  getAdminRenewals,
  getCounters,
  rejectRenewal,
} from '@/services/admin.service';
import { useNotificationStore } from '@/stores/notification.store';
import { onSocketEvent } from '@/services/socket.service';

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
let stopCountersListener;

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const eligibleRows = computed(() => rows.value.filter((request) => !request.hasWaitingReservation));
const allEligibleSelected = computed(() => eligibleRows.value.length > 0
  && eligibleRows.value.every((request) => selectedIds.value.has(request._id)));
const columns = [
  { key: 'select', label: '' },
  { key: 'loanCode', label: 'Mã phiếu', sortable: true },
  { key: 'readerName', label: 'Độc giả' },
  { key: 'bookTitle', label: 'Sách' },
  { key: 'dueDates', label: 'Hạn hiện tại → đề xuất' },
  { key: 'renewCount', label: 'Đã gia hạn' },
  { key: 'reservation', label: 'Đặt trước' },
  { key: 'createdAt', label: 'Ngày gửi', sortable: true },
];

onMounted(() => {
  stopCountersListener = onSocketEvent('staff:counters', handleCountersChanged);
  loadRenewals();
});

onBeforeUnmount(() => stopCountersListener?.());
watch(() => [route.query.page, route.query.sort], loadRenewals);

async function loadRenewals() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminRenewals({
      status: 'pending',
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.data) ? result.data : [];
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
    const visibleIds = new Set(rows.value.map((request) => request._id));
    selectedIds.value = new Set([...selectedIds.value].filter((id) => visibleIds.has(id)));
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function handleCountersChanged(counters) {
  notifications.setCounters(counters);
  loadRenewals();
}

function toggleSelected(id, checked) {
  const next = new Set(selectedIds.value);
  if (checked) next.add(id);
  else next.delete(id);
  selectedIds.value = next;
}

function toggleVisible(checked) {
  selectedIds.value = checked ? new Set(eligibleRows.value.map((request) => request._id)) : new Set();
}

function updatePage(value) {
  router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } });
}

function updateSort({ key, order }) {
  router.replace({ query: { ...route.query, sort: order === 'desc' ? `-${key}` : key, page: undefined } });
}

async function refreshAfterMutation() {
  const [, countersResult] = await Promise.allSettled([loadRenewals(), getCounters()]);
  if (countersResult.status === 'fulfilled') notifications.setCounters(countersResult.value);
}

async function handleApprove(request) {
  if (request.hasWaitingReservation) {
    toast.error('Sách đang có người đặt trước nên không thể duyệt gia hạn.');
    return;
  }
  if (actingId.value || bulkLoading.value) return;
  actingId.value = request._id;
  try {
    await approveRenewal(request._id);
    toast.success(`Đã duyệt gia hạn cho phiếu ${request.loan?.code || ''}.`);
    await refreshAfterMutation();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể duyệt yêu cầu gia hạn. Vui lòng thử lại.');
    await loadRenewals();
  } finally {
    actingId.value = '';
  }
}

async function handleReject(request) {
  if (actingId.value || bulkLoading.value) return;
  const result = await Swal.fire({
    title: `Từ chối gia hạn phiếu ${request.loan?.code || ''}?`,
    text: 'Vui lòng nhập lý do để thông báo cho độc giả.',
    input: 'textarea',
    inputLabel: 'Lý do từ chối',
    inputPlaceholder: 'Nhập lý do (bắt buộc)',
    inputAttributes: { maxlength: 500, 'aria-label': 'Lý do từ chối' },
    showCancelButton: true,
    confirmButtonText: 'Từ chối yêu cầu',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: '#dc2626',
    inputValidator: (value) => (value?.trim() ? undefined : 'Vui lòng nhập lý do từ chối.'),
  });
  if (!result.isConfirmed) return;

  actingId.value = request._id;
  try {
    await rejectRenewal(request._id, result.value.trim());
    toast.success(`Đã từ chối gia hạn cho phiếu ${request.loan?.code || ''}.`);
    await refreshAfterMutation();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể từ chối yêu cầu gia hạn. Vui lòng thử lại.');
    await loadRenewals();
  } finally {
    actingId.value = '';
  }
}

async function handleBulkApprove() {
  const requests = eligibleRows.value.filter((request) => selectedIds.value.has(request._id));
  if (!requests.length || bulkLoading.value) return;
  const confirmation = await Swal.fire({
    title: `Duyệt ${requests.length} yêu cầu gia hạn?`,
    text: 'Các yêu cầu có người đặt trước không thể duyệt và sẽ không được gửi.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Duyệt các yêu cầu',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#2563eb',
  });
  if (!confirmation.isConfirmed) return;

  bulkLoading.value = true;
  const failures = [];
  let succeeded = 0;
  for (const request of requests) {
    try {
      await approveRenewal(request._id);
      succeeded += 1;
    } catch (error) {
      const code = request.loan?.code || request._id;
      const message = error.response?.data?.message || 'Không thể duyệt yêu cầu.';
      failures.push(`${code}: ${message}`);
    }
  }
  selectedIds.value = new Set();
  if (succeeded) toast.success(`Đã duyệt ${succeeded} yêu cầu gia hạn.`);
  if (failures.length) toast.error(`Không duyệt được ${failures.length} yêu cầu: ${failures.slice(0, 2).join(' · ')}`);
  await refreshAfterMutation();
  bulkLoading.value = false;
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
      <span aria-current="page">Duyệt gia hạn</span>
    </nav>

    <div class="page-heading renewals-heading">
      <div>
        <h1>Duyệt yêu cầu gia hạn</h1>
        <p class="text-muted-strong mb-0">
          {{ total }} yêu cầu đang chờ xử lý
        </p>
      </div>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="!selectedIds.size || bulkLoading || Boolean(actingId)"
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
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :searchable="false"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadRenewals"
    >
      <template #toolbar>
        <label class="select-visible">
          <input
            type="checkbox"
            :checked="allEligibleSelected"
            :disabled="loading || !eligibleRows.length"
            @change="toggleVisible($event.target.checked)"
          >
          <span>Chọn yêu cầu có thể duyệt</span>
        </label>
      </template>
      <template #row-main="{ row }">
        <RenewalRequestRow
          :request="row"
          :selected="selectedIds.has(row._id)"
          :disabled="Boolean(actingId) || bulkLoading"
          @update:selected="toggleSelected(row._id, $event)"
        />
      </template>
      <template #row="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-primary btn-sm"
            type="button"
            :disabled="Boolean(actingId) || bulkLoading || row.hasWaitingReservation"
            :title="row.hasWaitingReservation ? 'Có người đặt trước; không thể duyệt gia hạn.' : undefined"
            @click="handleApprove(row)"
          >
            <span
              v-if="actingId === row._id"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />
            Duyệt
          </button>
          <button
            class="btn btn-outline-danger btn-sm"
            type="button"
            :disabled="Boolean(actingId) || bulkLoading"
            @click="handleReject(row)"
          >
            Từ chối
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-calendar-check"
            aria-hidden="true"
          />
          <span>Không có yêu cầu gia hạn nào đang chờ duyệt.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách yêu cầu gia hạn.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadRenewals"
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

.renewals-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.renewals-heading p { margin-top: 0.35rem; font-size: 0.9rem; }
.select-visible,.row-actions { display: inline-flex; align-items: center; gap: 0.5rem; }
.select-visible { color: #6b7280; font-size: 0.825rem; white-space: nowrap; }

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem;
}

@media (max-width: 575.98px) {
  .renewals-heading { align-items: flex-start; flex-direction: column; }
  .renewals-heading > button { width: 100%; }
  .row-actions { align-items: flex-start; flex-direction: column; }
}
</style>
