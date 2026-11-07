<script setup>
import { onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import BookCard from '@/components/book/BookCard.vue';
import BookCarousel from '@/components/book/BookCarousel.vue';
import BookRow from '@/components/book/BookRow.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';
import bookService from '@/services/book.service';

const toast = useToast();
const books = ref([]);
const meta = ref(null);
const query = ref('');
const loading = ref(false);
const error = ref('');
let requestId = 0;

async function loadBooks(searchQuery = '') {
  const currentRequest = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const result = await bookService.listBooks({ q: searchQuery || undefined, page: 1, limit: 12 });
    if (currentRequest !== requestId) return;
    books.value = result.books;
    meta.value = result.meta;
  } catch (requestError) {
    if (currentRequest !== requestId) return;
    error.value = requestError.response?.data?.message || 'Không tải được danh sách sách. Hãy kiểm tra API và kết nối mạng.';
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function handleQuickAction(action) {
  const label = action === 'cart' ? 'Giỏ mượn' : 'Kệ sách';
  toast.info(`Thao tác ${label} sẽ được kết nối trong task tương ứng.`);
}

onMounted(() => loadBooks());
</script>

<template>
  <main class="container py-4 book-playground">
    <header class="d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-3 mb-4">
      <div>
        <h1 class="h2 mb-1">
          Thử component sách
        </h1>
        <p class="text-secondary mb-0">
          Danh sách lấy trực tiếp từ API công khai.
        </p>
      </div>
      <div class="book-playground-search">
        <SearchBar
          v-model="query"
          placeholder="Tìm sách trên API..."
          @search="loadBooks"
        />
      </div>
    </header>

    <div
      v-if="error"
      class="alert alert-danger"
      role="alert"
    >
      {{ error }}
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        type="button"
        @click="loadBooks(query)"
      >
        Thử lại
      </button>
    </div>

    <section
      v-if="loading"
      class="row g-3"
      aria-label="Đang tải danh sách sách"
      aria-busy="true"
    >
      <div
        v-for="item in 4"
        :key="item"
        class="col-6 col-md-4 col-lg-3"
      >
        <SkeletonCard />
      </div>
    </section>

    <EmptyState
      v-else-if="!error && books.length === 0"
      title="Chưa tìm thấy sách"
      description="Thử thay đổi từ khóa hoặc kiểm tra dữ liệu sách đang hiển thị công khai."
    />

    <template v-else-if="!error">
      <p class="small text-secondary">
        Đang hiển thị {{ books.length }} sách{{ meta?.total ? ` / ${meta.total}` : '' }}.
      </p>

      <section
        class="mb-5"
        aria-labelledby="preview-grid-heading"
      >
        <h2
          id="preview-grid-heading"
          class="h4 mb-3"
        >
          BookCard
        </h2>
        <div class="row g-3">
          <div
            v-for="book in books"
            :key="book._id"
            class="col-6 col-md-4 col-lg-3"
          >
            <BookCard
              :book="book"
              @add-to-cart="handleQuickAction('cart')"
              @add-to-shelf="handleQuickAction('shelf')"
            />
          </div>
        </div>
      </section>

      <section
        class="mb-5"
        aria-labelledby="preview-row-heading"
      >
        <h2
          id="preview-row-heading"
          class="h4 mb-3"
        >
          BookRow
        </h2>
        <div class="d-grid gap-3">
          <BookRow
            v-for="book in books.slice(0, 3)"
            :key="book._id"
            :book="book"
            @add-to-cart="handleQuickAction('cart')"
            @add-to-shelf="handleQuickAction('shelf')"
          />
        </div>
      </section>

      <BookCarousel
        title="BookCarousel"
        :books="books"
        @add-to-cart="handleQuickAction('cart')"
        @add-to-shelf="handleQuickAction('shelf')"
      />
    </template>
  </main>
</template>

<style scoped>
.book-playground-search {
  width: min(100%, 30rem);
}
</style>
