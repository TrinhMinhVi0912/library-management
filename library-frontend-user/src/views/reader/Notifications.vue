<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';
import NotificationItem from '@/components/common/NotificationItem.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import Pagination from '@/components/common/Pagination.vue';

const route = useRoute();
const router = useRouter();
const notificationStore = useNotificationStore();

const activeFilter = ref(route.query.unread === 'true' ? 'unread' : 'all');
const selectedType = ref(String(route.query.type || 'all'));
const currentPage = ref(Number(route.query.page || 1));
const isMarkingAll = ref(false);

const typeOptions = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'loan', label: 'Mượn sách' },
  { value: 'renewal', label: 'Gia hạn' },
  { value: 'due', label: 'Sắp đến hạn / Quá hạn' },
  { value: 'fine', label: 'Tiền phạt' },
  { value: 'reservation', label: 'Đặt trước' },
  { value: 'system', label: 'Hệ thống' },
];

async function loadData() {
  const params = {
    page: currentPage.value,
    limit: 15,
  };
  if (activeFilter.value === 'unread') {
    params.unread = 'true';
  }
  await notificationStore.fetchNotifications(params);
}

function updateUrlQuery() {
  const query = {};
  if (activeFilter.value === 'unread') query.unread = 'true';
  if (selectedType.value !== 'all') query.type = selectedType.value;
  if (currentPage.value > 1) query.page = String(currentPage.value);

  router.replace({ query });
}

function handleFilterChange(filter) {
  if (activeFilter.value === filter) return;
  activeFilter.value = filter;
  currentPage.value = 1;
  updateUrlQuery();
  loadData();
}

function handleTypeChange() {
  updateUrlQuery();
}

function handlePageChange(newPage) {
  currentPage.value = newPage;
  updateUrlQuery();
  loadData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleMarkAllAsRead() {
  if (notificationStore.unreadCount === 0 || isMarkingAll.value) return;
  isMarkingAll.value = true;
  try {
    await notificationStore.markAllAsRead();
    if (activeFilter.value === 'unread') {
      await loadData();
    }
  } finally {
    isMarkingAll.value = false;
  }
}

async function handleItemRead(id) {
  await notificationStore.markAsRead(id);
  if (activeFilter.value === 'unread') {
    await loadData();
  }
}

const displayNotifications = computed(() => {
  let list = notificationStore.notifications;
  if (selectedType.value !== 'all') {
    if (selectedType.value === 'due') {
      list = list.filter((n) => n.type === 'due' || n.type === 'overdue');
    } else {
      list = list.filter((n) => n.type === selectedType.value);
    }
  }
  return list;
});

watch(
  () => [route.query.unread, route.query.type, route.query.page],
  ([qUnread, qType, qPage]) => {
    const nextFilter = qUnread === 'true' ? 'unread' : 'all';
    const nextType = String(qType || 'all');
    const nextPage = Number(qPage || 1);

    let needReload = false;
    if (activeFilter.value !== nextFilter) {
      activeFilter.value = nextFilter;
      needReload = true;
    }
    if (selectedType.value !== nextType) {
      selectedType.value = nextType;
    }
    if (currentPage.value !== nextPage) {
      currentPage.value = nextPage;
      needReload = true;
    }

    if (needReload) {
      loadData();
    }
  }
);

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="notifications-page container-xl py-4">
    <!-- Header -->
    <div class="page-header d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h1 class="page-title mb-1">
          Thông báo
        </h1>
        <p class="text-secondary mb-0">
          Cập nhật thông tin mượn trả, nhắc hạn và thông báo từ thư viện
        </p>
      </div>

      <button
        type="button"
        class="btn btn-outline-primary d-inline-flex align-items-center gap-2"
        :disabled="notificationStore.unreadCount === 0 || isMarkingAll"
        @click="handleMarkAllAsRead"
      >
        <span
          v-if="isMarkingAll"
          class="spinner-border spinner-border-sm"
          role="status"
        />
        <i
          v-else
          class="bi bi-check2-all"
        />
        <span>Đánh dấu tất cả đã đọc</span>
      </button>
    </div>

    <!-- Filters Bar -->
    <div class="filters-card card border-0 shadow-sm mb-4">
      <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
        <!-- Read status tabs -->
        <div
          class="btn-group filter-tabs"
          role="group"
          aria-label="Lọc theo trạng thái đọc"
        >
          <button
            type="button"
            class="btn btn-sm"
            :class="activeFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="handleFilterChange('all')"
          >
            Tất cả
          </button>
          <button
            type="button"
            class="btn btn-sm position-relative"
            :class="activeFilter === 'unread' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="handleFilterChange('unread')"
          >
            Chưa đọc
            <span
              v-if="notificationStore.unreadCount > 0"
              class="badge rounded-pill bg-danger ms-1"
            >
              {{ notificationStore.unreadCount }}
            </span>
          </button>
        </div>

        <!-- Type filter -->
        <div class="type-filter-wrapper d-flex align-items-center gap-2">
          <label
            for="type-select"
            class="text-secondary small fw-medium mb-0"
          >Loại:</label>
          <select
            id="type-select"
            v-model="selectedType"
            class="form-select form-select-sm"
            @change="handleTypeChange"
          >
            <option
              v-for="opt in typeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="notificationStore.loading"
      class="notifications-list card border-0 shadow-sm"
    >
      <div class="card-body p-0">
        <div
          v-for="n in 5"
          :key="n"
          class="skeleton-row p-3 border-bottom d-flex gap-3 align-items-center"
        >
          <div class="skeleton-circle" />
          <div class="flex-grow-1">
            <div class="skeleton-bar w-50 mb-2" />
            <div class="skeleton-bar w-75" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="displayNotifications.length === 0"
      class="card border-0 shadow-sm py-5"
    >
      <EmptyState
        icon="bi bi-bell-slash"
        :title="activeFilter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'"
        :description="activeFilter === 'unread'
          ? 'Tuyệt vời! Bạn đã xem hết tất cả các thông báo.'
          : 'Mọi thông tin về sách mượn, gia hạn và nhắc hẹn sẽ xuất hiện tại đây.'"
      />
    </div>

    <!-- Notifications List -->
    <div
      v-else
      class="notifications-list card border-0 shadow-sm overflow-hidden"
    >
      <div class="card-body p-0">
        <NotificationItem
          v-for="item in displayNotifications"
          :key="item._id"
          :notification="item"
          @read="handleItemRead"
        />
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="!notificationStore.loading && notificationStore.meta.totalPages > 1"
      class="d-flex justify-content-center mt-4"
    >
      <Pagination
        :page="currentPage"
        :total-pages="notificationStore.meta.totalPages"
        :total="notificationStore.meta.total"
        @update:page="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.notifications-page {
  max-width: 900px;
}

.page-title {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
}

.filters-card {
  border-radius: 0.75rem;
}

.type-filter-wrapper {
  min-width: 180px;

  .form-select {
    border-radius: 0.375rem;
  }
}

.notifications-list {
  border-radius: 0.75rem;

  :deep(.notification-item:last-child) {
    border-bottom: none;
  }
}

.skeleton-row {
  .skeleton-circle {
    width: 2.375rem;
    height: 2.375rem;
    border-radius: 50%;
    background-color: #f1f5f9;
    animation: skeleton-pulse 1.5s infinite;
  }

  .skeleton-bar {
    height: 0.875rem;
    border-radius: 0.25rem;
    background-color: #f1f5f9;
    animation: skeleton-pulse 1.5s infinite;
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

