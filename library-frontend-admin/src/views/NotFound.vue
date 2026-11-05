<template>
  <main class="message-page">
    <section class="message-card surface-card">
      <p class="error-code">
        404
      </p>
      <h1>Không tìm thấy trang</h1>
      <p class="text-muted-strong">
        Đường dẫn có thể đã thay đổi hoặc không tồn tại.
      </p>
      <RouterLink
        class="btn btn-primary"
        to="/admin"
      >
        Về trang quản trị
      </RouterLink>
    </section>
  </main>
</template>

<style scoped lang="scss">
.message-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 1rem;
  background: #f8f9fa;
}

.message-card {
  width: min(100%, 480px);
  padding: 2rem;
  text-align: center;
}

.error-code {
  margin: 0;
  color: #2563eb;
  font-size: 3rem;
  font-weight: 700;
}

h1 {
  margin: 0 0 0.65rem;
  font-size: 1.4rem;
}
</style>
