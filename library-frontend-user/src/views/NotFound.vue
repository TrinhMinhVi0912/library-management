<template>
  <section class="container py-5 text-center">
    <p class="text-primary fw-semibold mb-2">
      404
    </p>
    <h1 class="h3">
      Không tìm thấy trang
    </h1>
    <p class="text-secondary">
      Địa chỉ này không tồn tại hoặc đã được thay đổi.
    </p>
    <RouterLink
      class="btn btn-primary mt-2"
      :to="{ name: 'home' }"
    >
      Về trang chủ
    </RouterLink>
  </section>
</template>
