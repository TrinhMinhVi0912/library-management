<template>
  <section class="container py-5 text-center">
    <p class="text-danger fw-semibold mb-2">
      403
    </p>
    <h1 class="h3">
      Bạn không có quyền truy cập
    </h1>
    <p class="text-secondary">
      Tài khoản hiện tại không có quyền xem trang này.
    </p>
    <RouterLink
      class="btn btn-primary mt-2"
      :to="{ name: 'home' }"
    >
      Về trang chủ
    </RouterLink>
  </section>
</template>
