<script setup>
import { computed, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { formatDate, formatMoney, dayjs, TIMEZONE } from '@/utils/format';
import { cloudinaryThumb } from '@/utils/image';
import loanService from '@/services/loan.service';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import LoanTimeline from '@/components/loan/LoanTimeline.vue';
import RenewRequestButton from '@/components/loan/RenewRequestButton.vue';

const FINE_RATE_PER_DAY = 5000; // mức phạt mặc định (đ/ngày)

const props = defineProps({
  loan: { type: Object, required: true },
  /** Danh sách yêu cầu gia hạn liên quan đến phiếu này */
  renewals: { type: Array, default: () => [] },
});

const emit = defineEmits(['cancelled', 'renewal-changed']);
const toast = useToast();

const expanded = ref(false);
const showCancelModal = ref(false);
const cancelling = ref(false);
const cancellingRenewalId = ref(null);

// --- Computed ---

const canCancel = computed(() =>
  ['pending', 'approved'].includes(props.loan?.status),
);

const itemCount = computed(() => props.loan?.items?.length || 0);

/** Hạn nhận sách còn bao nhiêu ngày (chỉ cho trạng thái approved) */
const pickupDeadlineInfo = computed(() => {
  if (props.loan?.status !== 'approved' || !props.loan?.pickupDeadline) return null;
  const deadline = dayjs(props.loan.pickupDeadline).tz(TIMEZONE);
  const now = dayjs().tz(TIMEZONE);
  const diffHours = deadline.diff(now, 'hour');
  if (diffHours < 0) return { text: 'Đã quá hạn nhận sách', urgent: true };
  if (diffHours < 24) return { text: `Còn ${diffHours} giờ để nhận sách`, urgent: true };
  const diffDays = deadline.diff(now, 'day');
  return { text: `Còn ${diffDays} ngày để nhận sách`, urgent: diffDays <= 1 };
});

/** Tính phạt tạm tính cho các sách quá hạn */
const overdueItems = computed(() => {
  if (!['borrowing', 'overdue'].includes(props.loan?.status)) return [];
  const now = dayjs().tz(TIMEZONE);
  return (props.loan?.items || [])
    .filter((item) => item.status === 'borrowing' && item.dueDate)
    .map((item) => {
      const due = dayjs(item.dueDate).tz(TIMEZONE);
      const daysOverdue = now.diff(due, 'day');
      return {
        ...item,
        daysOverdue: Math.max(0, daysOverdue),
        estimatedFine: Math.max(0, daysOverdue) * FINE_RATE_PER_DAY,
      };
    })
    .filter((item) => item.daysOverdue > 0);
});

const totalEstimatedFine = computed(() =>
  overdueItems.value.reduce((sum, item) => sum + item.estimatedFine, 0),
);

/** Map bookId → yêu cầu gia hạn gần nhất (để hiển thị trên từng item) */
const renewalByBook = computed(() => {
  const map = {};
  for (const r of props.renewals) {
    const bookId = typeof r.book === 'object' ? r.book._id : r.book;
    // Ưu tiên pending > approved/rejected (gần nhất)
    if (!map[bookId] || r.status === 'pending') {
      map[bookId] = r;
    }
  }
  return map;
});

// --- Methods ---

function toggleExpand() {
  expanded.value = !expanded.value;
}

function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const due = dayjs(dueDate).tz(TIMEZONE);
  const now = dayjs().tz(TIMEZONE);
  return due.diff(now, 'day');
}

function daysRemainingLabel(dueDate) {
  const days = daysRemaining(dueDate);
  if (days === null) return '';
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay là hạn trả';
  return `Còn ${days} ngày`;
}

function daysRemainingClass(dueDate) {
  const days = daysRemaining(dueDate);
  if (days === null) return '';
  if (days < 0) return 'text-danger fw-semibold';
  if (days <= 2) return 'text-warning fw-semibold';
  return 'text-success';
}

/** Lấy yêu cầu gia hạn pending cho item */
function getPendingRenewal(item) {
  const bookId = item.book?._id || item.book;
  const r = renewalByBook.value[bookId];
  return r && r.status === 'pending' ? r : null;
}

/** Lấy yêu cầu gia hạn gần nhất (bất kỳ trạng thái) cho item */
function getLatestRenewal(item) {
  const bookId = item.book?._id || item.book;
  return renewalByBook.value[bookId] || null;
}

