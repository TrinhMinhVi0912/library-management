<template>
  <main class="container py-5 forbidden-page">
    <section
      class="forbidden-card"
      aria-labelledby="forbidden-title"
    >
      <i
        class="bi bi-shield-lock forbidden-icon"
        aria-hidden="true"
      />
      <p class="text-danger fw-semibold mb-2">
        403
      </p>
      <h1
        id="forbidden-title"
        class="h3"
      >
        Bạn không có quyền truy cập
      </h1>
      <p class="text-secondary mb-4">
        Tài khoản hiện tại không có quyền xem trang này.
      </p>
      <RouterLink
        class="btn btn-primary"
        :to="{ name: 'home' }"
      >
        Về trang chủ
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.forbidden-page {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  color: #d5e8f1;
}

.forbidden-page::before {
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

.forbidden-card {
  width: min(100%, 36rem);
  margin: 2rem auto;
  border: 1px solid rgb(119 177 202 / 20%);
  border-radius: 1rem;
  background: linear-gradient(145deg, #0a2338, #081d31);
  padding: clamp(1.5rem, 5vw, 2.5rem);
  text-align: center;
  box-shadow: 0 1rem 2.5rem rgb(0 8 20 / 28%);
}

.forbidden-page .text-secondary { color: #9eb4c3 !important; }

.forbidden-page .text-danger {
  color: #ff9b9b !important;
}

.forbidden-icon {
  display: inline-block;
  margin-bottom: 1rem;
  color: #61dce8;
  font-size: 2.5rem;
}

.forbidden-card h1 { color: #edf7fb; }

.forbidden-page :deep(.btn-primary) {
  border-color: #0b91a4;
  background: #0b91a4;
  color: #fff;
}

.forbidden-page :deep(.btn-primary:hover) {
  border-color: #16adbf;
  background: #16adbf;
}
</style>
