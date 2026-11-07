<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import bookService from '@/services/book.service';
import BookAvailability from '@/components/book/BookAvailability.vue';
import RatingStars from '@/components/book/RatingStars.vue';
import RatingSummary from '@/components/book/RatingSummary.vue';
import ReviewItem from '@/components/book/ReviewItem.vue';
import ReviewForm from '@/components/book/ReviewForm.vue';
import BookCarousel from '@/components/book/BookCarousel.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import { formatMoney } from '@/utils/format';
import { cloudinaryThumb } from '@/utils/image';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();

// Trạng thái sách
const book = ref(null);
const relatedBooks = ref([]);
const reviews = ref([]);
const reviewMeta = ref(null);
const loading = ref(true);
const error = ref(null);

// Trạng thái hiển thị giao diện
const activeTab = ref('reviews'); // 'reviews' | 'discussion'
const imageFailed = ref(false);
const isExpandedDesc = ref(false);

const coverUrl = computed(() => {
  if (!book.value) return '';
  return cloudinaryThumb(book.value.cover?.url || book.value.cover, 600);
});

const isAvailable = computed(() => {
  return Number(book.value?.availableCopies || 0) > 0;
});

const isLongDescription = computed(() => {
  return (book.value?.description || '').length > 320;
});

const displayDescription = computed(() => {
  const desc = book.value?.description || 'Chưa có mô tả chi tiết cho cuốn sách này.';
  if (!isLongDescription.value || isExpandedDesc.value) {
    return desc;
  }
  return desc.slice(0, 320) + '...';
});

// Lấy thông tin sách theo slug hoặc id
async function loadBookData(slugOrId) {
  if (!slugOrId) {
    router.replace({ name: 'not-found' });
    return;
  }

  loading.value = true;
  error.value = null;
  imageFailed.value = false;
  isExpandedDesc.value = false;

  try {
    const bookData = await bookService.getBookByIdOrSlug(slugOrId);
    if (!bookData || bookData.status === 'hidden') {
      router.replace({ name: 'not-found' });
      return;
    }

    book.value = bookData;

    // Cập nhật tiêu đề trang
    if (bookData.title) {
      document.title = `${bookData.title} | Thư viện`;
    }

    // Tải dữ liệu sách tương tự và đánh giá song song
    await Promise.allSettled([
      fetchRelated(bookData._id),
      fetchReviews(bookData._id),
    ]);
  } catch (err) {
    // Nếu lỗi 404 (Không tìm thấy sách) -> chuyển hướng Not Found
    if (err?.response?.status === 404) {
      router.replace({ name: 'not-found' });
      return;
    }
    error.value = err?.response?.data?.message || err?.message || 'Không thể tải thông tin sách';
  } finally {
    loading.value = false;
  }
}

async function fetchRelated(bookId) {
  try {
    const related = await bookService.getRelatedBooks(bookId);
    relatedBooks.value = Array.isArray(related) ? related : [];
  } catch {
    relatedBooks.value = [];
  }
}

async function fetchReviews(bookId) {
  try {
    const { reviews: revList, meta } = await bookService.getBookReviews(bookId, { limit: 10 });
    reviews.value = Array.isArray(revList) ? revList : [];
    reviewMeta.value = meta;
  } catch {
    reviews.value = [];
    reviewMeta.value = null;
  }
}

const myReview = computed(() => {
  if (!authStore.user?._id || !reviews.value.length) return null;
  const userId = String(authStore.user._id);
  return reviews.value.find((r) => {
    const readerId = typeof r.reader === 'object' ? String(r.reader?._id) : String(r.reader);
    return readerId === userId;
  }) || null;
});

async function handleReviewSubmitted() {
  if (!book.value?._id) return;
  await Promise.allSettled([
    fetchReviews(book.value._id),
    (async () => {
      const updated = await bookService.getBookByIdOrSlug(book.value.slug || book.value._id);
      if (updated) book.value = updated;
    })(),
  ]);
}

// Xử lý hành động thêm sách vào giỏ mượn
async function handleAddToCart(targetBook) {
  const item = targetBook || book.value;
  if (!item || !item._id) return;

  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để mượn sách.');
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  if (authStore.role !== 'reader') {
    toast.warning('Chỉ tài khoản độc giả mới có thể mượn sách.');
    return;
  }

  if (cartStore.isInCart(item._id)) {
    toast.info(`"${item.title}" đã có trong giỏ mượn của bạn.`);
    return;
  }

  const result = await cartStore.addToCart(item._id);
  if (result.success) {
    toast.success(`Đã thêm "${item.title}" vào giỏ mượn!`);
  } else if (result.requiresAuth) {
    router.push({ name: 'login', query: { redirect: route.fullPath } });
  } else {
    toast.error(result.message || 'Không thể thêm vào giỏ mượn');
  }
}

