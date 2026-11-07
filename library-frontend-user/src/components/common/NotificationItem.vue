<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { formatRelativeTime } from '@/utils/format';

const props = defineProps({
  notification: {
    type: Object,
    required: true,
  },
  dense: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['read', 'click']);

const router = useRouter();

const typeConfig = computed(() => {
  const type = props.notification.type || 'system';
  const configs = {
    loan: {
      icon: 'bi-journal-text',
      label: 'Mượn sách',
      colorClass: 'type-loan',
    },
    renewal: {
      icon: 'bi-arrow-repeat',
      label: 'Gia hạn',
      colorClass: 'type-renewal',
    },
    due: {
      icon: 'bi-clock-history',
      label: 'Sắp đến hạn',
      colorClass: 'type-due',
    },
    overdue: {
      icon: 'bi-exclamation-triangle',
      label: 'Quá hạn',
      colorClass: 'type-overdue',
    },
    fine: {
      icon: 'bi-cash-coin',
      label: 'Tiền phạt',
      colorClass: 'type-fine',
    },
    reservation: {
      icon: 'bi-bookmark-check',
      label: 'Đặt trước',
      colorClass: 'type-reservation',
    },
    system: {
      icon: 'bi-bell',
      label: 'Hệ thống',
      colorClass: 'type-system',
    },
  };
  return configs[type] || configs.system;
});

const relativeTime = computed(() => formatRelativeTime(props.notification.createdAt));

function handleClick() {
  emit('click', props.notification);
  if (!props.notification.isRead) {
    emit('read', props.notification._id);
  }
  if (props.notification.link) {
    router.push(props.notification.link);
  }
}

function handleMarkRead(event) {
  event.stopPropagation();
  emit('read', props.notification._id);
}
</script>

<template>
  <div
    class="notification-item"
    :class="{
      'is-unread': !notification.isRead,
      'is-dense': dense,
      'has-link': Boolean(notification.link),
    }"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <div
      class="item-icon-wrapper"
      :class="typeConfig.colorClass"
      aria-hidden="true"
    >
      <i
        class="bi"
        :class="typeConfig.icon"
      />
    </div>

    <div class="item-body">
      <div class="item-header">
        <span
          class="badge-type"
          :class="typeConfig.colorClass"
        >{{ typeConfig.label }}</span>
        <span class="item-time">{{ relativeTime }}</span>
      </div>

      <div class="item-title">
        {{ notification.title }}
      </div>

      <p
        class="item-content"
        :class="{ 'text-truncate-2': dense }"
      >
        {{ notification.content }}
      </p>
    </div>

    <div class="item-actions">
      <span
        v-if="!notification.isRead"
        class="unread-dot"
        title="Chưa đọc"
        aria-label="Chưa đọc"
      />
      <button
        v-if="!notification.isRead"
        type="button"
        class="btn-mark-read"
        title="Đánh dấu đã đọc"
        aria-label="Đánh dấu đã đọc"
        @click="handleMarkRead"
      >
        <i
          class="bi bi-check2"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  background-color: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  position: relative;

  &:hover {
    background-color: #f8fafc;
  }

  &.is-unread {
    background-color: #f0f7ff;
    border-left: 3px solid #2563eb;

    &:hover {
      background-color: #e6f0fd;
    }
  }

  &.is-dense {
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;

    .item-icon-wrapper {
      width: 2rem;
      height: 2rem;
      font-size: 0.875rem;
    }

    .item-title {
      font-size: 0.875rem;
    }

    .item-content {
      font-size: 0.8125rem;
      margin-bottom: 0;
    }
  }
}

.item-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.375rem;
  height: 2.375rem;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 1rem;

  &.type-loan {
    background-color: #e0f2fe;
    color: #0284c7;
  }

  &.type-renewal {
    background-color: #dcfce7;
    color: #16a34a;
  }

  &.type-due {
    background-color: #fef3c7;
    color: #d97706;
  }

  &.type-overdue {
    background-color: #fee2e2;
    color: #dc2626;
  }

  &.type-fine {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  &.type-reservation {
    background-color: #f3e8ff;
    color: #7c3aed;
  }

  &.type-system {
    background-color: #f1f5f9;
    color: #475569;
  }
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.badge-type {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;

  &.type-loan {
    background-color: #e0f2fe;
    color: #0369a1;
  }

  &.type-renewal {
    background-color: #dcfce7;
    color: #15803d;
  }

  &.type-due {
    background-color: #fef3c7;
    color: #b45309;
  }

  &.type-overdue {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  &.type-fine {
    background-color: #fee2e2;
    color: #991b1b;
  }

  &.type-reservation {
    background-color: #f3e8ff;
    color: #6d28d9;
  }

  &.type-system {
    background-color: #f1f5f9;
    color: #475569;
  }
}

.item-time {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}

.item-title {
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.125rem;
  line-height: 1.35;
}

.item-content {
  color: #475569;
  margin-bottom: 0;
  line-height: 1.4;
  word-break: break-word;

  &.text-truncate-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.item-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.unread-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background-color: #2563eb;
}

.btn-mark-read {
  border: none;
  background: transparent;
  color: #94a3b8;
  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background-color 0.15s;

  &:hover {
    color: #2563eb;
    background-color: #e2e8f0;
  }
}
</style>

