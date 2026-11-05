<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '30d' },
});

const emit = defineEmits(['update:modelValue']);
const options = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: '12m', label: '12 tháng' },
];
const selected = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
</script>

<template>
  <label class="date-range-label">
    <span>Khoảng thời gian</span>
    <select
      v-model="selected"
      class="form-select form-select-sm"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >{{ option.label }}</option>
    </select>
  </label>
</template>

<style scoped lang="scss">
.date-range-label {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: #6b7280;
  font-size: 0.825rem;
}

select {
  width: auto;
  min-width: 110px;
}
</style>
