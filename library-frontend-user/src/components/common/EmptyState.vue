<script setup>
const props = defineProps({
  title: { type: String, default: 'Chưa có dữ liệu' },
  description: { type: String, default: '' },
  icon: { type: String, default: 'bi-inbox' },
  actionLabel: { type: String, default: '' },
});

const emit = defineEmits(['action']);
</script>

<template>
  <section
    class="empty-state text-center py-5 px-3"
    aria-live="polite"
  >
    <i
      class="empty-state-icon bi"
      :class="icon"
      aria-hidden="true"
    />
    <h2 class="h5 mt-3 mb-2">
      {{ props.title }}
    </h2>
    <p
      v-if="props.description"
      class="text-secondary mb-0"
    >
      {{ props.description }}
    </p>
    <button
      v-if="props.actionLabel"
      class="btn btn-primary mt-3"
      type="button"
      @click="emit('action')"
    >
      {{ props.actionLabel }}
    </button>
  </section>
</template>

<style scoped>
.empty-state-icon {
  color: #6b7280;
  font-size: 2rem;
}
</style>
