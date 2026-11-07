<script setup>
import { computed } from 'vue';

const STATUS_CONFIG = {
  unpaid: {
    label: 'Chưa thanh toán',
    className: 'fine-status-unpaid',
    icon: 'bi-exclamation-circle-fill',
  },
  paid: {
    label: 'Đã thanh toán',
    className: 'fine-status-paid',
    icon: 'bi-check-circle-fill',
  },
  waived: {
    label: 'Đã miễn phạt',
    className: 'fine-status-waived',
    icon: 'bi-slash-circle-fill',
  },
};

const TYPE_CONFIG = {
  late: {
    label: 'Trả trễ',
    className: 'fine-type-late',
    icon: 'bi-hourglass-split',
  },
  damaged: {
    label: 'Hư hỏng sách',
    className: 'fine-type-damaged',
    icon: 'bi-shield-exclamation',
  },
  lost: {
    label: 'Làm mất sách',
    className: 'fine-type-lost',
    icon: 'bi-x-octagon-fill',
  },
  other: {
    label: 'Khác',
    className: 'fine-type-other',
    icon: 'bi-info-circle-fill',
  },
};

const props = defineProps({
  /**
   * Trạng thái khoản phạt: 'unpaid' | 'paid' | 'waived'
   */
  status: {
    type: String,
    default: null,
  },
  /**
   * Loại khoản phạt: 'late' | 'damaged' | 'lost' | 'other'
   */
  type: {
    type: String,
    default: null,
  },
  /**
   * Chế độ hiển thị: 'status' (mặc định nếu có status) hoặc 'type'
   */
  variant: {
    type: String,
    default: 'status',
    validator: (v) => ['status', 'type'].includes(v),
  },
  showIcon: {
    type: Boolean,
    default: true,
  },
});

const config = computed(() => {
  if (props.variant === 'type' || (!props.status && props.type)) {
    return TYPE_CONFIG[props.type] || {
      label: props.type || 'Khác',
      className: 'fine-type-other',
      icon: 'bi-info-circle',
    };
  }

  return STATUS_CONFIG[props.status] || {
    label: props.status || 'Không xác định',
    className: 'fine-status-unpaid',
    icon: 'bi-question-circle',
  };
});
</script>

<template>
  <span
    class="fine-badge"
    :class="config.className"
    :aria-label="`Khoản phạt: ${config.label}`"
  >
    <i
      v-if="props.showIcon && config.icon"
      class="bi me-1"
      :class="config.icon"
      aria-hidden="true"
    />
    <span>{{ config.label }}</span>
  </span>
</template>

<style scoped lang="scss">
.fine-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.35;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  white-space: nowrap;
  letter-spacing: 0.01em;

  i {
    font-size: 0.8em;
  }
}

/* Status variants */
.fine-status-unpaid {
  background-color: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.fine-status-paid {
  background-color: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.fine-status-waived {
  background-color: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}

/* Type variants */
.fine-type-late {
  background-color: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.fine-type-damaged {
  background-color: #ffedd5;
  color: #c2410c;
  border: 1px solid #fdba74;
}

.fine-type-lost {
  background-color: #fdf2f8;
  color: #be185d;
  border: 1px solid #fbcfe8;
}

.fine-type-other {
  background-color: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}
</style>

