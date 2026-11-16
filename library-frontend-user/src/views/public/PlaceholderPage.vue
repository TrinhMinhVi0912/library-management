<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <main class="placeholder-shell">
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
      <div class="placeholder-card">
        <div
          class="placeholder-icon"
          aria-hidden="true"
        >
          <i class="bi bi-water" />
        </div>
        <h1>{{ route.meta.title || 'Trang thư viện' }}</h1>
        <p class="placeholder-description mb-0">
          Khu vực này sẽ được triển khai trong task giao diện tương ứng.
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.placeholder-shell {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  color: #d5e8f1;
}

.placeholder-shell::before {
  position: absolute;
  z-index: -1;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 100vw;
  background: radial-gradient(ellipse at 50% 0%, rgb(13 61 83 / 24%), transparent 42%), #041321;
  content: '';
  transform: translateX(-50%);
}

.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  color: #aac1ce;
  font-size: 0.875rem;
}

.breadcrumb-line a {
  color: #61dce8;
  text-decoration: none;
}

.breadcrumb-line a:hover { color: #a5f3fc; }

.placeholder-card {
  width: min(100%, 46rem);
  margin: 0 auto;
  border: 1px solid rgb(119 177 202 / 18%);
  border-radius: 1rem;
  background: linear-gradient(145deg, #0a2338, #081d31);
  padding: clamp(1.75rem, 5vw, 3rem);
  box-shadow: 0 .75rem 2rem rgb(0 8 20 / 22%);
}

.placeholder-icon {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  margin-bottom: 1.25rem;
  border: 1px solid rgb(91 223 234 / 22%);
  border-radius: 1rem;
  background: #103a50;
  color: #72e5ed;
  font-size: 1.5rem;
}

.placeholder-card h1 { color: #edf7fb; font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 750; }
.placeholder-description { color: #9eb4c3; line-height: 1.7; }
</style>
