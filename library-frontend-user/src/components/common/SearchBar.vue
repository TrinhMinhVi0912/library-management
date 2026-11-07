<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Tìm kiếm...' },
  label: { type: String, default: 'Tìm kiếm' },
  debounceMs: { type: Number, default: 300, validator: (value) => value >= 0 },
});

const emit = defineEmits(['update:modelValue', 'search']);
const inputValue = ref(props.modelValue);
let debounceTimer;

watch(() => props.modelValue, (value) => {
  if (value !== inputValue.value) inputValue.value = value;
});

onBeforeUnmount(() => clearTimeout(debounceTimer));

function scheduleSearch(value) {
  inputValue.value = value;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:modelValue', value);
    emit('search', value);
  }, props.debounceMs);
}

function clearSearch() {
  scheduleSearch('');
}

function submitSearch() {
  clearTimeout(debounceTimer);
  emit('update:modelValue', inputValue.value);
  emit('search', inputValue.value);
}
</script>

<template>
  <div class="input-group search-bar">
    <span
      class="input-group-text bg-white"
      aria-hidden="true"
    >
      <i class="bi bi-search" />
    </span>
    <input
      :value="inputValue"
      class="form-control border-start-0"
      type="search"
      :placeholder="props.placeholder"
      :aria-label="props.label"
      @input="scheduleSearch($event.target.value)"
      @keydown.enter.prevent="submitSearch"
    >
    <button
      v-if="inputValue"
      class="btn btn-outline-secondary"
      type="button"
      aria-label="Xóa nội dung tìm kiếm"
      @click="clearSearch"
    >
      <i
        class="bi bi-x-lg"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
