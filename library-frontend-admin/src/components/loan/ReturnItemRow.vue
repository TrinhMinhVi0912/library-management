<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: {
    type: Object,
    default: () => ({ selected: false, condition: 'good', damagedFineAmount: 0 }),
  },
  finePolicy: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const selection = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', { ...props.modelValue, ...value }),
});

const daysLate = computed(() => {
  if (!props.item.dueDate) return 0;
  return Math.max(0, Math.ceil((Date.now() - new Date(props.item.dueDate).getTime()) / 86400000));
});

const previewFine = computed(() => {
  if (!props.finePolicy) return null;
  const lateFine = daysLate.value * Number(props.finePolicy.lateFeePerDay || 0);
  if (selection.value.condition === 'damaged') return lateFine + Math.max(0, Number(selection.value.damagedFineAmount) || 0);
  if (selection.value.condition === 'lost') {
    const value = Number(props.item.priceSnapshot || 0);
    return lateFine + value * Number(props.finePolicy.lostBookFeeRate || 0) + Number(props.finePolicy.lostBookProcessingFee || 0);
  }
  return lateFine;
});

function updateSelection(value) {
  selection.value = { selected: value };
}

function updateCondition(value) {
  selection.value = { condition: value };
}

function updateDamagedFine(value) {
  selection.value = { damagedFineAmount: value === '' ? 0 : Number(value) };
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
}
</script>

<template>
  <article
    class="surface-card return-item-card"
    :class="{ selected: selection.selected }"
  >
    <div class="return-item-top">
      <label class="return-check">
        <input
          type="checkbox"
          :checked="selection.selected"
          :disabled="disabled"
          :aria-label="`Chọn trả sách ${item.titleSnapshot || item.book?.title || ''}`"
          @change="updateSelection($event.target.checked)"
        >
        <span class="return-book-title">{{ item.titleSnapshot || item.book?.title || 'Sách' }}</span>
      </label>
      <span class="return-due-date">Hạn trả: {{ formatDate(item.dueDate) }}</span>
    </div>

    <div
      v-if="selection.selected"
      class="return-fields"
    >
      <label class="return-field">
        <span>Tình trạng sách</span>
        <select
          class="form-select form-select-sm"
          :value="selection.condition"
          :disabled="disabled"
          @change="updateCondition($event.target.value)"
        >
          <option value="good">Tốt</option>
          <option value="damaged">Hư hỏng</option>
          <option value="lost">Mất</option>
        </select>
      </label>
      <label
        v-if="selection.condition === 'damaged'"
        class="return-field"
      >
        <span>Phạt hư hỏng (nhập số tiền)</span>
        <input
          class="form-control form-control-sm"
          type="number"
          min="0"
          step="1000"
          :value="selection.damagedFineAmount"
          :disabled="disabled"
          @input="updateDamagedFine($event.target.value)"
        >
      </label>
      <div
        class="fine-preview"
        aria-live="polite"
      >
        <span>Trễ hạn: {{ daysLate }} ngày</span>
        <strong v-if="previewFine !== null">Phạt dự kiến: {{ formatMoney(previewFine) }}</strong>
        <span
          v-else
          class="text-danger"
        >Chưa tải được chính sách phạt.</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.return-item-card {
  padding: 1rem;
}

.return-item-card.selected { border-color: #2563eb; }

.return-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.return-check {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  min-width: 0;
}

.return-book-title { font-weight: 600; }
.return-due-date { flex: 0 0 auto; color: #6b7280; font-size: 0.825rem; }

.return-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
  margin-top: 1rem;
  padding-left: 1.5rem;
}

.return-field {
  display: grid;
  gap: 0.35rem;
  color: #6b7280;
  font-size: 0.825rem;
}

.fine-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  grid-column: 1 / -1;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.85rem;
}

@media (max-width: 575.98px) {
  .return-item-top { flex-direction: column; }
  .return-fields { grid-template-columns: minmax(0, 1fr); padding-left: 0; }
  .fine-preview { align-items: flex-start; flex-direction: column; grid-column: auto; }
}
</style>
