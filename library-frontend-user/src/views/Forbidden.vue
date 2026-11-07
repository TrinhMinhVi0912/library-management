<template>
  <main class="container py-5">
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
.forbidden-card {
  width: min(100%, 36rem);
  margin: 2rem auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: clamp(1.5rem, 5vw, 2.5rem);
  text-align: center;
}

.forbidden-icon {
  display: inline-block;
  margin-bottom: 1rem;
  color: #dc2626;
  font-size: 2rem;
}
</style>
