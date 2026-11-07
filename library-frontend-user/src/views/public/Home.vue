<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import BookCarousel from '@/components/book/BookCarousel.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';
import bookService from '@/services/book.service';
import catalogService from '@/services/catalog.service';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();
const homeBooks = ref({ newest: [], popular: [], topRated: [] });
const categories = ref([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const suggestions = ref([]);
const suggestionsOpen = ref(false);
const suggestionsLoading = ref(false);
const suggestionsError = ref(false);
const activeSuggestion = ref(-1);
const homeIsEmpty = computed(() => (
  homeBooks.value.newest.length === 0
  && homeBooks.value.popular.length === 0
  && homeBooks.value.topRated.length === 0
  && categories.value.length === 0
));
let searchTimer;
let suggestionRequestId = 0;

async function loadHome() {
  loading.value = true;
  error.value = '';
  try {
    const [booksResult, categoriesResult] = await Promise.all([
      bookService.getHomeBooks(),
      catalogService.getCategories({ all: true }),
    ]);
    homeBooks.value = {
      newest: booksResult.newest || [],
      popular: booksResult.popular || [],
      topRated: booksResult.topRated || [],
    };
    categories.value = categoriesResult.categories || [];
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Không tải được dữ liệu trang chủ. Vui lòng thử lại.';
  } finally {
    loading.value = false;
  }
}

async function loadSuggestions(query) {
  const requestId = ++suggestionRequestId;
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    suggestions.value = [];
    suggestionsLoading.value = false;
    suggestionsError.value = false;
    return;
  }

  suggestionsLoading.value = true;
  suggestionsError.value = false;
  suggestionsOpen.value = true;
  try {
    const result = await bookService.suggestBooks(normalizedQuery);
    if (requestId !== suggestionRequestId) return;
    suggestions.value = result;
    activeSuggestion.value = -1;
  } catch {
    if (requestId !== suggestionRequestId) return;
    suggestions.value = [];
    suggestionsError.value = true;
  } finally {
    if (requestId === suggestionRequestId) suggestionsLoading.value = false;
  }
}

function handleSearchInput() {
  clearTimeout(searchTimer);
  suggestionRequestId += 1;
  suggestions.value = [];
  suggestionsError.value = false;
  if (searchQuery.value.trim().length < 2) {
    suggestionsOpen.value = false;
    suggestionsLoading.value = false;
    suggestionRequestId += 1;
    return;
  }
  suggestionsOpen.value = true;
  suggestionsLoading.value = true;
  searchTimer = setTimeout(() => loadSuggestions(searchQuery.value), 300);
}

function submitSearch() {
  const query = searchQuery.value.trim();
  suggestionsOpen.value = false;
  if (!query) return;
  router.push({ name: 'books', query: { q: query } });
}

function chooseSuggestion(book) {
  suggestionsOpen.value = false;
  router.push({ name: 'book-detail', params: { slug: book.slug || book._id } });
}

function handleSuggestionKeydown(event) {
  if (event.key === 'Escape') {
    suggestionsOpen.value = false;
    activeSuggestion.value = -1;
    return;
  }
  if (!suggestionsOpen.value || suggestions.value.length === 0) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeSuggestion.value = (activeSuggestion.value + 1) % suggestions.value.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeSuggestion.value = activeSuggestion.value <= 0
      ? suggestions.value.length - 1
      : activeSuggestion.value - 1;
  } else if (event.key === 'Enter' && activeSuggestion.value >= 0) {
    event.preventDefault();
    chooseSuggestion(suggestions.value[activeSuggestion.value]);
  }
}

function closeSuggestions(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) suggestionsOpen.value = false;
}

function openCategory(category) {
  router.push({ name: 'books', query: { category: category._id } });
}

async function handleAddToCart(book) {
  if (!book?._id) return;
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để mượn sách.');
    router.push({ name: 'login', query: { redirect: '/' } });
    return;
  }
  if (authStore.role !== 'reader') {
    toast.warning('Chỉ tài khoản độc giả mới có thể mượn sách.');
    return;
  }
  if (cartStore.isInCart(book._id)) {
    toast.info(`"${book.title}" đã có trong giỏ mượn.`);
    return;
  }
  const result = await cartStore.addToCart(book._id);
  if (result.success) {
    toast.success(`Đã thêm "${book.title}" vào giỏ mượn!`);
  } else if (result.requiresAuth) {
    router.push({ name: 'login', query: { redirect: '/' } });
  } else {
    toast.error(result.message || 'Không thể thêm vào giỏ mượn');
  }
}