/** Badge class cho trạng thái renewal */
function renewalBadgeClass(status) {
  const map = {
    pending: 'bg-warning text-dark',
    approved: 'bg-success',
    rejected: 'bg-danger',
    cancelled: 'bg-secondary',
  };
  return map[status] || 'bg-secondary';
}

/** Label cho trạng thái renewal */
function renewalStatusLabel(status) {
  const map = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối',
    cancelled: 'Đã hủy',
  };
  return map[status] || status;
}

async function handleCancel() {
  cancelling.value = true;
  try {
    await loanService.cancelLoan(props.loan._id);
    showCancelModal.value = false;
    toast.success('Đã hủy yêu cầu mượn sách thành công.');
    emit('cancelled');
  } catch (error) {
    const msg = error?.response?.data?.message || 'Không thể hủy yêu cầu. Vui lòng thử lại.';
    toast.error(msg);
  } finally {
    cancelling.value = false;
  }
}

async function handleCancelRenewal(renewal) {
  cancellingRenewalId.value = renewal._id;
  try {
    await loanService.cancelRenewal(renewal._id);
    toast.success('Đã hủy yêu cầu gia hạn.');
    emit('renewal-changed');
  } catch (error) {
    const msg = error?.response?.data?.message || 'Không thể hủy yêu cầu gia hạn.';
    toast.error(msg);
  } finally {
    cancellingRenewalId.value = null;
  }
}

function handleRenewed() {
  emit('renewal-changed');
}
</script>

