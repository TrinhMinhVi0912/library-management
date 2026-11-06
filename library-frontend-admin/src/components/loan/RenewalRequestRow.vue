<script setup>
defineProps({
  request: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:selected']);

function formatReader(reader) {
  return [reader?.firstName, reader?.lastName].filter(Boolean).join(' ') || 'Độc giả';
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}
</script>

<template>
  <td>
    <input
      type="checkbox"
      :checked="selected"
      :disabled="disabled || request.hasWaitingReservation"
      :aria-label="`Chọn yêu cầu gia hạn phiếu ${request.loan?.code || ''}`"
      :title="request.hasWaitingReservation ? 'Không thể duyệt khi sách đang có người đặt trước.' : undefined"
      @change="emit('update:selected', $event.target.checked)"
    >
  </td>
  <td><strong>{{ request.loan?.code || '—' }}</strong></td>
  <td>
    {{ formatReader(request.reader) }}
    <small class="d-block text-muted-strong">{{ request.reader?.code || request.reader?.email || '' }}</small>
  </td>
  <td>
    {{ request.book?.title || 'Sách' }}
    <small class="d-block text-muted-strong">{{ request.book?.code || '' }}</small>
  </td>
  <td class="renewal-dates">
    <span>{{ formatDate(request.currentDueDate) }}</span>
    <i
      class="bi bi-arrow-right"
      aria-hidden="true"
    />
    <strong>{{ formatDate(request.requestedDueDate) }}</strong>
  </td>
  <td>{{ request.renewCount || 0 }}</td>
  <td>
    <span
      v-if="request.hasWaitingReservation"
      class="badge text-bg-warning reservation-warning"
    >
      <i
        class="bi bi-bookmark-exclamation me-1"
        aria-hidden="true"
      />
      Có người đặt trước
    </span>
    <span
      v-else
      class="text-muted-strong"
    >Không</span>
  </td>
  <td>{{ formatDate(request.createdAt) }}</td>
</template>

<style scoped lang="scss">
.renewal-dates {
  white-space: nowrap;
}

.renewal-dates i {
  margin: 0 0.4rem;
  color: #6b7280;
}

.reservation-warning {
  white-space: nowrap;
  font-weight: 500;
}
</style>