function handleBorrowAction() {
  handleAddToCart(book.value);
}

// Xử lý hành động đặt trước
function handleReserveAction() {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để đặt trước sách.');
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  toast.info('Tính năng Đặt trước sách (hàng chờ FIFO) sẽ được kết nối trong FE-35.');
}

// Xử lý hành động thêm vào kệ
function handleShelfAction() {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để thêm sách vào kệ.');
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  toast.info('Tính năng Kệ sách của tôi sẽ được kết nối trong FE-18.');
}

function handleQuickAction(action) {
  const label = action === 'cart' ? 'Giỏ mượn' : 'Kệ sách';
  toast.info(`Tính năng ${label} sẽ được kết nối trong task tương ứng.`);
}

function scrollToReviews() {
  activeTab.value = 'reviews';
  nextTick(() => {
    const el = document.getElementById('book-detail-tabs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// Theo dõi thay đổi slug (khi người dùng bấm sách tương tự)
watch(
  () => route.params.slug,
  (newSlug) => {
    if (newSlug) {
      loadBookData(newSlug);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
);

onMounted(() => {
  loadBookData(route.params.slug);
});
</script>

<template>
  <div class="book-detail-view py-4">
    <div class="container">
      <!-- Breadcrumb -->
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
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'books' }">
              Danh mục sách
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active text-truncate"
            style="max-width: 320px;"
            aria-current="page"
          >
            {{ book?.title || 'Chi tiết sách' }}
          </li>
        </ol>
      </nav>

      <!-- Trạng thái Loading Skeleton -->
      <div
        v-if="loading"
        class="book-detail-skeleton py-3"
        aria-busy="true"
        aria-label="Đang tải thông tin sách"
      >
        <div class="row g-4">
          <div class="col-12 col-md-4 col-lg-3">
            <div class="skeleton-cover placeholder-glow">
              <div
                class="placeholder w-100 rounded"
                style="height: 380px;"
              />
            </div>
          </div>
          <div class="col-12 col-md-8 col-lg-6">
            <div class="placeholder-glow">
              <span class="placeholder col-8 mb-3 placeholder-lg" />
              <span class="placeholder col-5 mb-2" />
              <span class="placeholder col-4 mb-4" />
              <div class="d-flex gap-2 mb-4">
                <span class="placeholder col-2 rounded-pill" />
                <span class="placeholder col-2 rounded-pill" />
              </div>
              <span class="placeholder col-12 mb-2" />
              <span class="placeholder col-12 mb-2" />
              <span class="placeholder col-9 mb-2" />
            </div>
          </div>
          <div class="col-12 col-lg-3">
            <div class="placeholder-glow p-4 border rounded bg-white">
              <span class="placeholder col-7 mb-3" />
              <span class="placeholder col-10 mb-4" />
              <span
                class="placeholder col-12 py-3 rounded mb-2"
                style="height: 44px;"
              />
              <span
                class="placeholder col-12 py-2 rounded"
                style="height: 38px;"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Trạng thái Lỗi -->
      <div
        v-else-if="error"
        class="alert alert-danger d-flex align-items-center justify-content-between my-4"
        role="alert"
      >
        <div class="d-flex align-items-center">
          <i
            class="bi bi-exclamation-triangle-fill me-2 fs-5"
            aria-hidden="true"
          />
          <span>{{ error }}</span>
        </div>
        <button
          class="btn btn-outline-danger btn-sm"
          type="button"
          @click="loadBookData(route.params.slug)"
        >
          <i
            class="bi bi-arrow-clockwise me-1"
            aria-hidden="true"
          />Thử lại
        </button>
      </div>

      <!-- Nội dung chi tiết sách (Bố cục 3 cột) -->
      <div
        v-else-if="book"
        class="book-detail-content"
      >
        <div class="row g-4">
          <!-- Cột 1: Ảnh bìa lớn -->
          <div class="col-12 col-md-4 col-lg-3">
            <div class="book-cover-card card border-0 shadow-sm p-2 text-center">
              <div class="book-cover-wrapper position-relative">
                <img
                  v-if="coverUrl && !imageFailed"
                  :src="coverUrl"
                  :alt="`Bìa sách ${book.title}`"
                  class="img-fluid rounded book-cover-img"
                  @error="imageFailed = true"
                >
                <div
                  v-else
                  class="book-cover-fallback rounded d-flex flex-column align-items-center justify-content-center text-muted"
                >
                  <i
                    class="bi bi-book fs-1 mb-2 text-secondary"
                    aria-hidden="true"
                  />
                  <span class="small">Chưa có ảnh bìa</span>
                </div>
              </div>

              <!-- Mã sách thư viện -->
              <div
                v-if="book.code"
                class="mt-2 pt-2 border-top text-muted small text-center"
              >
                Mã sách: <span class="fw-semibold text-dark">{{ book.code }}</span>
              </div>
            </div>
          </div>

          <!-- Cột 2: Thông tin chi tiết sách -->
          <div class="col-12 col-md-8 col-lg-6">
            <article class="book-info-section">
              <!-- Tiêu đề sách -->
              <h1 class="book-title h2 fw-bold text-dark mb-2">
                {{ book.title }}
              </h1>

              <!-- Tác giả & Đánh giá -->
              <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                <div class="book-authors text-secondary">
                  Tác giả:
                  <template v-if="book.authors && book.authors.length > 0">
                    <span
                      v-for="(author, idx) in book.authors"
                      :key="author._id || idx"
                    >
                      <RouterLink
                        v-if="author._id"
                        :to="{ name: 'author-detail', params: { id: author._id } }"
                        class="author-link fw-semibold text-primary text-decoration-none"
                      >
                        {{ author.name }}
                      </RouterLink>
                      <span
                        v-else
                        class="fw-semibold text-dark"
                      >{{ author.name || author }}</span>
                      <span v-if="idx < book.authors.length - 1">, </span>
                    </span>
                  </template>
                  <span
                    v-else-if="book.authorText"
                    class="fw-semibold text-dark"
                  >
                    {{ book.authorText }}
                  </span>
                  <span
                    v-else
                    class="text-muted fst-italic"
                  >Đang cập nhật</span>
                </div>

                <span class="text-muted opacity-50">|</span>

                <!-- Đánh giá sao -->
                <button
                  type="button"
                  class="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center"
                  @click="scrollToReviews"
                >
                  <RatingStars
                    :rating="book.ratingAvg || 0"
                    :count="book.ratingCount || 0"
                  />
                </button>
              </div>

              <!-- Thể loại chips -->
              <div
                v-if="book.categories && book.categories.length > 0"
                class="book-categories d-flex flex-wrap gap-1 mb-4"
              >
                <RouterLink
                  v-for="cat in book.categories"
                  :key="cat._id || cat.slug"
                  :to="{ name: 'books', query: { category: cat.slug } }"
                  class="badge bg-light text-primary border text-decoration-none px-2 py-1.5 fw-normal category-chip"
                >
                  <i
                    class="bi bi-tag me-1"
                    aria-hidden="true"
                  />{{ cat.name }}
                </RouterLink>
              </div>

              <!-- Bảng thông tin xuất bản & lưu trữ -->
              <div class="card bg-light border-0 rounded-3 p-3 mb-4">
                <div class="row g-2 small">
                  <div class="col-sm-6">
                    <span class="text-muted">Nhà xuất bản:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ book.publisher?.name || 'Đang cập nhật' }}
                    </span>
                  </div>
                  <div class="col-sm-6">
                    <span class="text-muted">Năm xuất bản:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ book.publishYear || '—' }}
                    </span>
                  </div>
                  <div class="col-sm-6">
                    <span class="text-muted">Mã ISBN:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ book.isbn || '—' }}
                    </span>
                  </div>
                  <div class="col-sm-6">
                    <span class="text-muted">Ngôn ngữ:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ book.language || 'Tiếng Việt' }}
                    </span>
                  </div>
                  <div class="col-sm-6">
                    <span class="text-muted">Số trang:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ book.pages ? `${book.pages} trang` : '—' }}
                    </span>
                  </div>
                  <div class="col-sm-6">
                    <span class="text-muted">Vị trí kệ:</span>
                    <span class="fw-semibold text-primary ms-1">
                      <i
                        class="bi bi-geo-alt me-1"
                        aria-hidden="true"
                      />{{ book.location || 'Khu sách chung' }}
                    </span>
                  </div>
                  <div
                    v-if="book.price"
                    class="col-sm-6"
                  >
                    <span class="text-muted">Giá bìa / cọc:</span>
                    <span class="fw-semibold text-dark ms-1">
                      {{ formatMoney(book.price) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Giới thiệu / Mô tả nội dung -->
              <div class="book-description-wrap mb-4">
                <h2 class="h5 fw-bold text-dark mb-2">
                  Giới thiệu tác phẩm
                </h2>
                <div class="book-description-text text-secondary lh-lg">
                  {{ displayDescription }}
                </div>
                <button
                  v-if="isLongDescription"
                  type="button"
                  class="btn btn-link btn-sm p-0 mt-1 text-primary text-decoration-none fw-semibold"
                  @click="isExpandedDesc = !isExpandedDesc"
                >
                  <span>{{ isExpandedDesc ? 'Thu gọn' : 'Xem thêm' }}</span>
                  <i
                    class="bi ms-1"
                    :class="isExpandedDesc ? 'bi-chevron-up' : 'bi-chevron-down'"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </article>
          </div>

          <!-- Cột 3: Hộp mượn sách (Borrow Box) -->
          <div class="col-12 col-lg-3">
            <aside class="borrow-box-card card border shadow-sm rounded-3 p-3 sticky-borrow-box">
              <h2 class="h5 fw-bold text-dark mb-3 border-bottom pb-2">
                Thông tin mượn sách
              </h2>

              <!-- Trạng thái còn / hết sách -->
              <div class="mb-3">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <span class="text-muted small">Tình trạng:</span>
                  <BookAvailability :available-copies="book.availableCopies" />
                </div>
                <div class="d-flex align-items-center justify-content-between small text-muted">
                  <span>Số bản khả dụng:</span>
                  <span class="fw-semibold text-dark">{{ book.availableCopies || 0 }} / {{ book.totalCopies || 0 }}</span>
                </div>
                <div class="d-flex align-items-center justify-content-between small text-muted mt-1">
                  <span>Vị trí trên kệ:</span>
                  <span class="fw-semibold text-primary">{{ book.location || 'Khu chung' }}</span>
                </div>
              </div>

              <!-- Nút hành động chính -->
              <div class="action-buttons mb-3">
                <!-- Trường hợp CÒN SÁCH: Nút Thêm vào giỏ mượn -->
                <button
                  v-if="isAvailable"
                  type="button"
                  class="btn btn-primary w-100 py-2.5 fw-semibold d-flex align-items-center justify-content-center gap-2 mb-2"
                  @click="handleBorrowAction"
                >
                  <i
                    class="bi bi-bag-plus fs-5"
                    aria-hidden="true"
                  />
                  <span>Thêm vào giỏ mượn</span>
                </button>

                <!-- Trường hợp HẾT SÁCH: Nút Đặt trước -->
                <button
                  v-else
                  type="button"
                  class="btn btn-warning w-100 py-2.5 fw-semibold text-dark d-flex align-items-center justify-content-center gap-2 mb-2"
                  @click="handleReserveAction"
                >
                  <i
                    class="bi bi-clock-history fs-5"
                    aria-hidden="true"
                  />
                  <span>Đặt trước sách</span>
                </button>

                <!-- Nút phụ: Thêm vào kệ sách -->
                <button
                  type="button"
                  class="btn btn-outline-secondary w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                  @click="handleShelfAction"
                >
                  <i
                    class="bi bi-bookmark-plus"
                    aria-hidden="true"
                  />
                  <span>Thêm vào kệ sách</span>
                </button>
              </div>

              <!-- Ghi chú quy định mượn sách -->
              <div class="borrow-rules-note bg-light rounded p-2.5 small text-muted">
                <div class="d-flex align-items-start gap-2 mb-1.5">
                  <i
                    class="bi bi-info-circle text-primary mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Thời hạn mượn: <strong>14 ngày</strong> (hỗ trợ gia hạn online).</span>
                </div>
                <div class="d-flex align-items-start gap-2">
                  <i
                    class="bi bi-shield-check text-success mt-0.5"
                    aria-hidden="true"
                  />
                  <span>Giữ sách tại quầy trong <strong>24 giờ</strong> sau khi đơn duyệt.</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <!-- Khối dưới: Tab Đánh giá / Thảo luận & Sách tương tự -->
        <section
          id="book-detail-tabs"
          class="book-additional-section mt-5 pt-4 border-top"
        >
          <div class="row">
            <div class="col-12 col-lg-8">
              <!-- Tab Header -->
              <ul
                class="nav nav-tabs mb-4"
                role="tablist"
              >
                <li
                  class="nav-item"
                  role="presentation"
                >
                  <button
                    class="nav-link fw-semibold"
                    :class="{ active: activeTab === 'reviews' }"
                    type="button"
                    role="tab"
                    @click="activeTab = 'reviews'"
                  >
                    <i
                      class="bi bi-star me-1"
                      aria-hidden="true"
                    />
                    Đánh giá từ độc giả
                    <span
                      v-if="book.ratingCount"
                      class="badge bg-secondary ms-1"
                    >{{ book.ratingCount }}</span>
                  </button>
                </li>
                <li
                  class="nav-item"
                  role="presentation"
                >
                  <button
                    class="nav-link fw-semibold"
                    :class="{ active: activeTab === 'discussion' }"
                    type="button"
                    role="tab"
                    @click="activeTab = 'discussion'"
                  >
                    <i
                      class="bi bi-chat-dots me-1"
                      aria-hidden="true"
                    />
                    Thảo luận về sách
                  </button>
                </li>
              </ul>

              <!-- Tab Content: Đánh giá -->
              <div
                v-if="activeTab === 'reviews'"
                class="tab-pane-reviews"
              >
                <!-- Tóm tắt đánh giá & phân bố sao -->
                <RatingSummary
                  :rating-avg="book.ratingAvg || 0"
                  :rating-count="book.ratingCount || 0"
                  :reviews="reviews"
                />

                <!-- Biểu mẫu đánh giá hoặc gợi ý mượn sách -->
                <ReviewForm
                  :book-id="book._id"
                  :book-title="book.title"
                  :existing-review="myReview"
                  @submitted="handleReviewSubmitted"
                />

                <!-- Danh sách nhận xét -->
                <div
                  v-if="reviews.length > 0"
                  class="reviews-list d-flex flex-column"
                >
                  <ReviewItem
                    v-for="rev in reviews"
                    :key="rev._id"
                    :review="rev"
                  />
                </div>

                <EmptyState
                  v-else
                  title="Chưa có đánh giá nào"
                  message="Hãy là người đầu tiên mượn và gửi cảm nhận về cuốn sách này nhé!"
                  icon="bi-chat-left-text"
                />
              </div>

              <!-- Tab Content: Thảo luận -->
              <div
                v-else-if="activeTab === 'discussion'"
                class="tab-pane-discussion"
              >
                <div class="card border p-4 text-center rounded-3 bg-light">
                  <div class="mb-3">
                    <i
                      class="bi bi-chat-square-quote text-primary display-5"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 class="h5 fw-bold text-dark mb-2">
                    Diễn đàn thảo luận về sách
                  </h3>
                  <p
                    class="text-muted small mx-auto mb-3"
                    style="max-width: 480px;"
                  >
                    Trao đổi cảm nghĩ, đặt câu hỏi hoặc cùng thảo luận các tình tiết thú vị trong cuốn sách này cùng cộng đồng bạn đọc thư viện.
                  </p>
                  <div>
                    <RouterLink
                      :to="{ name: 'forum' }"
                      class="btn btn-outline-primary btn-sm px-3"
                    >
                      <i
                        class="bi bi-box-arrow-up-right me-1"
                        aria-hidden="true"
                      />Xem Diễn đàn thư viện (FE-33)
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Khối Sách tương tự -->
          <div
            v-if="relatedBooks && relatedBooks.length > 0"
            class="related-books-section mt-5 pt-3"
          >
            <BookCarousel
              title="Sách tương tự có thể bạn thích"
              :books="relatedBooks"
              aria-label="Danh sách sách tương tự"
              @add-to-cart="handleAddToCart"
              @add-to-shelf="handleQuickAction('shelf')"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-detail-view {
  background-color: #ffffff;
  min-height: 80vh;
}

.book-cover-img {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.book-cover-fallback {
  width: 100%;
  height: 340px;
  background-color: #f8f9fa;
  border: 1px dashed #dee2e6;
}

.category-chip {
  transition: all 0.2s ease;
}

.category-chip:hover {
  background-color: #0d6efd !important;
  color: #ffffff !important;
  border-color: #0d6efd !important;
}

.author-link:hover {
  text-decoration: underline !important;
}

.sticky-borrow-box {
  top: 90px;
}

.extra-small {
  font-size: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  font-size: 0.875rem;
}

@media (min-width: 576px) {
  .border-end-sm {
    border-right: 1px solid #dee2e6;
  }
}
</style>
