<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Xác nhận thao tác' },
  message: { type: String, default: 'Bạn có chắc muốn tiếp tục?' },
  confirmText: { type: String, default: 'Xác nhận' },
  cancelText: { type: String, default: 'Hủy' },
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'danger'].includes(value),
  },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);
const cancelButton = ref(null);
const modalId = useId();
let previousFocus = null;

watch(() => props.modelValue, async (isOpen) => {
  if (typeof document === 'undefined') return;
  if (isOpen) {
    previousFocus = document.activeElement;
    document.body.classList.add('modal-open');
    await nextTick();
    cancelButton.value?.focus();
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
      <section
        class="confirm-modal surface-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${modalId}-title`"
        :aria-describedby="`${modalId}-message`"
      >
        <header class="modal-heading">
          <h2
            :id="`${modalId}-title`"
            class="h5 mb-0"
          >
            {{ props.title }}
          </h2>
          <button
            class="btn-close"
            type="button"
            aria-label="Đóng hộp thoại"
            @click="close"
          />
        </header>
        <p
          :id="`${modalId}-message`"
          class="mb-4"
        >
          {{ props.message }}
        </p>
        <slot />
        <footer class="modal-actions">
          <button
            ref="cancelButton"
            class="btn btn-outline-secondary"
            type="button"
            :disabled="props.loading"
            @click="close"
          >
            {{ props.cancelText }}
          </button>
          <button
            class="btn"
            :class="props.variant === 'danger' ? 'btn-danger' : 'btn-primary'"
            type="button"
            :disabled="props.loading"
            @click="emit('confirm')"
          >
            <span
              v-if="props.loading"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />
            {{ props.confirmText }}
          </button>
        </footer>
      </section>
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

.confirm-modal {
  width: min(100%, 28rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 1.25rem;
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
}
</style>
