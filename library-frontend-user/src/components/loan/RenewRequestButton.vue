<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { dayjs, TIMEZONE } from '@/utils/format';
import loanService from '@/services/loan.service';

const MAX_RENEWALS = 2; // settings.maxRenewals mặc định

const props = defineProps({
  /** Phiếu mượn (cần _id) */
  loan: { type: Object, required: true },
  /** Mục sách trong phiếu (cần book._id, status, dueDate, renewCount) */
  item: { type: Object, required: true },
  /** Yêu cầu gia hạn đang chờ cho item này (nếu có) */
  pendingRenewal: { type: Object, default: null },
});

const emit = defineEmits(['renewed']);
const toast = useToast();

const showModal = ref(false);
const reason = ref('');
const submitting = ref(false);
const reservationBlock = ref(false);

// --- Tính lý do vô hiệu ---
const disabledReason = computed(() => {
  const item = props.item;
  if (!item) return 'Không có thông tin sách';

  // Sách không đang mượn
  if (item.status !== 'borrowing') return null; // ẩn hẳn, không hiện nút

  if (reservationBlock.value) return 'Sách đang có người đặt trước, không thể gia hạn';

  // Đã quá hạn
  if (item.dueDate) {
    const due = dayjs(item.dueDate).tz(TIMEZONE);
    const now = dayjs().tz(TIMEZONE);
    if (now.isAfter(due)) return 'Sách đã quá hạn, không thể gia hạn';
  }

  // Hết lượt gia hạn
  if ((item.renewCount || 0) >= MAX_RENEWALS) return 'Đã hết số lượt gia hạn';

  // Đang có yêu cầu chờ duyệt
  if (props.pendingRenewal) return 'Đang có yêu cầu gia hạn chờ duyệt';

  return null;
});

/** Chỉ hiện nút khi item đang borrowing */
const shouldShow = computed(() => props.item?.status === 'borrowing');

const isDisabled = computed(() => !!disabledReason.value);

watch(
  () => [props.item?.book?._id || props.item?.book, props.item?.renewCount, props.pendingRenewal?._id],
  () => { reservationBlock.value = false; }
);

// --- Map mã lỗi API → thông báo tooltip-friendly ---
const ERROR_MESSAGES = {
  RENEW_OVERDUE: 'Sách đã quá hạn, không thể gia hạn',
  RENEW_LIMIT_REACHED: 'Đã hết số lượt gia hạn',
  RENEW_RESERVED: 'Sách đang có người đặt trước, không thể gia hạn',
  RENEW_PENDING: 'Đã có yêu cầu gia hạn đang chờ duyệt',
  RENEW_ITEM_NOT_BORROWING: 'Sách không còn ở trạng thái đang mượn',
};

function openModal() {
  if (isDisabled.value) return;
  reason.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  reason.value = '';
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const bookId = props.item.book?._id || props.item.book;
    const payload = {};
    if (reason.value.trim()) payload.reason = reason.value.trim();

    await loanService.createRenewal(props.loan._id, bookId, payload);
    toast.success('Đã gửi yêu cầu gia hạn thành công!');
    closeModal();
    emit('renewed');
  } catch (error) {
    const code = error?.response?.data?.code;
    const msg =
      ERROR_MESSAGES[code] ||
      error?.response?.data?.message ||
      'Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.';
    if (code === 'RENEW_RESERVED') {
      reservationBlock.value = true;
      closeModal();
    }
    toast.error(msg);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <span
    v-if="shouldShow"
    class="renew-btn-wrapper d-inline-block"
    :title="disabledReason || ''"
  >
    <button
      class="btn btn-outline-primary btn-sm"
      type="button"
      :disabled="isDisabled || submitting"
      @click.stop="openModal"
    >
      <i
        class="bi bi-arrow-repeat me-1"
        aria-hidden="true"
      />
      Gia hạn
    </button>

    <!-- Modal nhập lý do -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="modal-backdrop fade show"
        @click="closeModal"
      />
      <div
        v-if="showModal"
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        @click.self="closeModal"
      >
        <div
          class="modal-dialog modal-dialog-centered"
          role="document"
        >
          <div
            class="modal-content"
            @click.stop
          >
            <div class="modal-header">
              <h5 class="modal-title">
                <i
                  class="bi bi-arrow-repeat me-2 text-primary"
                  aria-hidden="true"
                />
                Yêu cầu gia hạn
              </h5>
              <button
                type="button"
                class="btn-close"
                aria-label="Đóng"
                @click="closeModal"
              />
            </div>
            <div class="modal-body">
              <p class="small text-muted mb-3">
                Sách:
                <strong>{{ item.titleSnapshot || item.book?.title || '—' }}</strong>
              </p>
              <div class="mb-3">
                <label
                  for="renew-reason"
                  class="form-label small"
                >
                  Lý do gia hạn
                  <span class="text-muted">(không bắt buộc)</span>
                </label>
                <textarea
                  id="renew-reason"
                  v-model="reason"
                  class="form-control"
                  rows="3"
                  maxlength="500"
                  placeholder="Nhập lý do gia hạn nếu cần..."
                />
                <div class="form-text text-end">
                  {{ reason.length }}/500
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="submitting"
                @click="closeModal"
              >
                Hủy
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="submitting"
                @click="handleSubmit"
              >
                <span
                  v-if="submitting"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                />
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.renew-btn-wrapper {
  cursor: default;
}

.renew-btn-wrapper button:disabled {
  pointer-events: none;
}
</style>

