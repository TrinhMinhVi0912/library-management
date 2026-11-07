<script setup>
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="public-footer">
    <div class="container-xl py-4">
      <div class="row g-4">
        <section
          class="col-12 col-md-5"
          aria-labelledby="footer-library-title"
        >
          <h2
            id="footer-library-title"
            class="footer-heading"
          >
            Thư viện trực tuyến
          </h2>
          <p class="footer-copy mb-0">
            Tra cứu sách và theo dõi hoạt động mượn trả của bạn.
          </p>
        </section>
        <section
          class="col-6 col-md-3"
          aria-labelledby="footer-hours-title"
        >
          <h2
            id="footer-hours-title"
            class="footer-heading"
          >
            Giờ phục vụ
          </h2>
          <p class="footer-copy mb-0">
            Thông tin đang được cập nhật.
          </p>
        </section>
        <section
          class="col-6 col-md-4"
          aria-labelledby="footer-contact-title"
        >
          <h2
            id="footer-contact-title"
            class="footer-heading"
          >
            Liên hệ
          </h2>
          <p class="footer-copy mb-0">
            Thông tin liên hệ sẽ được cập nhật.
          </p>
        </section>
      </div>
      <div class="footer-bottom">
        <span>© {{ currentYear }} Thư viện trực tuyến</span>
        <nav
          class="footer-links"
          aria-label="Liên kết nhanh"
        >
          <RouterLink :to="{ name: 'home' }">
            Trang chủ
          </RouterLink>
          <RouterLink :to="{ name: 'books' }">
            Danh mục sách
          </RouterLink>
          <RouterLink :to="{ name: 'forum' }">
            Diễn đàn
          </RouterLink>
        </nav>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.public-footer {
  margin-top: auto;
  border-top: 1px solid #e5e7eb;
  background: #f8f9fa;
}

.footer-heading {
  margin: 0 0 0.65rem;
  color: #111827;
  font-size: 0.95rem;
  font-weight: 650;
}

.footer-copy {
  color: #6b7280;
  font-size: 0.875rem;
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.8rem;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-links a {
  color: #4b5563;
  text-decoration: none;
}

.footer-links a:hover {
  color: #1d4ed8;
}

@media (max-width: 575.98px) {
  .footer-bottom {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
