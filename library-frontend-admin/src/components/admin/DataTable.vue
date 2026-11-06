<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: '_id' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  query: { type: String, default: '' },
  sortBy: { type: String, default: '' },
  sortOrder: { type: String, default: 'asc' },
  searchable: { type: Boolean, default: true },
});

const emit = defineEmits(['update:query', 'sort', 'page', 'retry']);
const searchValue = ref(props.query);
let searchTimer;
const visiblePages = computed(() => {
  const first = Math.max(1, props.page - 2);
  const last = Math.min(props.totalPages, first + 4);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
});

watch(() => props.query, (value) => {
  searchValue.value = value;
});

onBeforeUnmount(() => clearTimeout(searchTimer));

function updateQuery(value) {
  searchValue.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => emit('update:query', value), 300);
}

function sort(column) {
  if (!column.sortable) return;
  const order = props.sortBy === column.key && props.sortOrder === 'asc' ? 'desc' : 'asc';
  emit('sort', { key: column.key, order });
}
</script>

<template>
  <section
    class="surface-card data-table"
    aria-label="Bảng dữ liệu"
  >
    <div
      v-if="searchable || $slots.toolbar"
      class="table-toolbar"
    >
      <label
        v-if="searchable"
        class="search-field"
      >
        <i
          class="bi bi-search"
          aria-hidden="true"
        />
        <span class="visually-hidden">Tìm trong bảng</span>
        <input
          :value="searchValue"
          type="search"
          placeholder="Tìm kiếm..."
          @input="updateQuery($event.target.value)"
        >
      </label>
      <slot name="toolbar" />
    </div>

    <div class="table-responsive">
      <table class="table align-middle mb-0">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
            >
              <button
                v-if="column.sortable"
                class="sort-button"
                type="button"
                @click="sort(column)"
              >
                {{ column.label }}
                <i
                  v-if="sortBy === column.key"
                  class="bi"
                  :class="sortOrder === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'"
                  aria-hidden="true"
                />
              </button>
              <span v-else>{{ column.label }}</span>
            </th>
            <th
              v-if="$slots.row"
              scope="col"
            >
              <span class="visually-hidden">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td
              :colspan="columns.length + ($slots.row ? 1 : 0)"
              class="table-state"
            >
              <span
                class="spinner-border spinner-border-sm text-primary"
                role="status"
              />
              <span>Đang tải dữ liệu...</span>
            </td>
          </tr>
          <tr v-else-if="error">
            <td
              :colspan="columns.length + ($slots.row ? 1 : 0)"
              class="table-state text-muted-strong"
            >
              <slot name="error">
                Không tải được dữ liệu.
                <button
                  class="btn btn-sm btn-outline-primary ms-2"
                  type="button"
                  @click="emit('retry')"
                >
                  Thử lại
                </button>
              </slot>
            </td>
          </tr>
          <tr v-else-if="!rows.length">
            <td
              :colspan="columns.length + ($slots.row ? 1 : 0)"
              class="table-state text-muted-strong"
            >
              <slot name="empty">
                Chưa có dữ liệu phù hợp.
              </slot>
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="row in rows"
              :key="row[rowKey]"
            >
              <template v-if="$slots['row-main']">
                <slot
                  name="row-main"
                  :row="row"
                />
              </template>
              <template v-else>
                <td
                  v-for="column in columns"
                  :key="column.key"
                >
                  <slot
                    :name="`cell-${column.key}`"
                    :row="row"
                    :value="row[column.key]"
                  >
                    {{ row[column.key] ?? '—' }}
                  </slot>
                </td>
              </template>
              <td v-if="$slots.row">
                <slot
                  name="row"
                  :row="row"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <footer
      v-if="totalPages > 1"
      class="table-pagination"
    >
      <span class="text-muted-strong">{{ total }} kết quả</span>
      <nav aria-label="Phân trang bảng">
        <ul class="pagination pagination-sm mb-0">
          <li
            class="page-item"
            :class="{ disabled: page <= 1 }"
          >
            <button
              class="page-link"
              type="button"
              aria-label="Trang trước"
              :disabled="page <= 1"
              @click="emit('page', page - 1)"
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
            :class="{ active: pageNumber === page }"
          >
            <button
              class="page-link"
              type="button"
              :aria-current="pageNumber === page ? 'page' : undefined"
              @click="emit('page', pageNumber)"
            >
              {{ pageNumber }}
            </button>
          </li>
          <li
            class="page-item"
            :class="{ disabled: page >= totalPages }"
          >
            <button
              class="page-link"
              type="button"
              aria-label="Trang sau"
              :disabled="page >= totalPages"
              @click="emit('page', page + 1)"
            >
              <i
                class="bi bi-chevron-right"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
      </nav>
    </footer>
  </section>
</template>

<style scoped lang="scss">
.table-toolbar,
.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
}

.table-toolbar {
  border-bottom: 1px solid #e5e7eb;
}

.search-field {
  display: flex;
  width: min(100%, 320px);
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
}

.search-field input {
  width: 100%;
  padding: 0.4rem 0;
  border: 0;
  outline: 0;
}

.search-field input:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
}

th {
  padding: 0.85rem 1rem;
  background: #f8f9fa;
  color: #6b7280;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

td {
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
}

.sort-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.table-state {
  height: 112px;
  text-align: center;
}

.table-state .spinner-border {
  margin-right: 0.5rem;
}

.table-pagination {
  border-top: 1px solid #e5e7eb;
  font-size: 0.825rem;
}

@media (max-width: 575.98px) {
  .table-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
