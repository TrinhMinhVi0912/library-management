<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  icon: { type: String, default: 'bi-bar-chart' },
  description: { type: String, default: '' },
});
</script>

<template>
  <article class="surface-card stat-card">
    <div class="stat-copy">
      <p class="stat-label">
        {{ label }}
      </p>
      <strong class="stat-value">{{ value }}</strong>
      <span
        v-if="description"
        class="stat-description"
      >{{ description }}</span>
    </div>
    <span
      class="stat-icon"
      aria-hidden="true"
    ><i
      class="bi"
      :class="icon"
    /></span>
  </article>
</template>

<style scoped lang="scss">
.stat-card {
  display: flex;
  min-height: 132px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem;
}

.stat-copy {
  display: grid;
  gap: 0.3rem;
}

.stat-label,
.stat-description {
  margin: 0;
  color: #6b7280;
  font-size: 0.825rem;
}

.stat-value {
  font-size: 1.7rem;
  line-height: 1.25;
}

.stat-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: #f8f9fa;
  color: #2563eb;
}
</style>
