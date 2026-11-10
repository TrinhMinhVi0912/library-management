<template>
  <section class="auth-page">
    <div class="auth-card">
      <div
        class="auth-brand-mark mb-4"
        aria-hidden="true"
      >
        <i class="bi bi-key" />
      </div>
      <p class="text-uppercase text-secondary small fw-semibold mb-2">
        Khôi phục tài khoản
      </p>
      <h1 class="h2 fw-bold mb-2">
        Quên mật khẩu?
      </h1>
      <p class="text-secondary mb-4">
        Để bảo vệ tài khoản, thư viện cấp mã khôi phục trực tiếp sau khi xác minh danh tính.
      </p>
      <div
        class="alert alert-info"
        role="note"
      >
        Vui lòng đến quầy thư viện và cung cấp thẻ độc giả hoặc giấy tờ xác minh tài khoản. Nhân viên sẽ tạo mã dùng một lần; sau đó bạn nhập mã tại trang đặt lại mật khẩu. Mã có hiệu lực trong 30 phút.
      </div>
      <RouterLink
        class="btn btn-primary w-100 mt-2"
        :to="{ name: 'reset-password' }"
      >
        Tôi đã có mã khôi phục
      </RouterLink>
      <p class="text-center mt-4 mb-0">
        <RouterLink :to="{ name: 'login' }">
          <i
            class="bi bi-arrow-left me-1"
            aria-hidden="true"
          />Quay lại đăng nhập
        </RouterLink>
      </p>
    </div>
  </section>
</template>
