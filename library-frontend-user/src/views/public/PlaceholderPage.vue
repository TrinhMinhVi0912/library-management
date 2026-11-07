<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <section class="container py-5 placeholder-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <RouterLink :to="{ name: 'home' }">
        Trang chủ
      </RouterLink>
      <i
        class="bi bi-chevron-right"
        aria-hidden="true"
      />
      <span aria-current="page">{{ route.meta.title || 'Trang' }}</span>
    </nav>
    <h1>{{ route.meta.title || 'Trang thư viện' }}</h1>
    <p class="text-secondary mb-0">
      Khu vực này sẽ được triển khai trong task giao diện tương ứng.
    </p>
  </section>
</template>

<style scoped>
.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.breadcrumb-line a {
  color: #2563eb;
  text-decoration: none;
}
</style>
