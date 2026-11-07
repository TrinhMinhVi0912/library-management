<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '@/components/common/EmptyState.vue';
import Pagination from '@/components/common/Pagination.vue';
import FineBadge from '@/components/loan/FineBadge.vue';
import fineService from '@/services/fine.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate, formatMoney } from '@/utils/format';

const authStore = useAuthStore();

const fines = ref([]);
const meta = ref({ page: 1, limit: 10, total: 0, totalPages: 1 });
const loading = ref(false);
const error = ref(null);
const currentStatus = ref('all'); // 'all' | 'unpaid' | 'paid' | 'waived'
const currentPage = ref(1);

// Thống kê tổng hợp
const allFinesSummary = ref({
  unpaidTotal: 0,
  unpaidCount: 0,
  paidTotal: 0,
  paidCount: 0,
  waivedCount: 0,
});

const statusTabs = computed(() => [
  { key: 'all', label: 'Tất cả', count: meta.value.total },
  { key: 'unpaid', label: 'Chưa thanh toán', count: allFinesSummary.value.unpaidCount, badgeClass: 'bg-danger' },
  { key: 'paid', label: 'Đã thanh toán', count: allFinesSummary.value.paidCount, badgeClass: 'bg-success' },
  { key: 'waived', label: 'Đã miễn phạt', count: allFinesSummary.value.waivedCount, badgeClass: 'bg-secondary' },
]);

const hasUnpaidFines = computed(() => {
  return Number(authStore.user?.unpaidFineTotal || 0) > 0 || allFinesSummary.value.unpaidTotal > 0;
});

const effectiveUnpaidTotal = computed(() => {
  const storeTotal = Number(authStore.user?.unpaidFineTotal || 0);
  return Math.max(storeTotal, allFinesSummary.value.unpaidTotal);
});

