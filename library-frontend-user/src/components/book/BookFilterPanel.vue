<script setup>
import { computed } from 'vue';

const props = defineProps({
  filters: {
    type: Object,
    required: true,
  },
  categories: {
    type: Array,
    default: () => [],
  },
  authors: {
    type: Array,
    default: () => [],
  },
  publishers: {
    type: Array,
    default: () => [],
  },
  idPrefix: {
    type: String,
    default: 'filter',
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:filters', 'reset']);

const hasActiveFilters = computed(() => {
  const { category, author, publisher, year, available, minRating } = props.filters;
  return Boolean(category || author || publisher || year || available || minRating);
});

function updateFilter(key, value) {
  emit('update:filters', {
    ...props.filters,
    [key]: value,
  });
}

function handleYearChange(event) {
  const val = event.target.value.trim();
  updateFilter('year', val ? Number(val) : '');
}

const currentYear = new Date().getFullYear();
</script>

<template>
  <aside
    class="book-filter-panel card border-0 shadow-sm"
    aria-label="Bộ lọc sách"
  >
    <div class="card-header bg-white py-3 d-flex align-items-center justify-content-between border-bottom">
      <div class="d-flex align-items-center gap-2">
        <i
          class="bi bi-funnel-fill text-primary"
          aria-hidden="true"
        />
        <h2 class="h6 mb-0 fw-bold">
          Bộ lọc tìm kiếm
        </h2>
      </div>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="btn btn-sm btn-link text-decoration-none p-0 text-danger"
        @click="emit('reset')"
      >
        <i
          class="bi bi-x-circle me-1"
          aria-hidden="true"
        />Đặt lại
      </button>
    </div>

    <div class="card-body p-3">
      <!-- 1. Thể loại -->
      <div class="mb-4">
        <label
          :for="`${props.idPrefix}-category`"
          class="form-label fw-semibold small text-uppercase text-secondary mb-2 d-flex align-items-center justify-content-between"
        >
          <span>Thể loại</span>
          <span
            v-if="filters.category"
            class="badge bg-primary-subtle text-primary rounded-pill"
          >1</span>
        </label>
        <select
          :id="`${props.idPrefix}-category`"
          class="form-select form-select-sm"
          :value="filters.category || ''"
          @change="updateFilter('category', $event.target.value)"
        >
          <option value="">
            Tất cả thể loại
          </option>
          <option
            v-for="cat in categories"
            :key="cat._id"
            :value="cat._id"
          >
            {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- 2. Tác giả -->
      <div class="mb-4">
        <label
          :for="`${props.idPrefix}-author`"
          class="form-label fw-semibold small text-uppercase text-secondary mb-2 d-flex align-items-center justify-content-between"
        >
          <span>Tác giả</span>
          <span
            v-if="filters.author"
            class="badge bg-primary-subtle text-primary rounded-pill"
          >1</span>
        </label>
        <select
          :id="`${props.idPrefix}-author`"
          class="form-select form-select-sm"
          :value="filters.author || ''"
          @change="updateFilter('author', $event.target.value)"
        >
          <option value="">
            Tất cả tác giả
          </option>
          <option
            v-for="author in authors"
            :key="author._id"
            :value="author._id"
          >
            {{ author.name }}
          </option>
        </select>
      </div>

      <!-- 3. Nhà xuất bản -->
      <div class="mb-4">
        <label
          :for="`${props.idPrefix}-publisher`"
          class="form-label fw-semibold small text-uppercase text-secondary mb-2 d-flex align-items-center justify-content-between"
        >
          <span>Nhà xuất bản</span>
          <span
            v-if="filters.publisher"
            class="badge bg-primary-subtle text-primary rounded-pill"
          >1</span>
        </label>
        <select
          :id="`${props.idPrefix}-publisher`"
          class="form-select form-select-sm"
          :value="filters.publisher || ''"
          @change="updateFilter('publisher', $event.target.value)"
        >
          <option value="">
            Tất cả nhà xuất bản
          </option>
          <option
            v-for="pub in publishers"
            :key="pub._id"
            :value="pub._id"
          >
            {{ pub.name }}
          </option>
        </select>
      </div>

      <!-- 4. Năm xuất bản -->
      <div class="mb-4">
        <label
          :for="`${props.idPrefix}-year`"
          class="form-label fw-semibold small text-uppercase text-secondary mb-2"
        >
          Năm xuất bản
        </label>
        <div class="input-group input-group-sm">
          <input
            :id="`${props.idPrefix}-year`"
            type="number"
            class="form-control"
            placeholder="Ví dụ: 2023"
            min="1900"
            :max="currentYear + 1"
            :value="filters.year || ''"
            @change="handleYearChange"
          >
          <button
            v-if="filters.year"
            class="btn btn-outline-secondary"
            type="button"
            title="Xóa năm"
            @click="updateFilter('year', '')"
          >
            <i
              class="bi bi-x"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <!-- 5. Tình trạng sẵn có -->
      <div class="mb-4">
        <div class="form-check form-switch">
          <input
            :id="`${props.idPrefix}-available`"
            class="form-check-input"
            type="checkbox"
            role="switch"
            :checked="Boolean(filters.available)"
            @change="updateFilter('available', $event.target.checked)"
          >
          <label
            class="form-check-label fw-semibold small"
            :for="`${props.idPrefix}-available`"
          >
            Chỉ sách còn sẵn trong kho
          </label>
        </div>
        <div class="form-text small text-secondary">
          Ẩn sách đã hết bản sao có thể mượn
        </div>
      </div>

      <!-- 6. Điểm đánh giá -->
      <div class="mb-2">
        <span class="form-label fw-semibold small text-uppercase text-secondary mb-2 d-block">
          Điểm đánh giá
        </span>
        <div class="d-flex flex-column gap-2">
          <label
            class="form-check small mb-0 d-flex align-items-center gap-2 cursor-pointer"
            :for="`${props.idPrefix}-rating-all`"
          >
            <input
              :id="`${props.idPrefix}-rating-all`"
              class="form-check-input"
              type="radio"
              :name="`${props.idPrefix}-rating`"
              value=""
              :checked="!filters.minRating"
              @change="updateFilter('minRating', '')"
            >
            <span>Tất cả đánh giá</span>
          </label>

          <label
            class="form-check small mb-0 d-flex align-items-center gap-2 cursor-pointer"
            :for="`${props.idPrefix}-rating-4`"
          >
            <input
              :id="`${props.idPrefix}-rating-4`"
              class="form-check-input"
              type="radio"
              :name="`${props.idPrefix}-rating`"
              value="4"
              :checked="Number(filters.minRating) === 4"
              @change="updateFilter('minRating', 4)"
            >
            <span class="d-flex align-items-center gap-1 text-warning">
              <i class="bi bi-star-fill" />
              <i class="bi bi-star-fill" />
              <i class="bi bi-star-fill" />
              <i class="bi bi-star-fill" />
              <i class="bi bi-star text-secondary opacity-50" />
            </span>
            <span class="text-body ms-1">Từ 4 sao trở lên</span>
          </label>

          <label
            class="form-check small mb-0 d-flex align-items-center gap-2 cursor-pointer"
            :for="`${props.idPrefix}-rating-3`"
          >
            <input
              :id="`${props.idPrefix}-rating-3`"
              class="form-check-input"
              type="radio"
              :name="`${props.idPrefix}-rating`"
              value="3"
              :checked="Number(filters.minRating) === 3"
              @change="updateFilter('minRating', 3)"
            >
            <span class="d-flex align-items-center gap-1 text-warning">
              <i class="bi bi-star-fill" />
              <i class="bi bi-star-fill" />
              <i class="bi bi-star-fill" />
              <i class="bi bi-star text-secondary opacity-50" />
              <i class="bi bi-star text-secondary opacity-50" />
            </span>
            <span class="text-body ms-1">Từ 3 sao trở lên</span>
          </label>
        </div>
      </div>
    </div>

    <div
      v-if="hasActiveFilters"
      class="card-footer bg-light border-top p-3"
    >
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm w-100"
        @click="emit('reset')"
      >
        <i
          class="bi bi-arrow-counterclockwise me-1"
          aria-hidden="true"
        />Xóa tất cả bộ lọc
      </button>
    </div>
  </aside>
</template>

<style scoped>
.book-filter-panel {
  border-radius: 0.75rem;
  overflow: hidden;
}

.cursor-pointer {
  cursor: pointer;
}
</style>