<template>
  <article class="loan-card surface-card mb-3">
    <!-- Header (luôn hiển thị, click để mở rộng) -->
    <div
      class="loan-card-header d-flex align-items-center gap-3 p-3"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="toggleExpand"
      @keydown.enter.prevent="toggleExpand"
      @keydown.space.prevent="toggleExpand"
    >
      <!-- Icon mở rộng -->
      <i
        class="bi fs-5 text-secondary flex-shrink-0"
        :class="expanded ? 'bi-chevron-up' : 'bi-chevron-down'"
        aria-hidden="true"
      />

      <!-- Mã phiếu + ngày tạo -->
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="fw-bold text-primary font-monospace small">
            {{ loan.code || '—' }}
          </span>
          <StatusBadge
            :status="loan.status"
            type="loan"
          />
        </div>
        <div class="text-muted extra-small mt-1">
          {{ formatDate(loan.createdAt) }} · {{ itemCount }} cuốn sách
        </div>
      </div>

      <!-- Nút hủy (chỉ pending/approved) -->
      <button
        v-if="canCancel"
        class="btn btn-outline-danger btn-sm flex-shrink-0"
        type="button"
        @click.stop="showCancelModal = true"
      >
        <i
          class="bi bi-x-circle me-1"
          aria-hidden="true"
        />
        Hủy
      </button>
    </div>

    <!-- Body (khi mở rộng) -->
    <Transition name="slide-fade">
      <div
        v-if="expanded"
        class="loan-card-body border-top p-3"
      >
        <!-- Cảnh báo hạn nhận sách -->
        <div
          v-if="pickupDeadlineInfo"
          class="alert py-2 px-3 d-flex align-items-center gap-2 mb-3"
          :class="pickupDeadlineInfo.urgent ? 'alert-warning' : 'alert-info'"
        >
          <i
            class="bi"
            :class="pickupDeadlineInfo.urgent ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'"
            aria-hidden="true"
          />
          <span class="small">
            {{ pickupDeadlineInfo.text }}
            <template v-if="loan.pickupDeadline">
              (hạn: {{ formatDate(loan.pickupDeadline, 'DD/MM HH:mm') }})
            </template>
          </span>
        </div>

        <!-- Cảnh báo quá hạn + phạt tạm tính -->
        <div
          v-if="totalEstimatedFine > 0"
          class="alert alert-danger py-2 px-3 d-flex align-items-center gap-2 mb-3"
        >
          <i
            class="bi bi-exclamation-octagon-fill"
            aria-hidden="true"
          />
          <span class="small">
            Phạt tạm tính: <strong>{{ formatMoney(totalEstimatedFine) }}</strong>
            ({{ overdueItems.length }} cuốn quá hạn)
          </span>
        </div>

        <!-- Timeline tiến trình -->
        <LoanTimeline :loan="loan" />

        <!-- Danh sách sách -->
        <div class="loan-items mt-3">
          <h3 class="h6 mb-2">
            <i
              class="bi bi-book me-1"
              aria-hidden="true"
            />
            Danh sách sách ({{ itemCount }})
          </h3>
          <ul class="list-unstyled mb-0">
            <li
              v-for="(item, idx) in loan.items"
              :key="idx"
              class="loan-item d-flex align-items-start gap-3 py-2"
              :class="{ 'border-top': idx > 0 }"
            >
              <!-- Bìa sách nhỏ -->
              <img
                v-if="item.book?.coverImage"
                :src="cloudinaryThumb(item.book.coverImage, 60)"
                :alt="item.titleSnapshot || item.book?.title || 'Bìa sách'"
                class="loan-item-cover rounded flex-shrink-0"
                loading="lazy"
              >
              <div
                v-else
                class="loan-item-cover-placeholder rounded bg-light d-flex align-items-center justify-content-center flex-shrink-0"
              >
                <i
                  class="bi bi-book text-secondary"
                  aria-hidden="true"
                />
              </div>

              <!-- Thông tin sách -->
              <div class="flex-grow-1 min-w-0">
                <div class="fw-semibold small text-truncate">
                  {{ item.titleSnapshot || item.book?.title || 'Không rõ tên sách' }}
                </div>
                <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                  <StatusBadge
                    :status="item.status"
                    type="item"
                  />
                  <!-- Hạn trả -->
                  <span
                    v-if="item.dueDate && ['borrowing'].includes(item.status)"
                    class="extra-small"
                    :class="daysRemainingClass(item.dueDate)"
                  >
                    {{ daysRemainingLabel(item.dueDate) }}
                  </span>
                  <!-- Ngày trả -->
                  <span
                    v-if="item.returnDate"
                    class="extra-small text-muted"
                  >
                    Trả: {{ formatDate(item.returnDate, 'DD/MM/YYYY') }}
                  </span>
                  <!-- Số lần gia hạn -->
                  <span
                    v-if="item.renewCount > 0"
                    class="extra-small text-info"
                  >
                    <i
                      class="bi bi-arrow-repeat"
                      aria-hidden="true"
                    />
                    Gia hạn {{ item.renewCount }} lần
                  </span>
                </div>
                <!-- Phạt tạm tính cho item quá hạn -->
                <div
                  v-if="overdueItems.find((o) => o._id === item._id)"
                  class="extra-small text-danger mt-1"
                >
                  Quá hạn {{ overdueItems.find((o) => o._id === item._id).daysOverdue }} ngày
                  · Phạt tạm tính: {{ formatMoney(overdueItems.find((o) => o._id === item._id).estimatedFine) }}
                </div>

                <!-- Trạng thái gia hạn gần nhất -->
                <div
                  v-if="getLatestRenewal(item)"
                  class="renewal-status mt-2 p-2 rounded small"
                  :class="{
                    'bg-warning bg-opacity-10': getLatestRenewal(item).status === 'pending',
                    'bg-success bg-opacity-10': getLatestRenewal(item).status === 'approved',
                    'bg-danger bg-opacity-10': getLatestRenewal(item).status === 'rejected',
                    'bg-secondary bg-opacity-10': getLatestRenewal(item).status === 'cancelled',
                  }"
                >
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <i
                      class="bi bi-arrow-repeat"
                      aria-hidden="true"
                    />
                    <span class="fw-semibold">Gia hạn:</span>
                    <span
                      class="badge"
                      :class="renewalBadgeClass(getLatestRenewal(item).status)"
                    >
                      {{ renewalStatusLabel(getLatestRenewal(item).status) }}
                    </span>
                    <!-- Nút hủy cho pending -->
                    <button
                      v-if="getLatestRenewal(item).status === 'pending'"
                      class="btn btn-outline-secondary btn-sm py-0 px-2 ms-auto"
                      type="button"
                      :disabled="cancellingRenewalId === getLatestRenewal(item)._id"
                      @click.stop="handleCancelRenewal(getLatestRenewal(item))"
                    >
                      <span
                        v-if="cancellingRenewalId === getLatestRenewal(item)._id"
                        class="spinner-border spinner-border-sm me-1"
                        role="status"
                      />
                      Hủy gia hạn
                    </button>
                  </div>
                  <!-- Lý do yêu cầu -->
                  <div
                    v-if="getLatestRenewal(item).reason"
                    class="extra-small text-muted mt-1"
                  >
                    Lý do: {{ getLatestRenewal(item).reason }}
                  </div>
                  <!-- Ngày dự kiến -->
                  <div
                    v-if="getLatestRenewal(item).requestedDueDate"
                    class="extra-small text-muted mt-1"
                  >
                    Hạn mới dự kiến: {{ formatDate(getLatestRenewal(item).requestedDueDate, 'DD/MM/YYYY') }}
                  </div>
                  <!-- Lý do từ chối -->
                  <div
                    v-if="getLatestRenewal(item).status === 'rejected' && getLatestRenewal(item).rejectReason"
                    class="extra-small text-danger mt-1"
                  >
                    <i
                      class="bi bi-x-circle me-1"
                      aria-hidden="true"
                    />
                    Lý do từ chối: {{ getLatestRenewal(item).rejectReason }}
                  </div>
                </div>

                <!-- Lịch sử gia hạn đã duyệt (từ item.renewals[]) -->
                <details
                  v-if="item.renewals && item.renewals.length > 0"
                  class="mt-2"
                >
                  <summary class="extra-small text-muted cursor-pointer">
                    <i
                      class="bi bi-clock-history me-1"
                      aria-hidden="true"
                    />
                    Lịch sử gia hạn ({{ item.renewals.length }})
                  </summary>
                  <ul class="list-unstyled ps-3 mt-1 mb-0">
                    <li
                      v-for="(rh, ri) in item.renewals"
                      :key="ri"
                      class="extra-small text-muted py-1"
                      :class="{ 'border-top': ri > 0 }"
                    >
                      Lần {{ ri + 1 }}:
                      {{ formatDate(rh.oldDue, 'DD/MM/YYYY') }}
                      → {{ formatDate(rh.newDue, 'DD/MM/YYYY') }}
                      <span class="text-muted">
                        ({{ formatDate(rh.at, 'DD/MM HH:mm') }})
                      </span>
                    </li>
                  </ul>
                </details>

                <!-- Nút gia hạn -->
                <div
                  v-if="item.status === 'borrowing'"
                  class="mt-2"
                >
                  <RenewRequestButton
                    :loan="loan"
                    :item="item"
                    :pending-renewal="getPendingRenewal(item)"
                    @renewed="handleRenewed"
                  />
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Ghi chú của độc giả -->
        <div
          v-if="loan.requestNote"
          class="mt-3 p-2 bg-light rounded small"
        >
          <i
            class="bi bi-chat-left-text me-1 text-muted"
            aria-hidden="true"
          />
          <span class="text-muted">Ghi chú:</span> {{ loan.requestNote }}
        </div>

        <!-- Lý do từ chối -->
        <div
          v-if="loan.status === 'rejected' && loan.rejectReason"
          class="mt-3 p-2 bg-danger bg-opacity-10 rounded small text-danger"
        >
          <i
            class="bi bi-x-circle me-1"
            aria-hidden="true"
          />
          <span class="fw-semibold">Lý do từ chối:</span> {{ loan.rejectReason }}
        </div>
      </div>
    </Transition>

    <!-- Confirm Modal hủy phiếu -->
    <ConfirmModal
      v-model="showCancelModal"
      title="Hủy yêu cầu mượn sách"
      message="Bạn có chắc muốn hủy yêu cầu mượn sách này? Thao tác không thể hoàn tác."
      confirm-text="Hủy yêu cầu"
      cancel-text="Không, giữ lại"
      variant="danger"
      :loading="cancelling"
      @confirm="handleCancel"
    />
  </article>
</template>

<style scoped>
.loan-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.loan-card:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
}

.loan-card-header {
  cursor: pointer;
  user-select: none;
}

.loan-card-header:hover {
  background-color: #f8f9fa;
}

.loan-item-cover {
  width: 45px;
  height: 60px;
  object-fit: cover;
}

.loan-item-cover-placeholder {
  width: 45px;
  height: 60px;
  font-size: 1.2rem;
}

.extra-small {
  font-size: 0.75rem;
}

.min-w-0 {
  min-width: 0;
}

.renewal-status {
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.cursor-pointer {
  cursor: pointer;
}

/* Transition mở rộng */
.slide-fade-enter-active {
  transition:
    opacity 0.2s ease,
    max-height 0.3s ease;
  max-height: 2000px;
}

.slide-fade-leave-active {
  transition:
    opacity 0.15s ease,
    max-height 0.2s ease;
  max-height: 2000px;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
</style>
