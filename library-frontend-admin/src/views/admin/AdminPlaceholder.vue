<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <section>
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span>
      <i
        class="bi bi-chevron-right"
        aria-hidden="true"
      />
      <span aria-current="page">{{ route.meta.title }}</span>
    </nav>
    <div class="surface-card placeholder-panel">
      <p class="mb-0 text-muted-strong">
        Khu vực này sẽ được triển khai trong task giao diện tương ứng.
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.placeholder-panel {
  padding: 1.25rem;
}

.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #6b7280;
  font-size: 0.825rem;
}
</style>
