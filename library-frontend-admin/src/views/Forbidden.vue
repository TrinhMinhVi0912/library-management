<script setup>
const userAppUrl = import.meta.env.VITE_USER_APP_URL;
</script>

<template>
  <main
    id="main-content"
    class="message-page"
  >
    <section
      class="message-card surface-card"
      aria-labelledby="forbidden-title"
    >
      <i
        class="bi bi-shield-lock message-icon"
        aria-hidden="true"
      />
      <p class="error-code">
        403
      </p>
      <h1 id="forbidden-title">
        Không có quyền truy cập
      </h1>
      <p class="text-muted-strong">
        Trang quản trị chỉ dành cho nhân viên và quản trị viên.
      </p>
      <a
        v-if="userAppUrl"
        class="btn btn-primary"
        :href="userAppUrl"
      >Đến website độc giả</a>
      <div
        v-else
        class="d-flex flex-column flex-sm-row justify-content-center gap-2"
      >
        <RouterLink
          class="btn btn-primary"
          :to="{ name: 'admin-login' }"
        >
          Đến đăng nhập quản trị
        </RouterLink>
      </div>
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

.error-code {
  margin: 0 0 0.5rem;
  color: #dc2626;
  font-size: 2rem;
  font-weight: 700;
}
</style>
