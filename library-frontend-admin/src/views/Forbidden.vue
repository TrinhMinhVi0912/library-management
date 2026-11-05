<script setup>
const userAppUrl = import.meta.env.VITE_USER_APP_URL;
</script>

<template>
  <main class="message-page">
    <section class="message-card surface-card">
      <i
        class="bi bi-shield-lock message-icon"
        aria-hidden="true"
      />
      <h1>Không có quyền truy cập</h1>
      <p class="text-muted-strong">
        Trang quản trị chỉ dành cho nhân viên và quản trị viên.
      </p>
      <a
        v-if="userAppUrl"
        class="btn btn-primary"
        :href="userAppUrl"
      >Đến website độc giả</a>
      <RouterLink
        v-else
        class="btn btn-outline-primary"
        :to="{ name: 'admin-login' }"
      >
        Quay lại đăng nhập
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

.message-icon {
  display: inline-block;
  margin-bottom: 1rem;
  color: #dc2626;
  font-size: 2rem;
}

h1 {
  margin: 0 0 0.65rem;
  font-size: 1.4rem;
}
</style>
