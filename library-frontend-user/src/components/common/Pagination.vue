<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
});

const emit = defineEmits(['update:page']);
const visiblePages = computed(() => {
  const current = Math.max(1, Math.min(props.page, props.totalPages));
  const start = Math.max(1, Math.min(current - 2, props.totalPages - 4));
  const end = Math.min(props.totalPages, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
});
</script>

<template>
  <nav
    v-if="props.totalPages > 1"
    class="pagination-wrap"
    aria-label="Phân trang"
  >
    <span class="pagination-total text-secondary">{{ props.total.toLocaleString('vi-VN') }} kết quả</span>
    <ul class="pagination mb-0">
      <li
        class="page-item"
        :class="{ disabled: props.page <= 1 }"
      >
        <button
          class="page-link"
          type="button"
          aria-label="Trang trước"
          :disabled="props.page <= 1"
          @click="emit('update:page', props.page - 1)"
        >
          <i
            class="bi bi-chevron-left"
            aria-hidden="true"
          />
        </button>
      </li>
      <li
        v-for="pageNumber in visiblePages"
        :key="pageNumber"
        class="page-item"
        :class="{ active: pageNumber === props.page }"
      >
        <button
          class="page-link"
          type="button"
          :aria-current="pageNumber === props.page ? 'page' : undefined"
          :aria-label="`Trang ${pageNumber}`"
          @click="emit('update:page', pageNumber)"
        >
          {{ pageNumber }}
        </button>
      </li>
      <li
        class="page-item"
        :class="{ disabled: props.page >= props.totalPages }"
      >
        <button
          class="page-link"
          type="button"
          aria-label="Trang sau"
          :disabled="props.page >= props.totalPages"
          @click="emit('update:page', props.page + 1)"
        >
          <i
            class="bi bi-chevron-right"
            aria-hidden="true"
          />
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
}

.pagination-total {
  font-size: 0.875rem;
}

@media (max-width: 575.98px) {
  .pagination-wrap {
    align-items: flex-start;
    flex-direction: column;
  }

  .pagination {
    flex-wrap: wrap;
  }
}
</style>
