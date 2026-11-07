<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';

const router = useRouter();
const notificationStore = useNotificationStore();

const toasts = computed(() => notificationStore.activeToasts);

function getTypeIcon(type) {
  const icons = {
    loan: 'bi-journal-check',
    renewal: 'bi-arrow-repeat',
    due: 'bi-clock-history',
    overdue: 'bi-exclamation-triangle-fill',
    fine: 'bi-cash-coin',
    reservation: 'bi-bookmark-check-fill',
    system: 'bi-bell-fill',
  };
  return icons[type] || 'bi-bell-fill';
}

function getTypeClass(type) {
  const classes = {
    loan: 'toast-loan',
    renewal: 'toast-renewal',
    due: 'toast-due',
    overdue: 'toast-overdue',
    fine: 'toast-fine',
    reservation: 'toast-reservation',
    system: 'toast-system',
  };
  return classes[type] || 'toast-system';
}

function handleToastClick(toast) {
  notificationStore.removeToast(toast.toastId);
  if (toast.id) {
    notificationStore.markAsRead(toast.id);
  }
  if (toast.link) {
    router.push(toast.link);
  }
}

function handleClose(toastId, event) {
  event.stopPropagation();
  notificationStore.removeToast(toastId);
}
</script>

<template>
  <div
    class="realtime-toast-container"
    aria-live="polite"
    aria-atomic="true"
  >
    <transition-group
      name="toast-slide"
      tag="div"
      class="toast-stack"
    >
      <div
        v-for="toast in toasts"
        :key="toast.toastId"
        class="realtime-toast shadow-lg"
        :class="[getTypeClass(toast.type), { 'is-clickable': Boolean(toast.link) }]"
        role="alert"
        @click="handleToastClick(toast)"
      >
        <div class="toast-indicator" />
        <div class="toast-icon">
          <i
            class="bi"
            :class="getTypeIcon(toast.type)"
          />
        </div>

        <div class="toast-body">
          <div class="toast-title">
            {{ toast.title }}
          </div>
          <div class="toast-message">
            {{ toast.content }}
          </div>
          <div
            v-if="toast.link"
            class="toast-hint"
          >
            Nhấn để xem chi tiết
            <i class="bi bi-chevron-right ms-1" />
          </div>
        </div>

        <button
          type="button"
          class="btn-close-toast"
          aria-label="Đóng"
          @click="handleClose(toast.toastId, $event)"
        >
          <i class="bi bi-x" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped lang="scss">
.realtime-toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 1080;
  max-width: 380px;
  width: calc(100vw - 3rem);
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.realtime-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background-color: #ffffff;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  position: relative;
  overflow: hidden;
  cursor: default;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &.is-clickable {
    cursor: pointer;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
    }
  }

  .toast-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background-color: #2563eb;
  }

  &.toast-loan .toast-indicator {
    background-color: #0284c7;
  }
  &.toast-loan .toast-icon {
    color: #0284c7;
    background-color: #e0f2fe;
  }

  &.toast-renewal .toast-indicator {
    background-color: #16a34a;
  }
  &.toast-renewal .toast-icon {
    color: #16a34a;
    background-color: #dcfce7;
  }

  &.toast-due .toast-indicator {
    background-color: #d97706;
  }
  &.toast-due .toast-icon {
    color: #d97706;
    background-color: #fef3c7;
  }

  &.toast-overdue .toast-indicator {
    background-color: #dc2626;
  }
  &.toast-overdue .toast-icon {
    color: #dc2626;
    background-color: #fee2e2;
  }

  &.toast-fine .toast-indicator {
    background-color: #b91c1c;
  }
  &.toast-fine .toast-icon {
    color: #b91c1c;
    background-color: #fee2e2;
  }

  &.toast-reservation .toast-indicator {
    background-color: #7c3aed;
  }
  &.toast-reservation .toast-icon {
    color: #7c3aed;
    background-color: #f3e8ff;
  }

  &.toast-system .toast-indicator {
    background-color: #2563eb;
  }
  &.toast-system .toast-icon {
    color: #2563eb;
    background-color: #eff6ff;
  }
}

.toast-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #0f172a;
  margin-bottom: 0.125rem;
  line-height: 1.3;
}

.toast-message {
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.4;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toast-hint {
  font-size: 0.75rem;
  font-weight: 500;
  color: #2563eb;
  margin-top: 0.375rem;
  display: inline-flex;
  align-items: center;
}

.btn-close-toast {
  border: none;
  background: transparent;
  color: #94a3b8;
  padding: 0.25rem;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;

  &:hover {
    color: #475569;
  }
}

.toast-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-leave-active {
  transition: all 0.25s ease-in;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}
</style>

