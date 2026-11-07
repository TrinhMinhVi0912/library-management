<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  submitText: { type: String, default: 'Lưu' },
  cancelText: { type: String, default: 'Hủy' },
  loading: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value),
  },
});

const emit = defineEmits(['update:modelValue', 'submit', 'cancel']);
const closeButton = ref(null);
const modalId = useId();
const modalSizeClass = computed(() => (props.size === 'md' ? '' : `form-modal-${props.size}`));
let previousFocus = null;

watch(() => props.modelValue, async (isOpen) => {
  if (typeof document === 'undefined') return;
  if (isOpen) {
    previousFocus = document.activeElement;
    document.body.classList.add('modal-open');
    await nextTick();
    closeButton.value?.focus();
  } else {
    document.body.classList.remove('modal-open');
    previousFocus?.focus?.();
    previousFocus = null;
  }
});

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.classList.remove('modal-open');
});

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.modelValue"
      class="modal-backdrop-custom"
      tabindex="-1"
      @click.self="close"
      @keydown.esc.stop.prevent="close"
    >
      <form
        class="form-modal surface-card"
        :class="modalSizeClass"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${modalId}-title`"
        @submit.prevent="emit('submit')"
      >
        <header class="modal-heading">
          <h2
            :id="`${modalId}-title`"
            class="h5 mb-0"
          >
            {{ props.title }}
          </h2>
          <button
            ref="closeButton"
            class="btn-close"
            type="button"
            aria-label="Đóng hộp thoại"
            @click="close"
          />
        </header>
        <div class="modal-body-content">
          <slot />
        </div>
        <footer class="modal-actions">
          <button
            class="btn btn-outline-secondary"
            type="button"
            :disabled="props.loading"
            @click="close"
          >
            {{ props.cancelText }}
          </button>
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="props.loading || props.submitDisabled"
          >
            <span
              v-if="props.loading"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />
            {{ props.submitText }}
          </button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-backdrop-custom {
  position: fixed;
  z-index: 1080;
  inset: 0;
  display: grid;
  overflow-y: auto;
  place-items: center;
  padding: 1rem;
  background: rgb(17 24 39 / 45%);
}

.form-modal {
  width: min(100%, 34rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 1.25rem;
}

.form-modal-sm {
  width: min(100%, 26rem);
}

.form-modal-lg {
  width: min(100%, 52rem);
}

.modal-heading,
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.modal-heading {
  margin-bottom: 1rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 1.25rem;
}
</style>
