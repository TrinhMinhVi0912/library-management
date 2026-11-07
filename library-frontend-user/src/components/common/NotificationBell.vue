<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';
import NotificationItem from '@/components/common/NotificationItem.vue';

const router = useRouter();
const notificationStore = useNotificationStore();

const isOpen = ref(false);
const bellRef = ref(null);

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    notificationStore.fetchRecent();
  }
}

function closeDropdown() {
  isOpen.value = false;
}

function handleViewAll() {
  closeDropdown();
  router.push({ name: 'notifications' });
}

async function handleMarkAllAsRead() {
  await notificationStore.markAllAsRead();
}

async function handleItemRead(id) {
  await notificationStore.markAsRead(id);
}

function handleItemClick() {
  closeDropdown();
}

function handleDocumentClick(event) {
  if (bellRef.value && !bellRef.value.contains(event.target)) {
    closeDropdown();
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    ref="bellRef"
    class="notification-bell-container"
  >
    <button
      type="button"
      class="nav-action bell-trigger position-relative"
      :class="{ 'is-active': isOpen }"
      aria-label="Thông báo"
      :aria-expanded="isOpen"
      @click="toggleDropdown"
    >
      <i
        class="bi bi-bell"
        aria-hidden="true"
      />
      <span class="action-label">Thông báo</span>
      <span
        v-if="notificationStore.unreadCount > 0"
        class="count-badge"
      >
        {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
      </span>
    </button>

    <!-- Dropdown Menu -->
    <transition name="fade-slide">
      <div
        v-if="isOpen"
        class="notification-dropdown shadow-lg"
      >
        <div class="dropdown-header">
          <div class="header-title">
            <span class="fw-semibold">Thông báo</span>
            <span
              v-if="notificationStore.unreadCount > 0"
              class="badge bg-primary rounded-pill ms-2"
            >
              {{ notificationStore.unreadCount }} chưa đọc
            </span>
          </div>
          <button
            v-if="notificationStore.unreadCount > 0"
            type="button"
            class="btn-mark-all"
            @click="handleMarkAllAsRead"
          >
            <i
              class="bi bi-check2-all me-1"
              aria-hidden="true"
            />Đọc tất cả
          </button>
        </div>

        <div class="dropdown-body">
          <div
            v-if="notificationStore.dropdownLoading"
            class="loading-skeletons"
          >
            <div
              v-for="n in 3"
              :key="n"
              class="skeleton-item"
            >
              <div class="skeleton-icon" />
              <div class="skeleton-content">
                <div class="skeleton-line w-75" />
                <div class="skeleton-line w-50" />
              </div>
            </div>
          </div>

          <div
            v-else-if="notificationStore.recentNotifications.length === 0"
            class="empty-state"
          >
            <i
              class="bi bi-bell-slash"
              aria-hidden="true"
            />
            <p class="mb-0">
              Bạn không có thông báo nào
            </p>
          </div>

          <div
            v-else
            class="notification-list"
          >
            <NotificationItem
              v-for="item in notificationStore.recentNotifications"
              :key="item._id"
              :notification="item"
              :dense="true"
              @read="handleItemRead"
              @click="handleItemClick"
            />
          </div>
        </div>

        <div class="dropdown-footer">
          <button
            type="button"
            class="btn-view-all"
            @click="handleViewAll"
          >
            Xem tất cả thông báo
            <i
              class="bi bi-arrow-right ms-1"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.notification-bell-container {
  position: relative;
  display: inline-block;
}

.bell-trigger {
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover,
  &.is-active {
    color: #2563eb;
    background-color: #f1f5f9;
  }

  i {
    font-size: 1.125rem;
  }
}

.count-badge {
  position: absolute;
  top: 0.125rem;
  right: 0.25rem;
  background-color: #dc2626;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 700;
  min-width: 1.125rem;
  height: 1.125rem;
  line-height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  text-align: center;
}

.notification-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 380px;
  max-width: 90vw;
  background-color: #ffffff;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  z-index: 1050;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;

  .header-title {
    display: flex;
    align-items: center;
    font-size: 0.9375rem;
  }
}

.btn-mark-all {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.15s;

  &:hover {
    background-color: #dbeafe;
  }
}

.dropdown-body {
  max-height: 380px;
  overflow-y: auto;
}

.notification-list {
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  color: #94a3b8;
  gap: 0.5rem;
  font-size: 0.875rem;

  i {
    font-size: 2rem;
  }
}

.loading-skeletons {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.skeleton-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background-color: #e2e8f0;
  animation: pulse 1.5s infinite;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.skeleton-line {
  height: 0.75rem;
  border-radius: 0.25rem;
  background-color: #e2e8f0;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.dropdown-footer {
  border-top: 1px solid #e2e8f0;
  background-color: #f8fafc;
  padding: 0.625rem 1rem;
  text-align: center;
}

.btn-view-all {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    text-decoration: underline;
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