function handleQuickAction(action) {
  const label = action === 'cart' ? 'Giỏ mượn' : 'Kệ sách';
  toast.info(`Tính năng ${label} sẽ được kết nối trong task tương ứng.`);
}

onMounted(loadHome);
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<template>
  <main class="home-page">
    <section
      class="home-search-section"
      aria-labelledby="home-search-title"
    >
      <div class="container home-search-content">
        <p class="text-uppercase text-secondary small fw-semibold mb-2">
          Thư viện trực tuyến
        </p>
        <h1
          id="home-search-title"
          class="display-6 fw-bold mb-2"
        >
          Khám phá cuốn sách tiếp theo của bạn
        </h1>
        <p class="text-secondary mb-4">
          Tìm theo tên sách hoặc tác giả trong bộ sưu tập thư viện.
        </p>

        <form
          class="home-search-form"
          role="search"
          @submit.prevent="submitSearch"
          @focusout="closeSuggestions"
        >
          <div class="home-search-input-wrap">
            <label
              class="visually-hidden"
              for="home-book-search"
            >Tìm sách</label>
            <input
              id="home-book-search"
              v-model="searchQuery"
              class="form-control home-search-input"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="home-book-suggestions"
              :aria-expanded="suggestionsOpen"
              :aria-activedescendant="activeSuggestion >= 0 ? `home-suggestion-${activeSuggestion}` : undefined"
              placeholder="Nhập tên sách hoặc tác giả..."
              autocomplete="off"
              @input="handleSearchInput"
              @focus="suggestionsOpen = suggestions.length > 0 || searchQuery.trim().length >= 2"
              @keydown="handleSuggestionKeydown"
            >
            <div
              v-if="suggestionsOpen"
              id="home-book-suggestions"
              class="home-suggestions list-group"
              role="listbox"
            >
              <div
                v-if="suggestionsLoading"
                class="list-group-item text-secondary"
                role="status"
              >
                Đang tìm gợi ý...
              </div>
              <div
                v-else-if="suggestionsError"
                class="list-group-item text-secondary"
                role="status"
              >
                Không tải được gợi ý. Nhấn Enter để tìm kiếm.
              </div>
              <div
                v-else-if="suggestions.length === 0"
                class="list-group-item text-secondary"
                role="status"
              >
                Chưa có gợi ý phù hợp. Nhấn Enter để tìm trong danh sách sách.
              </div>
              <button
                v-for="(book, index) in suggestions"
                :id="`home-suggestion-${index}`"
                :key="book._id"
                class="list-group-item list-group-item-action home-suggestion"
                :class="{ active: index === activeSuggestion }"
                type="button"
                role="option"
                :aria-selected="index === activeSuggestion"
                @click="chooseSuggestion(book)"
              >
                <span class="home-suggestion-title">{{ book.title }}</span>
                <span class="home-suggestion-author">{{ book.authorText || 'Chưa cập nhật tác giả' }}</span>
              </button>
            </div>
          </div>
          <button
            class="btn btn-primary home-search-button"
            type="submit"
          >
            <i
              class="bi bi-search me-2"
              aria-hidden="true"
            />Tìm sách
          </button>
        </form>
      </div>
    </section>

    <div class="container py-5">
      <div
        v-if="error"
        class="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2"
        role="alert"
      >
        <span>{{ error }}</span>
        <button
          class="btn btn-sm btn-outline-danger align-self-start"
          type="button"
          @click="loadHome"
        >
          Thử lại
        </button>
      </div>

      <div
        v-if="loading"
        class="home-loading"
        aria-label="Đang tải trang chủ"
        aria-busy="true"
      >
        <section
          v-for="section in 3"
          :key="section"
          class="mb-5"
        >
          <div class="placeholder-glow mb-3">
            <span class="placeholder col-3" />
          </div>
          <div class="row g-3 flex-nowrap overflow-hidden">
            <div
              v-for="card in 4"
              :key="card"
              class="col-6 col-md-3"
            >
              <SkeletonCard />
            </div>
          </div>
        </section>
        <div class="placeholder-glow mb-3">
          <span class="placeholder col-2" />
        </div>
        <div class="row g-3">
          <div
            v-for="tile in 6"
            :key="tile"
            class="col-6 col-md-4 col-lg-2"
          >
            <div class="home-category-skeleton placeholder-glow">
              <span class="placeholder col-8" />
            </div>
          </div>
        </div>
      </div>

      <template v-else-if="!error && homeIsEmpty">
        <EmptyState
          title="Thư viện chưa có dữ liệu hiển thị"
          description="Hiện chưa có sách hoặc thể loại công khai. Vui lòng quay lại sau."
          action-label="Tải lại"
          @action="loadHome"
        />
      </template>

      <template v-else-if="!error">
        <BookCarousel
          v-if="homeBooks.newest.length"
          class="mb-5"
          title="Sách mới"
          :books="homeBooks.newest"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />
        <BookCarousel
          v-if="homeBooks.popular.length"
          class="mb-5"
          title="Mượn nhiều"
          :books="homeBooks.popular"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />
        <BookCarousel
          v-if="homeBooks.topRated.length"
          class="mb-5"
          title="Đánh giá cao"
          :books="homeBooks.topRated"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />

        <section
          class="mb-5"
          aria-labelledby="home-categories-heading"
        >
          <header class="d-flex align-items-center justify-content-between gap-3 mb-3">
            <h2
              id="home-categories-heading"
              class="home-section-title mb-0"
            >
              Thể loại
            </h2>
            <RouterLink
              :to="{ name: 'books' }"
              class="small"
            >
              Xem danh sách sách
            </RouterLink>
          </header>
          <div
            v-if="categories.length"
            class="row g-3"
          >
            <div
              v-for="category in categories"
              :key="category._id"
              class="col-6 col-md-4 col-lg-3"
            >
              <button
                class="btn btn-outline-primary home-category w-100"
                type="button"
                @click="openCategory(category)"
              >
                <i
                  class="bi bi-bookmark me-2"
                  aria-hidden="true"
                />{{ category.name }}
              </button>
            </div>
          </div>
          <p
            v-else
            class="text-secondary mb-0"
          >
            Chưa có thể loại công khai.
          </p>
        </section>

        <div class="row g-3">
          <div class="col-md-6">
            <section
              class="home-placeholder-section h-100"
              aria-labelledby="home-forum-heading"
            >
              <h2
                id="home-forum-heading"
                class="h5"
              >
                Chủ đề diễn đàn nổi bật
              </h2>
              <p class="text-secondary mb-0">
                Các chủ đề cộng đồng sẽ được hiển thị tại đây.
              </p>
            </section>
          </div>
          <div class="col-md-6">
            <section
              class="home-placeholder-section h-100"
              aria-labelledby="home-announcements-heading"
            >
              <h2
                id="home-announcements-heading"
                class="h5"
              >
                Thông báo thư viện
              </h2>
              <p class="text-secondary mb-0">
                Thông báo chung sẽ được hiển thị tại đây.
              </p>
            </section>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.home-search-section {
  background: #f8f9fa;
  padding: clamp(2.5rem, 7vw, 4.5rem) 0;
}

