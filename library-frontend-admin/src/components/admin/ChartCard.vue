<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  empty: { type: Boolean, default: false },
});
</script>

<template>
  <section class="surface-card chart-card">
    <header class="chart-heading">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="description">
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div class="chart-body">
      <div
        v-if="loading"
        class="chart-state"
        role="status"
      >
        Đang tải biểu đồ...
      </div>
      <div
        v-else-if="empty"
        class="chart-state text-muted-strong"
      >
        Chưa có dữ liệu trong khoảng thời gian này.
      </div>
      <slot v-else />
    </div>
  </section>
</template>

<style scoped lang="scss">
.chart-card {
  min-width: 0;
  padding: 1rem;
}

.chart-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

p {
  margin: 0.3rem 0 0;
  color: #6b7280;
  font-size: 0.825rem;
}

.chart-body {
  min-height: 220px;
}

.chart-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  text-align: center;
}
</style>
