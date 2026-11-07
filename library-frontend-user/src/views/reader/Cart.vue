<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import loanService from '@/services/loan.service';
import CartItem from '@/components/loan/CartItem.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { dayjs, formatDate, formatMoney } from '@/utils/format';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();

// Trạng thái form
const today = dayjs().format('YYYY-MM-DD');
const maxPickupDate = dayjs().add(7, 'day').format('YYYY-MM-DD');
const defaultPickupDate = dayjs().add(1, 'day').format('YYYY-MM-DD');

const expectedPickupDate = ref(defaultPickupDate);
const requestNote = ref('');
const submitting = ref(false);
const removingBookId = ref(null);
const submitError = ref(null);

// Hạn trả dự kiến = ngày nhận + 14 ngày
const expectedReturnDate = computed(() => {
  if (!expectedPickupDate.value) return '—';
  return formatDate(dayjs(expectedPickupDate.value).add(14, 'day'), 'DD/MM/YYYY');
});

// Kiểm tra điều kiện tài khoản độc giả
const isAccountLocked = computed(() => {
  return authStore.user && authStore.user.status !== 'active';
});

const unpaidFine = computed(() => {
  return Number(authStore.user?.unpaidFineTotal || 0);
});

const hasUnpaidFine = computed(() => {
  return unpaidFine.value > 0;
});

// Điều kiện vô hiệu hóa nút gửi
const canSubmit = computed(() => {
  if (cartStore.count === 0) return false;
  if (cartStore.hasUnavailable) return false;
  if (isAccountLocked.value) return false;
  if (hasUnpaidFine.value) return false;
  if (!expectedPickupDate.value) return false;
  if (submitting.value) return false;
  return true;
});

async function handleRemoveItem(bookId) {
  removingBookId.value = bookId;
  const result = await cartStore.removeFromCart(bookId);
  removingBookId.value = null;

  if (result.success) {
    toast.success('Đã xóa sách khỏi giỏ mượn');
  } else {
    toast.error(result.message || 'Không thể xóa sách khỏi giỏ');
  }
}

async function handleSubmitLoan() {
  submitError.value = null;

  if (cartStore.count === 0) {
    submitError.value = 'Giỏ mượn đang trống. Vui lòng chọn sách trước khi gửi yêu cầu.';
    toast.warning(submitError.value);
    return;
  }

  if (cartStore.hasUnavailable) {
    submitError.value = 'Trong giỏ có sách hiện đã hết. Vui lòng xóa những cuốn sách này trước khi gửi.';
    toast.warning(submitError.value);
    return;
  }

  if (isAccountLocked.value) {
    submitError.value = 'Tài khoản của bạn đang bị khóa, không thể gửi yêu cầu mượn.';
    toast.error(submitError.value);
    return;
  }

  if (hasUnpaidFine.value) {
    submitError.value = `Bạn đang có khoản nợ phạt chưa thanh toán (${formatMoney(unpaidFine.value)}). Vui lòng thanh toán trước khi mượn sách.`;
    toast.error(submitError.value);
    return;
  }

  if (!expectedPickupDate.value) {
    submitError.value = 'Vui lòng chọn ngày dự kiến đến nhận sách.';
    toast.warning(submitError.value);
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      expectedPickupDate: new Date(expectedPickupDate.value).toISOString(),
      requestNote: requestNote.value?.trim() || '',
    };

    const loan = await loanService.submitLoan(payload);
    const loanCode = loan?.code || '';

    toast.success(`Gửi yêu cầu mượn sách thành công! Mã phiếu: ${loanCode}`);
    cartStore.clearCart();

    // Chuyển hướng sang danh sách phiếu mượn của tôi
    await router.push({ name: 'my-loans' });
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Không thể gửi yêu cầu mượn sách';
    submitError.value = message;
    toast.error(message);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  cartStore.fetchCart();
});
</script>