async function fetchFines() {
  loading.value = true;
  error.value = null;

  try {
    const params = {
      page: currentPage.value,
      limit: meta.value.limit,
      sort: '-createdAt',
    };
    if (currentStatus.value !== 'all') {
      params.status = currentStatus.value;
    }

    const response = await fineService.getMyFines(params);
    fines.value = response.items || [];
    meta.value = response.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Không thể tải danh sách khoản phạt. Vui lòng thử lại sau.';
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  try {
    // Tải tổng quan tất cả khoản phạt để tính thống kê và tab badges
    const res = await fineService.getMyFines({ limit: 1000 });
    const items = res.items || [];

    let unpaidSum = 0;
    let unpaidC = 0;
    let paidSum = 0;
    let paidC = 0;
    let waivedC = 0;

    for (const item of items) {
      if (item.status === 'unpaid') {
        unpaidSum += item.amount || 0;
        unpaidC += 1;
      } else if (item.status === 'paid') {
        paidSum += item.amount || 0;
        paidC += 1;
      } else if (item.status === 'waived') {
        waivedC += 1;
      }
    }

    allFinesSummary.value = {
      unpaidTotal: unpaidSum,
      unpaidCount: unpaidC,
      paidTotal: paidSum,
      paidCount: paidC,
      waivedCount: waivedC,
    };

    // Đồng bộ lại thông tin user trong store để cập nhật unpaidFineTotal
    if (authStore.fetchMe) {
      await authStore.fetchMe().catch(() => {});
    }
  } catch {
    // Không chặn màn hình chính nếu tổng quan lỗi
  }
}

function handleTabChange(tabKey) {
  if (currentStatus.value === tabKey) return;
  currentStatus.value = tabKey;
  currentPage.value = 1;
  fetchFines();
}

function handlePageChange(newPage) {
  currentPage.value = newPage;
  fetchFines();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function refreshAll() {
  await Promise.all([fetchFines(), loadSummary()]);
}

watch(currentPage, () => {
  fetchFines();
});

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <div class="my-fines-view container-xl py-4">
    <!-- Header -->
    <header class="page-header mb-4">
      <nav
        aria-label="Đường dẫn trang"
        class="breadcrumb-nav mb-2"
      >
        <ol class="breadcrumb mb-0">
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'home' }">
              Trang chủ
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Phạt của tôi
          </li>
        </ol>
      </nav>
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div>
          <h1 class="h3 page-title mb-1">
            Phạt của tôi
          </h1>
          <p class="text-secondary mb-0">
            Theo dõi các khoản tiền phạt phát sinh từ việc trả sách trễ hạn, hư hỏng hoặc làm mất sách.
          </p>
        </div>
        <button
          class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
          type="button"
          :disabled="loading"
          @click="refreshAll"
        >
          <i
            class="bi bi-arrow-clockwise"
            :class="{ 'spin-icon': loading }"
            aria-hidden="true"
          />
          <span>Làm mới</span>
        </button>
      </div>
    </header>

    <!-- Lưu ý quan trọng về phương thức thanh toán -->
    <div
      class="alert alert-info d-flex align-items-start gap-3 shadow-sm mb-4"
      role="region"
      aria-label="Hướng dẫn thanh toán phạt"
    >
      <i
        class="bi bi-info-circle-fill fs-4 text-info flex-shrink-0 mt-1"
        aria-hidden="true"
      />
      <div>
        <h2 class="h6 alert-heading fw-bold mb-1">
          Quy định thanh toán tiền phạt
        </h2>
        <p class="mb-1 text-dark">
          Hiện tại Thư viện <strong>chỉ thu tiền phạt trực tiếp tại quầy thủ thư</strong>, không áp dụng thanh toán online.
          Vui lòng đến quầy dịch vụ trong giờ làm việc để nộp phạt. Sau khi hoàn tất, thủ thư sẽ cập nhật biên nhận và xác nhận gạch nợ trên hệ thống.
        </p>
        <small class="text-muted">
          Giờ mở cửa phục vụ: <strong>07:30 - 17:00</strong> từ Thứ Hai đến Thứ Bảy.
        </small>
      </div>
    </div>

    <!-- Cảnh báo khóa mượn khi còn nợ -->
    <div
      v-if="hasUnpaidFines"
      class="alert alert-danger d-flex align-items-start gap-3 shadow-sm mb-4"
      role="alert"
    >
      <i
        class="bi bi-shield-lock-fill fs-3 text-danger flex-shrink-0 mt-1"
        aria-hidden="true"
      />
      <div class="flex-grow-1">
        <h2 class="h6 alert-heading fw-bold mb-1 text-danger">
          Tài khoản đang bị tạm khóa quyền mượn sách
        </h2>
        <p class="mb-2">
          Bạn đang có <strong>{{ allFinesSummary.unpaidCount }}</strong> khoản phạt chưa thanh toán với tổng số tiền nợ là
          <strong class="text-danger fs-5">{{ formatMoney(effectiveUnpaidTotal) }}</strong>.
          Theo quy chế thư viện, tài khoản có tiền phạt chưa nộp sẽ không thể tạo thêm yêu cầu mượn sách mới.
        </p>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <RouterLink
            :to="{ name: 'cart' }"
            class="btn btn-outline-danger btn-sm"
          >
            <i
              class="bi bi-basket3 me-1"
              aria-hidden="true"
            />
            Kiểm tra giỏ mượn
          </RouterLink>
          <span class="text-muted small">Vui lòng nộp phạt tại quầy để hệ thống tự động mở lại quyền mượn sách.</span>
        </div>
      </div>
    </div>

    <!-- Thống kê tổng nợ & trạng thái -->
    <div class="row g-3 mb-4">
      <div class="col-12 col-sm-6 col-lg-3">
        <div
          class="stat-card p-3 rounded-3 border bg-white shadow-sm h-100"
          :class="{ 'border-danger-subtle bg-danger-subtle-hover': effectiveUnpaidTotal > 0 }"
        >
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="stat-label text-secondary small fw-semibold">Tổng nợ chưa nộp</span>
            <span
              class="stat-icon-wrapper rounded-circle d-inline-flex align-items-center justify-content-center"
              :class="effectiveUnpaidTotal > 0 ? 'bg-danger text-white' : 'bg-light text-muted'"
            >
              <i
                class="bi bi-exclamation-triangle"
                aria-hidden="true"
              />
            </span>
          </div>
          <div
            class="stat-value fw-bold h4 mb-1"
            :class="effectiveUnpaidTotal > 0 ? 'text-danger' : 'text-dark'"
          >
            {{ formatMoney(effectiveUnpaidTotal) }}
          </div>
          <div class="stat-desc small text-muted">
            <span
              v-if="allFinesSummary.unpaidCount > 0"
              class="badge bg-danger-subtle text-danger"
            >
              {{ allFinesSummary.unpaidCount }} khoản chưa nộp
            </span>
            <span
              v-else
              class="text-success"
            >
              <i class="bi bi-check-circle me-1" />Không còn nợ
            </span>
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-lg-3">
        <div class="stat-card p-3 rounded-3 border bg-white shadow-sm h-100">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="stat-label text-secondary small fw-semibold">Khoản phạt chưa nộp</span>
            <span class="stat-icon-wrapper rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-warning">
              <i
                class="bi bi-clock-history"
                aria-hidden="true"
              />
            </span>
          </div>
          <div class="stat-value fw-bold h4 mb-1 text-dark">
            {{ allFinesSummary.unpaidCount }}
          </div>
          <div class="stat-desc small text-muted">
            Cần thanh toán tại quầy
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-lg-3">
        <div class="stat-card p-3 rounded-3 border bg-white shadow-sm h-100">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="stat-label text-secondary small fw-semibold">Tiền phạt đã nộp</span>
            <span class="stat-icon-wrapper rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-success">
              <i
                class="bi bi-check-circle"
                aria-hidden="true"
              />
            </span>
          </div>
          <div class="stat-value fw-bold h4 mb-1 text-success">
            {{ formatMoney(allFinesSummary.paidTotal) }}
          </div>
          <div class="stat-desc small text-muted">
            {{ allFinesSummary.paidCount }} khoản đã thanh toán
          </div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-lg-3">
        <div class="stat-card p-3 rounded-3 border bg-white shadow-sm h-100">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="stat-label text-secondary small fw-semibold">Khoản được miễn</span>
            <span class="stat-icon-wrapper rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-secondary">
              <i
                class="bi bi-slash-circle"
                aria-hidden="true"
              />
            </span>
          </div>
          <div class="stat-value fw-bold h4 mb-1 text-secondary">
            {{ allFinesSummary.waivedCount }}
          </div>
          <div class="stat-desc small text-muted">
            Được thủ thư/admin miễn phạt
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs lọc trạng thái -->
    <div class="card border shadow-sm">
      <div class="card-header bg-white border-bottom p-0">
        <ul
          class="nav nav-tabs card-header-tabs m-0 px-3 pt-2"
          role="tablist"
        >
          <li
            v-for="tab in statusTabs"
            :key="tab.key"
            class="nav-item"
            role="presentation"
          >
            <button
              class="nav-link"
              :class="{ active: currentStatus === tab.key }"
              type="button"
              role="tab"
              :aria-selected="currentStatus === tab.key"
              @click="handleTabChange(tab.key)"
            >
              <span>{{ tab.label }}</span>
              <span
                v-if="tab.count > 0"
                class="badge rounded-pill ms-2"
                :class="tab.badgeClass || 'bg-secondary'"
              >
                {{ tab.count }}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Danh sách bảng phạt -->
      <div class="card-body p-0">
        <!-- Đang tải -->
        <div
          v-if="loading"
          class="p-5 text-center"
          aria-live="polite"
        >
          <div
            class="spinner-border text-primary"
            role="status"
          >
            <span class="visually-hidden">Đang tải dữ liệu...</span>
          </div>
          <p class="text-secondary mt-2 mb-0">
            Đang tải danh sách khoản phạt...
          </p>
        </div>

        <!-- Có lỗi -->
        <div
          v-else-if="error"
          class="p-5 text-center text-danger"
          role="alert"
        >
          <i
            class="bi bi-exclamation-triangle fs-1 d-block mb-2"
            aria-hidden="true"
          />
          <h2 class="h5 mb-2">
            Đã có lỗi xảy ra
          </h2>
          <p class="mb-3 text-secondary">
            {{ error }}
          </p>
          <button
            class="btn btn-outline-primary btn-sm"
            type="button"
            @click="fetchFines"
          >
            <i class="bi bi-arrow-repeat me-1" />Thử lại
          </button>
        </div>

        <!-- Danh sách rỗng -->
        <div
          v-else-if="fines.length === 0"
          class="py-4"
        >
          <template v-if="currentStatus === 'all'">
            <EmptyState
              icon="bi-emoji-smile"
              title="Bạn không có khoản phạt nào"
              description="Tuyệt vời! Bạn luôn mượn và trả sách đúng thời hạn quy định của thư viện."
              action-label="Khám phá sách"
              @action="$router.push({ name: 'books' })"
            />
          </template>
          <template v-else-if="currentStatus === 'unpaid'">
            <EmptyState
              icon="bi-check2-circle text-success"
              title="Không có khoản phạt chưa thanh toán"
              description="Tất cả các khoản phạt trước đó (nếu có) đã được thanh toán hoặc miễn trừ hoàn toàn."
            />
          </template>
          <template v-else>
            <EmptyState
              icon="bi-inbox"
              title="Không có khoản phạt nào ở mục này"
              description="Hiện chưa có dữ liệu khoản phạt tương ứng với bộ lọc đã chọn."
            />
          </template>
        </div>

        <!-- Bảng danh sách trên màn hình Desktop -->
        <div
          v-else
          class="table-responsive d-none d-md-block"
        >
          <table
            class="table table-hover align-middle mb-0"
            aria-label="Danh sách khoản phạt"
          >
            <thead class="table-light">
              <tr>
                <th
                  scope="col"
                  style="width: 140px;"
                >
                  Mã phiếu / Ngày
                </th>
                <th scope="col">
                  Sách liên quan
                </th>
                <th
                  scope="col"
                  style="width: 130px;"
                >
                  Loại phạt
                </th>
                <th scope="col">
                  Lý do / Số ngày trễ
                </th>
                <th
                  scope="col"
                  class="text-end"
                  style="width: 130px;"
                >
                  Số tiền
                </th>
                <th
                  scope="col"
                  class="text-center"
                  style="width: 150px;"
                >
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="fine in fines"
                :key="fine._id"
                :class="{ 'table-danger-subtle': fine.status === 'unpaid' }"
              >
                <!-- Mã phiếu & Ngày -->
                <td>
                  <div class="fw-semibold text-primary">
                    <RouterLink
                      v-if="fine.loan?.code"
                      :to="{ name: 'my-loans' }"
                      class="text-decoration-none"
                      title="Xem lịch sử mượn"
                    >
                      #{{ fine.loan.code }}
                    </RouterLink>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </div>
                  <div class="small text-secondary">
                    {{ formatDate(fine.createdAt, 'DD/MM/YYYY') }}
                  </div>
                </td>

                <!-- Sách liên quan -->
                <td>
                  <div
                    v-if="fine.book?.title"
                    class="d-flex align-items-center gap-2"
                  >
                    <div>
                      <div class="fw-medium text-dark line-clamp-1">
                        {{ fine.book.title }}
                      </div>
                      <div
                        v-if="fine.book.code"
                        class="small text-muted"
                      >
                        Mã sách: {{ fine.book.code }}
                      </div>
                    </div>
                  </div>
                  <span
                    v-else
                    class="text-muted"
                  >Phạt chung / ngoài lượt</span>
                </td>

                <!-- Loại phạt -->
                <td>
                  <FineBadge
                    :type="fine.type"
                    variant="type"
                  />
                </td>

                <!-- Lý do / Số ngày trễ -->
                <td>
                  <div>
                    <span
                      v-if="fine.type === 'late' && fine.daysLate > 0"
                      class="badge bg-warning-subtle text-warning-emphasis me-1"
                    >
                      Trễ {{ fine.daysLate }} ngày
                    </span>
                    <span class="text-body">{{ fine.reason || 'Không có lý do chi tiết' }}</span>
                  </div>
                  <!-- Thông tin thanh toán / miễn phạt -->
                  <div
                    v-if="fine.status === 'paid' && fine.paidAt"
                    class="small text-success mt-1"
                  >
                    <i class="bi bi-check2 me-1" />Đã nộp ngày: {{ formatDate(fine.paidAt) }}
                  </div>
                  <div
                    v-else-if="fine.status === 'waived'"
                    class="small text-muted mt-1"
                  >
                    <i class="bi bi-info-circle me-1" />
                    Miễn phạt: {{ fine.waivedReason || 'Theo quyết định thư viện' }}
                    <span v-if="fine.waivedAt">({{ formatDate(fine.waivedAt, 'DD/MM/YYYY') }})</span>
                  </div>
                </td>

                <!-- Số tiền -->
                <td class="text-end">
                  <span
                    class="fw-bold"
                    :class="fine.status === 'unpaid' ? 'text-danger fs-6' : 'text-dark'"
                  >
                    {{ formatMoney(fine.amount) }}
                  </span>
                </td>

                <!-- Trạng thái -->
                <td class="text-center">
                  <FineBadge :status="fine.status" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Danh sách dạng Card trên màn hình Mobile -->
        <div
          v-if="fines.length > 0"
          class="d-md-none p-3 fine-cards-list"
        >
          <div
            v-for="fine in fines"
            :key="fine._id"
            class="fine-card p-3 mb-3 rounded-3 border bg-white shadow-sm"
            :class="{ 'border-danger-subtle bg-danger-subtle-hover': fine.status === 'unpaid' }"
          >
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="small text-muted">{{ formatDate(fine.createdAt, 'DD/MM/YYYY HH:mm') }}</span>
              <FineBadge :status="fine.status" />
            </div>

            <div class="d-flex align-items-center justify-content-between mb-2">
              <FineBadge
                :type="fine.type"
                variant="type"
              />
              <span
                class="fw-bold fs-6"
                :class="fine.status === 'unpaid' ? 'text-danger' : 'text-dark'"
              >
                {{ formatMoney(fine.amount) }}
              </span>
            </div>

            <div
              v-if="fine.book?.title"
              class="book-info mb-2 p-2 rounded bg-light"
            >
              <div class="fw-medium text-dark line-clamp-2">
                {{ fine.book.title }}
              </div>
              <div
                v-if="fine.book.code"
                class="small text-muted"
              >
                Mã: {{ fine.book.code }}
              </div>
            </div>

            <div class="fine-reason small text-secondary mb-2">
              <span
                v-if="fine.type === 'late' && fine.daysLate > 0"
                class="badge bg-warning-subtle text-warning-emphasis me-1"
              >
                Trễ {{ fine.daysLate }} ngày
              </span>
              <span>{{ fine.reason || 'Không có lý do chi tiết' }}</span>
            </div>

            <div
              v-if="fine.loan?.code"
              class="small text-muted mb-1"
            >
              Phiếu mượn:
              <RouterLink
                :to="{ name: 'my-loans' }"
                class="text-decoration-none fw-semibold"
              >
                #{{ fine.loan.code }}
              </RouterLink>
            </div>

            <div
              v-if="fine.status === 'paid' && fine.paidAt"
              class="small text-success mt-2 pt-2 border-top"
            >
              <i class="bi bi-check2 me-1" />Đã nộp ngày: {{ formatDate(fine.paidAt) }}
            </div>
            <div
              v-else-if="fine.status === 'waived'"
              class="small text-muted mt-2 pt-2 border-top"
            >
              <i class="bi bi-info-circle me-1" />
              Miễn: {{ fine.waivedReason || 'Theo quyết định thư viện' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Phân trang -->
      <div
        v-if="meta.totalPages > 1"
        class="card-footer bg-white border-top p-3"
      >
        <Pagination
          :page="currentPage"
          :total-pages="meta.totalPages"
          :total="meta.total"
          @update:page="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.my-fines-view {
  min-height: 70vh;
}

.page-title {
  color: #1f2937;
  font-weight: 700;
}

.breadcrumb-nav {
  font-size: 0.85rem;

  .breadcrumb-item a {
    color: #4b5563;
    text-decoration: none;

    &:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }
  }
}

.stat-icon-wrapper {
  width: 36px;
  height: 36px;
  font-size: 1.1rem;
}

.stat-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  }
}

.table-danger-subtle {
  background-color: #fffbfb;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.card-header-tabs .nav-link {
  color: #4b5563;
  font-weight: 500;
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 2px solid transparent;
  padding: 0.75rem 1rem;

  &:hover {
    color: #1d4ed8;
    border-bottom-color: #cbd5e1;
  }

  &.active {
    color: #1d4ed8;
    font-weight: 600;
    border-bottom-color: #1d4ed8;
    background: transparent;
  }
}

@media (max-width: 575.98px) {
  .card-header-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: thin;
  }
}
</style>

