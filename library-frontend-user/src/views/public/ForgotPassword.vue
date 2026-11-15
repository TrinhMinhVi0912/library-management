<template>
  <section class="auth-page auth-page--ocean">
    <div class="auth-scene">
      <div class="auth-story">
        <span class="auth-story__eyebrow"><i class="bi bi-water me-2" />An toàn cho tài khoản của bạn</span>
        <h1>Khôi phục lối vào<br>kho sách của bạn.</h1>
        <p>Thư viện hỗ trợ đặt lại mật khẩu trực tiếp để xác minh đúng chủ sở hữu tài khoản.</p>
        <div class="auth-story__hint">
          <i
            class="bi bi-shield-check"
            aria-hidden="true"
          /><span>Mã khôi phục chỉ sử dụng một lần.</span>
        </div>
      </div>
      <div class="auth-card auth-card--ocean">
        <div
          class="auth-brand-mark auth-brand-mark--ocean mb-3"
          aria-hidden="true"
        >
          <i class="bi bi-key" />
        </div>
        <p class="auth-kicker mb-1">
          Khôi phục tài khoản
        </p>
        <h2 class="h2 fw-bold mb-2">
          Quên mật khẩu?
        </h2>
        <p class="auth-description mb-4">
          Để bảo vệ tài khoản, thư viện cấp mã khôi phục trực tiếp sau khi xác minh danh tính.
        </p>
        <div
          class="alert auth-form-note"
          role="note"
        >
          Vui lòng đến quầy thư viện và cung cấp thẻ độc giả hoặc giấy tờ xác minh tài khoản. Nhân viên sẽ tạo mã dùng một lần; sau đó bạn nhập mã tại trang đặt lại mật khẩu. Mã có hiệu lực trong 30 phút.
        </div>
        <RouterLink
          class="btn auth-submit w-100 mt-2"
          :to="{ name: 'reset-password' }"
        >
          Tôi đã có mã khôi phục
        </RouterLink>
        <p class="text-center mt-4 mb-0">
          <RouterLink
            class="auth-link-back"
            :to="{ name: 'login' }"
          >
            <i
              class="bi bi-arrow-left me-1"
              aria-hidden="true"
            />Quay lại đăng nhập
          </RouterLink>
        </p>
      </div>
    </div>
  </section>
</template>
