<script setup>
import { formatMoney } from '@/utils/format';

const defaultPolicy = {
  maxBooksPerLoan: 5,
  loanDays: 14,
  maxRenewals: 2,
  renewDays: 7,
  lateFeePerDay: 2000,
  lostBookFeeRate: 1,
  lostBookProcessingFee: 20000,
  reservationHoldDays: 3,
};
</script>

<template>
  <main class="container py-4 about-page">
    <nav aria-label="Đường dẫn">
      <ol class="breadcrumb mb-3">
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'home' }">
            Trang chủ
          </RouterLink>
        </li>
        <li
          class="breadcrumb-item active"
          aria-current="page"
        >
          Giới thiệu
        </li>
      </ol>
    </nav>

    <header class="about-heading mb-4">
      <p class="text-uppercase text-secondary small fw-semibold mb-2">
        Thư viện trực tuyến
      </p>
      <h1 class="h2 fw-bold mb-2">
        Đọc sách, mở rộng tri thức
      </h1>
      <p class="text-secondary mb-0">
        Tra cứu bộ sưu tập, tham gia cộng đồng và gửi yêu cầu mượn sách trực tuyến.
      </p>
    </header>

    <div class="row g-3">
      <div class="col-12 col-lg-5">
        <section
          class="about-card h-100"
          aria-labelledby="about-hours-heading"
        >
          <h2
            id="about-hours-heading"
            class="h5 mb-3"
          >
            <i
              class="bi bi-clock me-2 text-primary"
              aria-hidden="true"
            />Giờ phục vụ
          </h2>
          <p class="mb-2">
            <strong>Thứ Hai đến Thứ Bảy</strong>
          </p>
          <p class="text-secondary mb-0">
            07:00 – 21:00
          </p>
          <p class="small text-secondary mt-3 mb-0">
            Khung giờ phục vụ đã công bố cho Thứ Hai đến Thứ Bảy.
          </p>
        </section>
      </div>

      <div class="col-12 col-lg-7">
        <section
          class="about-card h-100"
          aria-labelledby="about-loan-heading"
        >
          <h2
            id="about-loan-heading"
            class="h5 mb-3"
          >
            <i
              class="bi bi-journal-bookmark me-2 text-primary"
              aria-hidden="true"
            />Chính sách mượn
          </h2>
          <ul class="about-policy-list mb-0">
            <li>Mỗi yêu cầu mượn tối đa {{ defaultPolicy.maxBooksPerLoan }} cuốn.</li>
            <li>Thời hạn mượn mặc định {{ defaultPolicy.loanDays }} ngày.</li>
            <li>Có thể yêu cầu gia hạn tối đa {{ defaultPolicy.maxRenewals }} lần, mỗi lần thêm {{ defaultPolicy.renewDays }} ngày; yêu cầu cần được duyệt.</li>
            <li>Khi hết bản có thể mượn, độc giả có thể tham gia hàng chờ đặt trước; bản giữ cho người đến lượt trong {{ defaultPolicy.reservationHoldDays }} ngày.</li>
          </ul>
        </section>
      </div>

      <div class="col-12">
        <section
          class="about-card"
          aria-labelledby="about-fines-heading"
        >
          <h2
            id="about-fines-heading"
            class="h5 mb-3"
          >
            <i
              class="bi bi-cash-coin me-2 text-primary"
              aria-hidden="true"
            />Phí trễ hạn và sách mất
          </h2>
          <ul class="about-policy-list mb-3">
            <li>Trễ hạn: {{ formatMoney(defaultPolicy.lateFeePerDay) }} mỗi ngày.</li>
            <li>Mất sách: 100% giá sách cộng {{ formatMoney(defaultPolicy.lostBookProcessingFee) }} phí xử lý.</li>
          </ul>
          <p
            class="about-policy-note mb-0"
            role="note"
          >
            Đây là mức mặc định của hệ thống; quản trị viên có thể điều chỉnh chính sách. Tiền phạt được thanh toán tại quầy, hệ thống không thu tiền trực tuyến.
          </p>
        </section>
      </div>
    </div>

    <section
      class="about-contact mt-4"
      aria-labelledby="about-contact-heading"
    >
      <h2
        id="about-contact-heading"
        class="h5 mb-2"
      >
        Cần hỗ trợ?
      </h2>
      <p class="text-secondary mb-3">
        Nhân viên thư viện sẵn sàng hỗ trợ tại quầy trong giờ phục vụ.
      </p>
      <RouterLink
        class="btn btn-primary"
        :to="{ name: 'books' }"
      >
        Khám phá danh mục sách
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.about-heading {
  max-width: 48rem;
}

.about-card,
.about-contact {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 1.25rem;
}

.about-policy-list {
  display: grid;
  gap: 0.65rem;
  padding-left: 1.2rem;
}

.about-policy-note {
  border-left: 3px solid #2563eb;
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  color: #374151;
}
</style>
