<script setup>
import { computed } from 'vue';

const labelsByType = {
  loan: {
    pending: ['Chờ duyệt', 'pending'],
    approved: ['Chờ nhận sách', 'approved'],
    borrowing: ['Đang mượn', 'borrowing'],
    overdue: ['Quá hạn', 'overdue'],
    returned: ['Đã trả', 'returned'],
    rejected: ['Từ chối', 'rejected'],
    cancelled: ['Đã hủy', 'cancelled'],
    expired: ['Hết hạn', 'expired'],
  },
  item: {
    pending: ['Chờ duyệt', 'pending'],
    borrowing: ['Đang mượn', 'borrowing'],
    returned: ['Đã trả', 'returned'],
    lost: ['Đã mất', 'lost'],
  },
  fine: {
    unpaid: ['Chưa thu', 'unpaid'],
    paid: ['Đã thu', 'paid'],
    waived: ['Đã miễn', 'waived'],
  },
  renewal: {
    pending: ['Chờ duyệt', 'pending'],
    approved: ['Đã duyệt', 'approved'],
    rejected: ['Từ chối', 'rejected'],
    cancelled: ['Đã hủy', 'cancelled'],
  },
  reservation: {
    waiting: ['Đang chờ', 'waiting'],
    available: ['Đã có sách', 'available'],
    fulfilled: ['Đã nhận sách', 'fulfilled'],
    expired: ['Hết hạn', 'expired'],
    cancelled: ['Đã hủy', 'cancelled'],
  },
  book: {
    available: ['Còn sách', 'available'],
    unavailable: ['Hết sách', 'unavailable'],
    active: ['Đang hiển thị', 'available'],
    hidden: ['Đang ẩn', 'rejected'],
  },
};

const props = defineProps({
  status: { type: String, required: true },
  type: {
    type: String,
    default: 'loan',
    validator: (value) => ['loan', 'item', 'fine', 'renewal', 'reservation', 'book'].includes(value),
  },
  label: { type: String, default: '' },
});

const state = computed(() => labelsByType[props.type]?.[props.status] || [props.status || 'Không xác định', 'rejected']);
const displayLabel = computed(() => props.label || state.value[0]);
const badgeClass = computed(() => `status-${state.value[1]}`);
</script>

<template>
  <span
    class="status-badge"
    :class="badgeClass"
    :aria-label="`Trạng thái: ${displayLabel}`"
  >
    {{ displayLabel }}
  </span>
</template>
