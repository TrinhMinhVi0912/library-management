<template>
  <button
    type="button"
    class="btn btn-like d-inline-flex align-items-center transition-all"
    :class="[
      buttonSizeClass,
      liked ? 'btn-like-active border-danger-subtle' : 'btn-outline-secondary border-light-subtle text-muted',
      { 'opacity-75': loading }
    ]"
    :disabled="disabled || loading"
    :aria-pressed="liked"
    :title="liked ? 'Bỏ thích' : 'Thích bài viết'"
    @click="$emit('toggle')"
  >
    <i
      class="bi fs-6 transition-transform"
      :class="[
        liked ? 'bi-heart-fill text-danger scale-up' : 'bi-heart',
        loading ? 'spinner-border spinner-border-sm' : ''
      ]"
      aria-hidden="true"
    />
    <span class="fw-semibold">{{ count }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  liked: {
    type: Boolean,
    default: false,
  },
  count: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String,
    default: 'md', // 'sm' | 'md'
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggle']);

const buttonSizeClass = computed(() => {
  return props.size === 'sm' ? 'btn-sm py-1 px-2.5 fs-7' : 'py-1.5 px-3 fs-6';
});
</script>

<style scoped>
.btn-like {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  background-color: #ffffff;
  transition: all 0.2s ease-in-out;
}

.btn-like.btn-sm {
  padding: 0.25rem 0.55rem;
  font-size: 0.8125rem;
}

.btn-like:hover:not(:disabled) {
  background-color: #fef2f2;
  border-color: #fecaca;
  color: #dc2626 !important;
}

.btn-like-active {
  background-color: #fff1f2;
  color: #e11d48 !important;
  border-color: #fecdd3 !important;
}

.scale-up {
  animation: pulse-heart 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pulse-heart {
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

.fs-7 {
  font-size: 0.8125rem;
}
</style>