<template>
  <div class="cart-view py-4">
    <div class="container">
      <!-- Breadcrumbs -->
      <nav
        aria-label="Đường dẫn trang"
        class="mb-3"
      >
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'home' }">
              <i
                class="bi bi-house-door me-1"
                aria-hidden="true"
              />Trang chủ
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Giỏ mượn sách
          </li>
        </ol>
      </nav>

      <!-- Tiêu đề trang -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4 border-bottom pb-3">
        <div>
          <h1 class="h3 fw-bold text-dark mb-1">
            <i
              class="bi bi-basket3 me-2 text-primary"
              aria-hidden="true"
            />
            Giỏ mượn sách
          </h1>
          <p class="text-muted small mb-0">
            Xem lại các sách đã chọn và gửi yêu cầu mượn tới thủ thư thư viện.
          </p>
        </div>

        <RouterLink
          v-if="cartStore.count > 0"
          :to="{ name: 'books' }"
          class="btn btn-outline-primary btn-sm"
        >
          <i
            class="bi bi-plus-lg me-1"
            aria-hidden="true"
          />
          Thêm sách khác
        </RouterLink>
      </div>

      <!-- Cảnh báo tài khoản bị khóa -->
      <div
        v-if="isAccountLocked"
        class="alert alert-danger d-flex align-items-center gap-3 mb-4 rounded-3 shadow-xs"
        role="alert"
      >
        <i
          class="bi bi-shield-x fs-3 flex-shrink-0"
          aria-hidden="true"
        />
        <div>
          <h2 class="h6 fw-bold mb-1">
            Tài khoản hiện đang bị tạm khóa
          </h2>
          <div class="small">
            Tài khoản độc giả của bạn đang bị khóa bởi thủ thư. Bạn tạm thời không thể gửi yêu cầu mượn sách mới. Vui lòng liên hệ quầy thư viện để được giải quyết.
          </div>
        </div>
      </div>

      <!-- Cảnh báo có tiền phạt chưa thanh toán -->
      <div
        v-if="hasUnpaidFine"
        class="alert alert-warning d-flex align-items-center justify-content-between gap-3 mb-4 rounded-3 shadow-xs"
        role="alert"
      >
        <div class="d-flex align-items-center gap-3">
          <i
            class="bi bi-exclamation-triangle-fill fs-3 text-warning flex-shrink-0"
            aria-hidden="true"
          />
          <div>
            <h2 class="h6 fw-bold mb-1">
              Bạn đang có khoản nợ phạt chưa thanh toán
            </h2>
            <div class="small">
              Tổng tiền phạt chưa nộp: <strong class="text-danger">{{ formatMoney(unpaidFine) }}</strong>. Theo quy định thư viện, độc giả cần thanh toán phí phạt tại quầy trước khi tiếp tục mượn sách mới.
            </div>
          </div>
        </div>
        <RouterLink
          :to="{ name: 'my-fines' }"
          class="btn btn-warning btn-sm text-nowrap fw-semibold text-dark"
        >
          Xem phạt của tôi
        </RouterLink>
      </div>

      <!-- Cảnh báo có sách hết hàng trong giỏ -->
      <div
        v-if="cartStore.count > 0 && cartStore.hasUnavailable"
        class="alert alert-danger d-flex align-items-center gap-3 mb-4 rounded-3 shadow-xs"
        role="alert"
      >
        <i
          class="bi bi-x-circle-fill fs-3 text-danger flex-shrink-0"
          aria-hidden="true"
        />
        <div>
          <h2 class="h6 fw-bold mb-1">
            Có {{ cartStore.unavailableCount }} sách trong giỏ hiện đã hết bản sao
          </h2>
          <div class="small">
            Một hoặc nhiều sách bạn chọn hiện không còn bản sao khả dụng trong kho. Vui lòng bấm <strong>Xóa</strong> cuốn sách đó khỏi giỏ để có thể gửi yêu cầu mượn các sách còn lại.
          </div>
        </div>
      </div>

      <!-- Báo lỗi gửi đơn từ API -->
      <div
        v-if="submitError"
        class="alert alert-danger d-flex align-items-center justify-content-between mb-4 rounded-3"
        role="alert"
      >
        <div class="d-flex align-items-center gap-2">
          <i
            class="bi bi-exclamation-octagon-fill fs-5"
            aria-hidden="true"
          />
          <span>{{ submitError }}</span>
        </div>
        <button
          type="button"
          class="btn-close btn-close-sm"
          aria-label="Đóng"
          @click="submitError = null"
        />
      </div>

      <!-- Trạng thái Loading Skeleton -->
      <div
        v-if="cartStore.loading && cartStore.count === 0"
        class="py-4 text-center placeholder-glow"
      >
        <div class="row g-4">
          <div class="col-12 col-lg-8">
            <div
              v-for="idx in 3"
              :key="idx"
              class="card p-3 mb-3 border rounded-3"
            >
              <div class="d-flex gap-3">
                <span
                  class="placeholder rounded"
                  style="width: 75px; height: 105px;"
                />
                <div class="flex-grow-1">
                  <span class="placeholder col-6 mb-2" />
                  <span class="placeholder col-4 mb-2 d-block" />
                  <span class="placeholder col-8" />
                </div>
              </div>
            </div>
          </div>
          <div class="col-12 col-lg-4">
            <div class="card p-4 border rounded-3">
              <span class="placeholder col-7 mb-3" />
              <span class="placeholder col-10 mb-2" />
              <span class="placeholder col-8 mb-4" />
              <span
                class="placeholder col-12 rounded py-3"
                style="height: 42px;"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Nội dung Giỏ mượn có sách -->
      <div
        v-else-if="cartStore.count > 0"
        class="cart-content-layout"
      >
        <div class="row g-4">
          <!-- Cột trái: Danh sách các sách trong giỏ mượn -->
          <div class="col-12 col-lg-8">
            <section
              class="cart-items-section"
              aria-label="Danh sách sách trong giỏ"
            >
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="fw-semibold text-secondary small">
                  Danh sách sách chọn mượn ({{ cartStore.count }}/{{ cartStore.maxBooks }})
                </span>
                <span
                  v-if="cartStore.count >= cartStore.maxBooks"
                  class="badge bg-warning text-dark small"
                >
                  Đã đạt giới hạn tối đa {{ cartStore.maxBooks }} cuốn
                </span>
              </div>

              <!-- Lặp qua danh sách CartItem -->
              <CartItem
                v-for="item in cartStore.items"
                :key="item.book?._id || item.book"
                :item="item"
                :removing="removingBookId === (item.book?._id || item.book)"
                @remove="handleRemoveItem"
              />
            </section>

            <!-- Phần cấu hình ngày nhận & ghi chú -->
            <section
              class="cart-pickup-form card border rounded-3 p-3.5 mt-4 shadow-xs"
              aria-labelledby="pickup-settings-heading"
            >
              <h2
                id="pickup-settings-heading"
                class="h6 fw-bold text-dark mb-3 border-bottom pb-2"
              >
                <i
                  class="bi bi-calendar-check me-2 text-primary"
                  aria-hidden="true"
                />
                Thông tin nhận sách tại thư viện
              </h2>

              <div class="row g-3">
                <!-- Chọn ngày dự kiến đến nhận -->
                <div class="col-12 col-md-6">
                  <label
                    for="expectedPickupDate"
                    class="form-label fw-semibold small text-dark"
                  >
                    Ngày dự kiến đến nhận sách <span class="text-danger">*</span>
                  </label>
                  <input
                    id="expectedPickupDate"
                    v-model="expectedPickupDate"
                    type="date"
                    class="form-control"
                    :min="today"
                    :max="maxPickupDate"
                    required
                  >
                  <div class="form-text small">
                    Hỗ trợ đặt lịch trong vòng 7 ngày tới (kể từ hôm nay).
                  </div>
                </div>

                <!-- Hạn trả sách dự kiến -->
                <div class="col-12 col-md-6">
                  <label class="form-label fw-semibold small text-secondary">
                    Hạn trả dự kiến (14 ngày kể từ ngày nhận)
                  </label>
                  <div class="form-control bg-light text-primary fw-bold">
                    <i
                      class="bi bi-clock-history me-1"
                      aria-hidden="true"
                    />
                    {{ expectedReturnDate }}
                  </div>
                  <div class="form-text small">
                    Độc giả có thể xin gia hạn online thêm nếu chưa quá hạn.
                  </div>
                </div>

                <!-- Ghi chú cho thủ thư -->
                <div class="col-12">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label
                      for="requestNote"
                      class="form-label fw-semibold small text-dark mb-0"
                    >
                      Ghi chú thêm cho thủ thư (tùy chọn)
                    </label>
                    <span class="text-muted extra-small">
                      {{ requestNote.length }}/500 ký tự
                    </span>
                  </div>
                  <textarea
                    id="requestNote"
                    v-model="requestNote"
                    class="form-control"
                    rows="2"
                    maxlength="500"
                    placeholder="Ví dụ: Tôi sẽ ghé nhận sách vào buổi chiều sau 15h..."
                  />
                </div>
              </div>
            </section>
          </div>

          <!-- Cột phải: Bảng tóm tắt & Nút gửi yêu cầu -->
          <div class="col-12 col-lg-4">
            <aside class="cart-summary-card card border rounded-3 p-3.5 shadow-sm sticky-top-summary">
              <h2 class="h5 fw-bold text-dark mb-3 border-bottom pb-2">
                Tóm tắt yêu cầu mượn
              </h2>

              <div class="summary-details d-flex flex-column gap-2 mb-3 small">
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Số lượng sách mượn:</span>
                  <span class="fw-bold text-dark">{{ cartStore.count }} cuốn</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Ngày nhận dự kiến:</span>
                  <span class="fw-semibold text-dark">{{ formatDate(expectedPickupDate, 'DD/MM/YYYY') }}</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Hạn trả dự kiến:</span>
                  <span class="fw-bold text-primary">{{ expectedReturnDate }}</span>
                </div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Phí mượn sách:</span>
                  <span class="badge bg-success-subtle text-success border border-success-subtle">Miễn phí</span>
                </div>
              </div>

              <!-- Nút gửi yêu cầu mượn -->
              <button
                class="btn btn-primary w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 mb-3 shadow-xs"
                type="button"
                :disabled="!canSubmit"
                @click="handleSubmitLoan"
              >
                <span
                  v-if="submitting"
                  class="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                />
                <i
                  v-else
                  class="bi bi-send-check fs-5"
                  aria-hidden="true"
                />
                <span>{{ submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu mượn sách' }}</span>
              </button>

              <!-- Giải thích nếu nút bị disabled -->
              <div
                v-if="!canSubmit"
                class="text-danger extra-small mb-3"
              >
                <template v-if="cartStore.hasUnavailable">
                  * Vui lòng xóa các cuốn sách hết bản sao khỏi giỏ.
                </template>
                <template v-else-if="isAccountLocked">
                  * Tài khoản đang bị khóa, không thể gửi yêu cầu.
                </template>
                <template v-else-if="hasUnpaidFine">
                  * Bạn cần thanh toán tiền phạt còn nợ trước khi mượn.
                </template>
              </div>

              <!-- Chính sách mượn sách thư viện -->
              <div class="loan-policy-box bg-light rounded-3 p-3 small">
                <div class="fw-semibold text-dark mb-2 d-flex align-items-center gap-1.5">
                  <i
                    class="bi bi-journal-bookmark text-primary"
                    aria-hidden="true"
                  />
                  <span>Chính sách mượn sách</span>
                </div>
                <ul class="list-unstyled mb-0 d-flex flex-column gap-1.5 text-muted extra-small lh-base">
                  <li class="d-flex align-items-start gap-1.5">
                    <i
                      class="bi bi-check2 text-success mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Tối đa <strong>5 cuốn</strong> sách trong cùng một thời điểm.</span>
                  </li>
                  <li class="d-flex align-items-start gap-1.5">
                    <i
                      class="bi bi-check2 text-success mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Thời hạn mượn <strong>14 ngày</strong> (có thể xin gia hạn thêm online tối đa 2 lần).</span>
                  </li>
                  <li class="d-flex align-items-start gap-1.5">
                    <i
                      class="bi bi-check2 text-success mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Sách sẽ được giữ tại quầy trong <strong>24 giờ</strong> sau khi đơn mượn được thủ thư duyệt.</span>
                  </li>
                  <li class="d-flex align-items-start gap-1.5">
                    <i
                      class="bi bi-check2 text-success mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Vui lòng mang theo thẻ độc giả hoặc xuất trình mã phiếu khi đến nhận sách.</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <!-- Trạng thái Giỏ mượn Rỗng -->
      <div
        v-else
        class="card border rounded-3 p-5 text-center my-4 shadow-xs"
      >
        <EmptyState
          title="Giỏ mượn sách đang trống"
          message="Bạn chưa chọn cuốn sách nào vào giỏ mượn. Hãy dạo quanh thư viện và chọn những tác phẩm bạn muốn đọc nhé!"
          icon="bi-basket3"
        >
          <template #action>
            <RouterLink
              :to="{ name: 'books' }"
              class="btn btn-primary px-4 py-2 mt-2"
            >
              <i
                class="bi bi-search me-1"
                aria-hidden="true"
              />
              Khám phá danh mục sách
            </RouterLink>
          </template>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-view {
  background-color: #ffffff;
  min-height: 80vh;
}

.sticky-top-summary {
  top: 90px;
}

.extra-small {
  font-size: 0.775rem;
}

.shadow-xs {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>