.home-search-content {
  max-width: 58rem;
  text-align: center;
}

.home-search-form {
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  max-width: 48rem;
  margin: 0 auto;
}

.home-search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.home-search-input {
  min-height: 3.5rem;
  border-radius: 0.5rem;
  font-size: 1.0625rem;
  text-align: left;
}

.home-search-button {
  min-width: 9rem;
  border-radius: 0.5rem;
  font-weight: 600;
}

.home-suggestions {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.25rem);
  right: 0;
  left: 0;
  max-height: 20rem;
  overflow-y: auto;
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: 0 0.125rem 0.5rem rgb(17 24 39 / 12%);
  text-align: left;
}

.home-suggestion {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.home-suggestion-title {
  font-weight: 600;
}

.home-suggestion-author {
  color: #6b7280;
  font-size: 0.875rem;
}

.home-suggestion.active .home-suggestion-author {
  color: #ffffff;
}

.home-section-title {
  font-size: 1.25rem;
  font-weight: 700;
}

.home-category {
  min-height: 3rem;
  text-align: left;
}

.home-category-skeleton {
  display: grid;
  min-height: 3rem;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.home-placeholder-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 1.25rem;
}

@media (max-width: 575.98px) {
  .home-search-form {
    flex-direction: column;
  }

  .home-search-button {
    min-height: 3rem;
    width: 100%;
  }
}
</style>
