<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import catalogService from '@/services/catalog.service';
import bookService from '@/services/book.service';
import BookCard from '@/components/book/BookCard.vue';
import Pagination from '@/components/common/Pagination.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';
import { cloudinaryThumb } from '@/utils/image';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const author = ref(null);
const books = ref([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const limit = 12;

const loadingAuthor = ref(true);
const loadingBooks = ref(true);
const error = ref(null);
const imageFailed = ref(false);
const isExpandedBio = ref(false);

const photoUrl = computed(() => {
  if (!author.value?.photo?.url) return '';
  return cloudinaryThumb(author.value.photo.url, 240);
});

const isLongBio = computed(() => {
  return (author.value?.bio || '').length > 300;
});

const displayBio = computed(() => {
  const bio = author.value?.bio || 'Chưa có thông tin tiểu sử chi tiết về tác giả này.';
  if (!isLongBio.value || isExpandedBio.value) {
    return bio;
  }
  return bio.slice(0, 300) + '...';
});

async function loadAuthor(authorId) {
  if (!authorId) {
    router.replace({ name: 'not-found' });
    return;
  }

  loadingAuthor.value = true;
  error.value = null;
  imageFailed.value = false;
  isExpandedBio.value = false;

  try {
    const data = await catalogService.getAuthorById(authorId);
    if (!data) {
      router.replace({ name: 'not-found' });
      return;
    }
    author.value = data;
    if (data.name) {
      document.title = `Tác giả: ${data.name} | Thư viện`;
    }
  } catch (err) {
    if (err?.response?.status === 404 || err?.response?.status === 400) {
      router.replace({ name: 'not-found' });
      return;
    }
    error.value = err?.response?.data?.message || err?.message || 'Không thể tải thông tin tác giả';
  } finally {
    loadingAuthor.value = false;
  }
}

async function loadBooks(authorId, pageNum = 1) {
  loadingBooks.value = true;
  try {
    const { books: bookList, meta } = await bookService.listBooks({
      author: authorId,
      page: pageNum,
      limit,
    });
    books.value = Array.isArray(bookList) ? bookList : [];
    total.value = meta?.total || books.value.length;
    totalPages.value = meta?.totalPages || 1;
    page.value = pageNum;
  } catch (err) {
    books.value = [];
    total.value = 0;
    totalPages.value = 1;
    toast.error(err?.response?.data?.message || 'Không thể tải danh sách tác phẩm của tác giả.');
  } finally {
    loadingBooks.value = false;
  }
}

function handlePageChange(newPage) {
  if (newPage === page.value || newPage < 1 || newPage > totalPages.value) return;
  loadBooks(route.params.id, newPage);
  window.scrollTo({ top: 320, behavior: 'smooth' });
}

function handleQuickAction(action) {
  const label = action === 'cart' ? 'Giỏ mượn' : 'Kệ sách';
  toast.info(`Tính năng ${label} sẽ được kết nối trong task tương ứng.`);
}

async function init(authorId) {
  await loadAuthor(authorId);
  if (author.value) {
    await loadBooks(authorId, 1);
  }
}

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      init(newId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
);

onMounted(() => {
  init(route.params.id);
});
</script>

<template>
  <div class="author-detail-view py-4">
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
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'books' }">
              Sách
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active text-truncate"
            aria-current="page"
          >
            {{ author?.name || 'Tác giả' }}
          </li>
        </ol>
      </nav>

      <!-- Skeleton Header -->
      <div
        v-if="loadingAuthor"
        class="card border-0 shadow-sm p-4 mb-4 placeholder-glow"
        aria-busy="true"
      >
        <div class="d-flex flex-column flex-sm-row align-items-center gap-4">
          <div
            class="placeholder rounded-circle"
            style="width: 120px; height: 120px;"
          />
          <div class="flex-grow-1 text-center text-sm-start w-100">
            <span class="placeholder col-6 mb-2" />
            <span class="placeholder col-3 mb-3 d-block" />
            <span class="placeholder col-10" />
            <span class="placeholder col-8" />
          </div>
        </div>
      </div>

      <!-- Lỗi tải tác giả -->
      <div
        v-else-if="error"
        class="alert alert-danger d-flex align-items-center justify-content-between mb-4"
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
          @click="init(route.params.id)"
        >
          <i
            class="bi bi-arrow-clockwise me-1"
            aria-hidden="true"
          />Thử lại
        </button>
      </div>

      <!-- Khối Hồ sơ Tác giả (Author Profile Header) -->
      <div
        v-else-if="author"
        class="card border-0 shadow-sm p-4 mb-4 author-profile-card"
      >
        <div class="d-flex flex-column flex-sm-row align-items-center align-items-sm-start gap-4">
          <!-- Ảnh đại diện tác giả -->
          <div class="author-photo-wrap flex-shrink-0">
            <img
              v-if="photoUrl && !imageFailed"
              :src="photoUrl"
              :alt="`Chân dung tác giả ${author.name}`"
              class="author-photo rounded-circle shadow-sm"
              @error="imageFailed = true"
            >
            <div
              v-else
              class="author-photo-fallback rounded-circle d-flex align-items-center justify-content-center bg-light text-secondary border shadow-sm"
            >
              <i
                class="bi bi-person-circle fs-1"
                aria-hidden="true"
              />
            </div>
          </div>

          <!-- Thông tin tác giả -->
          <div class="author-info flex-grow-1 text-center text-sm-start">
            <div class="d-flex flex-column flex-sm-row align-items-center align-items-sm-baseline gap-2 mb-2">
              <h1 class="h2 fw-bold text-dark mb-0">
                {{ author.name }}
              </h1>
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                {{ total }} tác phẩm
              </span>
            </div>

            <!-- Tiểu sử -->
            <div class="author-bio text-secondary lh-base mb-2">
              {{ displayBio }}
            </div>
            <button
              v-if="isLongBio"
              type="button"
              class="btn btn-link btn-sm p-0 text-primary text-decoration-none fw-semibold"
              @click="isExpandedBio = !isExpandedBio"
            >
              <span>{{ isExpandedBio ? 'Thu gọn' : 'Đọc thêm tiểu sử' }}</span>
              <i
                class="bi ms-1"
                :class="isExpandedBio ? 'bi-chevron-up' : 'bi-chevron-down'"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Danh sách tác phẩm của tác giả -->
      <section
        class="author-works-section"
        aria-labelledby="author-works-heading"
      >
        <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
          <h2
            id="author-works-heading"
            class="h4 fw-bold text-dark mb-0"
          >
            Tác phẩm trong thư viện
          </h2>
          <span
            v-if="!loadingBooks"
            class="text-muted small"
          >
            Hiển thị <strong>{{ books.length }}</strong> / {{ total }} sách
          </span>
        </div>

        <!-- Skeleton loading sách -->
        <div
          v-if="loadingBooks"
          class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3"
          aria-busy="true"
        >
          <div
            v-for="idx in 8"
            :key="idx"
            class="col"
          >
            <SkeletonCard />
          </div>
        </div>

        <!-- Danh sách sách dạng lưới -->
        <div
          v-else-if="books.length > 0"
          class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-3"
        >
          <div
            v-for="item in books"
            :key="item._id"
            class="col"
          >
            <BookCard
              :book="item"
              @add-to-cart="handleQuickAction('cart')"
              @add-to-shelf="handleQuickAction('shelf')"
            />
          </div>
        </div>

        <!-- Empty state khi tác giả chưa có sách -->
        <div
          v-else
          class="py-4"
        >
          <EmptyState
            title="Chưa có tác phẩm nào"
            message="Hiện tại thư viện chưa có bản sách nào của tác giả này."
            icon="bi-journal-x"
          />
        </div>

        <!-- Phân trang -->
        <div
          v-if="totalPages > 1"
          class="mt-4 pt-2 d-flex justify-content-center"
        >
          <Pagination
            :page="page"
            :total-pages="totalPages"
            :total="total"
            @update:page="handlePageChange"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.author-detail-view {
  background-color: #ffffff;
  min-height: 80vh;
}

.author-profile-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
}

.author-photo,
.author-photo-fallback {
  width: 120px;
  height: 120px;
  object-fit: cover;
}
</style>

