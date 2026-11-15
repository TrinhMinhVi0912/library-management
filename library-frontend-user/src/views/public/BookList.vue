<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import bookService from '@/services/book.service';
import catalogService from '@/services/catalog.service';
import BookFilterPanel from '@/components/book/BookFilterPanel.vue';
import BookCard from '@/components/book/BookCard.vue';
import BookRow from '@/components/book/BookRow.vue';
import Pagination from '@/components/common/Pagination.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();

// Dữ liệu danh mục tham chiếu cho bộ lọc
const categories = ref([]);
const authors = ref([]);
const publishers = ref([]);
const catalogLoaded = ref(false);

// Trạng thái danh sách sách
const books = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(true);
const error = ref(null);

// Trạng thái tìm kiếm & sắp xếp
const searchInput = ref('');
let searchTimer = null;

const sort = ref('relevance');
const viewMode = ref('grid'); // 'grid' | 'list'
const page = ref(1);
const limit = 12;

// Trạng thái bộ lọc
const filters = ref({
  category: '',
  author: '',
  publisher: '',
  year: '',
  available: false,
  minRating: '',
});

// Trạng thái offcanvas mobile
const offcanvasOpen = ref(false);

// Tính số lượng bộ lọc đang hoạt động
const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.value.category) count++;
  if (filters.value.author) count++;
  if (filters.value.publisher) count++;
  if (filters.value.year) count++;
  if (filters.value.available) count++;
  if (filters.value.minRating) count++;
  return count;
});

// Danh sách các chip bộ lọc đang áp dụng
const activeChips = computed(() => {
  const chips = [];

  if (searchInput.value.trim()) {
    chips.push({
      key: 'q',
      label: `Tìm: "${searchInput.value.trim()}"`,
      clear: () => setSearch(''),
    });
  }

  if (filters.value.category) {
    const cat = categories.value.find((c) => c._id === filters.value.category);
    chips.push({
      key: 'category',
      label: `Thể loại: ${cat ? cat.name : 'Đã chọn'}`,
      clear: () => updateSingleFilter('category', ''),
    });
  }

  if (filters.value.author) {
    const aut = authors.value.find((a) => a._id === filters.value.author);
    chips.push({
      key: 'author',
      label: `Tác giả: ${aut ? aut.name : 'Đã chọn'}`,
      clear: () => updateSingleFilter('author', ''),
    });
  }

  if (filters.value.publisher) {
    const pub = publishers.value.find((p) => p._id === filters.value.publisher);
    chips.push({
      key: 'publisher',
      label: `NXB: ${pub ? pub.name : 'Đã chọn'}`,
      clear: () => updateSingleFilter('publisher', ''),
    });
  }

  if (filters.value.year) {
    chips.push({
      key: 'year',
      label: `Năm: ${filters.value.year}`,
      clear: () => updateSingleFilter('year', ''),
    });
  }

  if (filters.value.available) {
    chips.push({
      key: 'available',
      label: 'Chỉ còn sách',
      clear: () => updateSingleFilter('available', false),
    });
  }

  if (filters.value.minRating) {
    chips.push({
      key: 'minRating',
      label: `Đánh giá: ≥ ${filters.value.minRating} ★`,
      clear: () => updateSingleFilter('minRating', ''),
    });
  }

  return chips;
});

// Sách đã qua lọc bổ sung ở client nếu cần (như minRating)
const displayedBooks = computed(() => {
  if (!filters.value.minRating) return books.value;
  const min = Number(filters.value.minRating);
  return books.value.filter((b) => (Number(b.ratingAvg) || 0) >= min);
});

// Tải dữ liệu danh mục để phục vụ bộ lọc
async function loadCatalogs() {
  if (catalogLoaded.value) return;
  try {
    const [catRes, autRes, pubRes] = await Promise.all([
      catalogService.getCategories({ all: true }),
      catalogService.getAuthors({ all: true }),
      catalogService.getPublishers({ all: true }),
    ]);
    categories.value = catRes.categories || [];
    authors.value = autRes.authors || [];
    publishers.value = pubRes.publishers || [];
    catalogLoaded.value = true;
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu danh mục cho bộ lọc:', err);
  }
}

// Đọc query parameters từ route
function syncStateFromQuery() {
  const q = route.query;

  searchInput.value = typeof q.q === 'string' ? q.q : '';
  sort.value = typeof q.sort === 'string' && ['relevance', 'new', 'popular', 'az'].includes(q.sort)
    ? q.sort
    : (q.q ? 'relevance' : 'new');
  viewMode.value = q.view === 'list' ? 'list' : 'grid';
  page.value = Math.max(1, parseInt(q.page, 10) || 1);

  filters.value = {
    category: typeof q.category === 'string' ? q.category : '',
    author: typeof q.author === 'string' ? q.author : '',
    publisher: typeof q.publisher === 'string' ? q.publisher : '',
    year: q.year ? parseInt(q.year, 10) || '' : '',
    available: q.available === 'true' || q.available === '1',
    minRating: q.minRating ? parseInt(q.minRating, 10) || '' : '',
  };
}

// Đẩy state hiện tại lên URL Query
function pushQueryToRoute() {
  const query = {};

  if (searchInput.value.trim()) query.q = searchInput.value.trim();
  if (filters.value.category) query.category = filters.value.category;
  if (filters.value.author) query.author = filters.value.author;
  if (filters.value.publisher) query.publisher = filters.value.publisher;
  if (filters.value.year) query.year = String(filters.value.year);
  if (filters.value.available) query.available = 'true';
  if (filters.value.minRating) query.minRating = String(filters.value.minRating);
  if (sort.value && sort.value !== 'new') query.sort = sort.value;
  if (viewMode.value !== 'grid') query.view = viewMode.value;
  if (page.value > 1) query.page = String(page.value);

  router.replace({ query }).catch(() => {});
}

// Tải danh sách sách từ backend API
async function fetchBooks() {
  loading.value = true;
  error.value = null;

  try {
    const params = {
      page: page.value,
      limit,
    };

    if (searchInput.value.trim()) params.q = searchInput.value.trim();
    if (filters.value.category) params.category = filters.value.category;
    if (filters.value.author) params.author = filters.value.author;
    if (filters.value.publisher) params.publisher = filters.value.publisher;
    if (filters.value.year) params.year = filters.value.year;
    if (filters.value.available) params.available = true;
    if (sort.value) params.sort = sort.value;

    const res = await bookService.listBooks(params);
    books.value = res.books || [];
    total.value = res.meta?.total || books.value.length;
    totalPages.value = res.meta?.totalPages || 1;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Không thể tải danh sách sách';
  } finally {
    loading.value = false;
  }
}

// Xử lý thay đổi tìm kiếm debounce
function handleSearchInput(event) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchInput.value = event.target.value;
    page.value = 1;
    pushQueryToRoute();
    fetchBooks();
  }, 350);
}

function setSearch(val) {
  searchInput.value = val;
  page.value = 1;
  pushQueryToRoute();
  fetchBooks();
}

function handleSortChange(newSort) {
  sort.value = newSort;
  page.value = 1;
  pushQueryToRoute();
  fetchBooks();
}

function handleViewModeChange(mode) {
  viewMode.value = mode;
  pushQueryToRoute();
}

function handleFiltersUpdate(newFilters) {
  filters.value = { ...newFilters };
  page.value = 1;
  offcanvasOpen.value = false;
  pushQueryToRoute();
  fetchBooks();
}

function updateSingleFilter(key, value) {
  filters.value[key] = value;
  page.value = 1;
  pushQueryToRoute();
  fetchBooks();
}

function resetAllFilters() {
  searchInput.value = '';
  filters.value = {
    category: '',
    author: '',
    publisher: '',
    year: '',
    available: false,
    minRating: '',
  };
  sort.value = 'new';
  page.value = 1;
  offcanvasOpen.value = false;
  pushQueryToRoute();
  fetchBooks();
}

function changePage(newPage) {
  page.value = newPage;
  pushQueryToRoute();
  fetchBooks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleAddToCart(book) {
  if (!book?._id) return;
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để mượn sách.');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
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
    router.push({ name: 'login', query: { redirect: route.fullPath } });
  } else {
    toast.error(result.message || 'Không thể thêm vào giỏ mượn');
  }
}

function handleQuickAction(action) {
  const label = action === 'cart' ? 'Giỏ mượn' : 'Kệ sách';
  toast.info(`Tính năng ${label} sẽ được kết nối trong task tương ứng.`);
}

// Watch query thay đổi (ví dụ khi user bấm Back/Forward trình duyệt hoặc search từ Navbar)
watch(
  () => route.query,
  () => {
    syncStateFromQuery();
    fetchBooks();
  }
);

onMounted(async () => {
  await loadCatalogs();
  syncStateFromQuery();
  fetchBooks();
});
</script>

<template>
  <main class="book-list-shell">
    <div class="book-list-page container py-4">
      <!-- Breadcrumb -->
      <nav
        aria-label="breadcrumb"
        class="mb-3"
      >
        <ol class="breadcrumb mb-0 small">
          <li class="breadcrumb-item">
            <RouterLink
              :to="{ name: 'home' }"
              class="text-decoration-none text-secondary"
            >
              Trang chủ
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active text-dark fw-semibold"
            aria-current="page"
          >
            Danh mục sách
          </li>
        </ol>
      </nav>

      <!-- Header & Search Toolbar -->
      <header class="book-list-header mb-4">
        <div class="row align-items-center g-3">
          <div class="col-12 col-md-5">
            <h1 class="h3 fw-bold mb-1">
              <template v-if="searchInput.trim()">
                Kết quả tìm kiếm cho "{{ searchInput.trim() }}"
              </template>
              <template v-else>
                Khám phá kho sách
              </template>
            </h1>
            <p class="text-secondary small mb-0">
              <span v-if="loading">Đang cập nhật số liệu...</span>
              <span v-else>Tìm thấy <strong>{{ total.toLocaleString('vi-VN') }}</strong> đầu sách</span>
            </p>
          </div>

          <div class="col-12 col-md-7">
            <div class="d-flex flex-wrap align-items-center justify-content-md-end gap-2">
              <!-- Ô tìm kiếm trang danh mục -->
              <div class="search-input-wrap">
                <div class="input-group">
                  <span class="input-group-text catalog-search-icon border-end-0">
                    <i
                      class="bi bi-search"
                      aria-hidden="true"
                    />
                  </span>
                  <input
                    type="text"
                    class="form-control border-start-0 ps-0"
                    placeholder="Tìm theo tên sách, tác giả..."
                    :value="searchInput"
                    aria-label="Tìm kiếm sách trong danh mục"
                    @input="handleSearchInput"
                  >
                  <button
                    v-if="searchInput"
                    class="btn btn-outline-secondary border-start-0"
                    type="button"
                    title="Xóa từ khóa"
                    @click="setSearch('')"
                  >
                    <i
                      class="bi bi-x"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <!-- Nút bật bộ lọc trên Mobile -->
              <button
                type="button"
                class="btn btn-outline-primary d-lg-none d-inline-flex align-items-center gap-2"
                @click="offcanvasOpen = true"
              >
                <i
                  class="bi bi-funnel"
                  aria-hidden="true"
                />
                <span>Bộ lọc</span>
                <span
                  v-if="activeFilterCount"
                  class="badge bg-primary rounded-pill"
                >{{ activeFilterCount }}</span>
              </button>

              <!-- Sắp xếp -->
              <div class="sort-select-wrap">
                <label
                  for="sort-select"
                  class="visually-hidden"
                >Sắp xếp theo</label>
                <select
                  id="sort-select"
                  class="form-select"
                  :value="sort"
                  @change="handleSortChange($event.target.value)"
                >
                  <option
                    v-if="searchInput.trim()"
                    value="relevance"
                  >
                    Phù hợp nhất
                  </option>
                  <option value="new">
                    Mới nhất
                  </option>
                  <option value="popular">
                    Mượn nhiều nhất
                  </option>
                  <option value="az">
                    Tên A → Z
                  </option>
                </select>
              </div>

              <!-- Nút chuyển chế độ xem Grid / List -->
              <div
                class="btn-group d-none d-sm-inline-flex"
                role="group"
                aria-label="Chế độ hiển thị"
              >
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :class="{ active: viewMode === 'grid' }"
                  title="Xem dạng lưới"
                  aria-label="Chuyển sang xem dạng lưới"
                  @click="handleViewModeChange('grid')"
                >
                  <i
                    class="bi bi-grid-fill"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :class="{ active: viewMode === 'list' }"
                  title="Xem dạng danh sách"
                  aria-label="Chuyển sang xem dạng danh sách"
                  @click="handleViewModeChange('list')"
                >
                  <i
                    class="bi bi-list-ul"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Dải Chip bộ lọc đang kích hoạt -->
        <div
          v-if="activeChips.length"
          class="active-filter-chips d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top"
        >
          <span class="small text-secondary fw-semibold me-1">Đang lọc theo:</span>
          <span
            v-for="chip in activeChips"
            :key="chip.key"
            class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill py-2 px-3 d-inline-flex align-items-center gap-2"
          >
            <span>{{ chip.label }}</span>
            <button
              type="button"
              class="btn-close btn-close-sm p-0 m-0"
              :aria-label="`Xóa bộ lọc ${chip.label}`"
              style="font-size: 0.65rem;"
              @click="chip.clear"
            />
          </span>
          <button
            type="button"
            class="btn btn-sm btn-link text-danger text-decoration-none p-0 ms-auto small"
            @click="resetAllFilters"
          >
            Xóa tất cả
          </button>
        </div>
      </header>

      <!-- Nội dung chính: 2 cột (Sidebar Filter + Content) -->
      <div class="row g-4">
        <!-- Cột trái: Bộ lọc Desktop -->
        <div class="col-lg-3 d-none d-lg-block">
          <div class="sticky-top filter-sticky-wrap">
            <BookFilterPanel
              :filters="filters"
              :categories="categories"
              :authors="authors"
              :publishers="publishers"
              id-prefix="desktop-filter"
              :loading="loading"
              @update:filters="handleFiltersUpdate"
              @reset="resetAllFilters"
            />
          </div>
        </div>

        <!-- Cột phải: Danh sách Sách -->
        <div class="col-12 col-lg-9">
          <!-- Trạng thái Đang tải -->
          <div
            v-if="loading"
            class="row row-cols-2 row-cols-sm-3 row-cols-xl-4 g-3"
            aria-busy="true"
            aria-label="Đang tải danh sách sách"
          >
            <div
              v-for="n in 8"
              :key="n"
              class="col"
            >
              <SkeletonCard />
            </div>
          </div>

          <!-- Trạng thái Lỗi -->
          <div
            v-else-if="error"
            class="alert alert-danger d-flex align-items-center justify-content-between p-3"
            role="alert"
          >
            <div class="d-flex align-items-center gap-2">
              <i
                class="bi bi-exclamation-triangle-fill flex-shrink-0"
                aria-hidden="true"
              />
              <div>{{ error }}</div>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              @click="fetchBooks"
            >
              Thử lại
            </button>
          </div>

          <!-- Trạng thái Rỗng -->
          <div
            v-else-if="displayedBooks.length === 0"
            class="card border-0 shadow-sm rounded-3 py-4"
          >
            <EmptyState
              title="Không tìm thấy sách phù hợp"
              description="Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các tiêu chí lọc."
              icon="bi-journal-x"
              :action-label="activeChips.length ? 'Xóa tất cả bộ lọc' : ''"
              @action="resetAllFilters"
            />
          </div>

          <!-- Trạng thái Có kết quả -->
          <div v-else>
            <!-- Chế độ Grid (Lưới) -->
            <div
              v-if="viewMode === 'grid'"
              class="row row-cols-2 row-cols-sm-3 row-cols-xl-4 g-3"
            >
              <div
                v-for="book in displayedBooks"
                :key="book._id"
                class="col"
              >
                <BookCard
                  :book="book"
                  @add-to-cart="handleAddToCart"
                  @add-to-shelf="handleQuickAction('shelf')"
                />
              </div>
            </div>

            <!-- Chế độ List (Danh sách dọc) -->
            <div
              v-else
              class="d-flex flex-column gap-3"
            >
              <BookRow
                v-for="book in displayedBooks"
                :key="book._id"
                :book="book"
                @add-to-cart="handleAddToCart"
                @add-to-shelf="handleQuickAction('shelf')"
              />
            </div>

            <!-- Phân trang -->
            <div class="mt-4 pt-2 d-flex justify-content-center">
              <Pagination
                :page="page"
                :total-pages="totalPages"
                :total="total"
                @update:page="changePage"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Offcanvas Mobile: Bộ lọc tìm kiếm -->
      <div
        class="offcanvas offcanvas-start"
        :class="{ show: offcanvasOpen }"
        tabindex="-1"
        aria-labelledby="mobile-filter-title"
        :style="{ visibility: offcanvasOpen ? 'visible' : 'hidden' }"
      >
        <div class="offcanvas-header border-bottom">
          <h5
            id="mobile-filter-title"
            class="offcanvas-title fw-bold"
          >
            <i
              class="bi bi-funnel-fill text-primary me-2"
              aria-hidden="true"
            />Bộ lọc tìm kiếm
          </h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Đóng bộ lọc"
            @click="offcanvasOpen = false"
          />
        </div>
        <div class="offcanvas-body p-0">
          <BookFilterPanel
            :filters="filters"
            :categories="categories"
            :authors="authors"
            :publishers="publishers"
            id-prefix="mobile-filter"
            :loading="loading"
            @update:filters="handleFiltersUpdate"
            @reset="resetAllFilters"
          />
        </div>
      </div>
      <!-- Backdrop cho Offcanvas mobile -->
      <div
        v-if="offcanvasOpen"
        class="offcanvas-backdrop fade show"
        @click="offcanvasOpen = false"
      />
    </div>
  </main>
</template>

<style scoped>
.book-list-shell {
  min-height: 100%;
  background: #041426;
  color: #e6f4fb;
}

.book-list-page {
  min-height: inherit;
}

.book-list-page :deep(.breadcrumb-item),
.book-list-page :deep(.breadcrumb-item.active) { color: #aac1ce !important; }
.book-list-page :deep(.breadcrumb-item a) { color: #61dce8 !important; }
.book-list-page :deep(.breadcrumb-item + .breadcrumb-item::before) { color: #648194; }
.book-list-header { padding: 1.25rem; border: 1px solid rgb(105 164 190 / 17%); border-radius: 1rem; background: linear-gradient(145deg, #081d31, #06182a); box-shadow: 0 .75rem 2rem rgb(0 8 20 / 18%); }
.book-list-header h1 { color: #f2f9fc; }
.book-list-header p { color: #9eb4c3 !important; }
.book-list-header .input-group-text,
.book-list-header .form-control,
.book-list-header .form-select { border-color: rgb(119 177 202 / 24%); background-color: #06172a; color: #e6f4fb; }
.book-list-header .form-control::placeholder { color: #91aaba; }
.book-list-header .input-group-text { color: #60dce8 !important; }
.book-list-header .btn-outline-secondary { border-color: rgb(119 177 202 / 30%); color: #b9cfdb; }
.book-list-header .btn-outline-secondary:hover,
.book-list-header .btn-outline-secondary.active { border-color: #35cddd; background: #0d3a50; color: #72e5ed; }
.book-list-header .btn-outline-primary { border-color: #25bfd0; color: #6de4ed; }
.book-list-header .btn-outline-primary:hover { background: #0d3a50; color: #a5f3fc; }
.book-list-header .active-filter-chips { border-color: rgb(119 177 202 / 18%) !important; }
.book-list-header .active-filter-chips > span { color: #b9cfdb !important; }
.book-list-header .active-filter-chips .badge { border-color: rgb(72 210 228 / 24%) !important; background: #10364b !important; color: #8beaf0 !important; }
.book-list-header .active-filter-chips .btn-link { color: #ff9b9b !important; }
.book-list-page :deep(.book-filter-panel) { border: 1px solid rgb(105 164 190 / 20%) !important; background: #081d31; color: #d5e8f1; }
.book-list-page :deep(.book-filter-panel .card-header),
.book-list-page :deep(.book-filter-panel .card-footer) { border-color: rgb(119 177 202 / 18%) !important; background: #0a2338 !important; color: #e8f4fa; }
.book-list-page :deep(.book-filter-panel .card-body) { background: #081d31; }
.book-list-page :deep(.book-filter-panel h2),
.book-list-page :deep(.book-filter-panel .form-check-label),
.book-list-page :deep(.book-filter-panel .text-body) { color: #d5e8f1 !important; }
.book-list-page :deep(.book-filter-panel .form-label),
.book-list-page :deep(.book-filter-panel .form-text),
.book-list-page :deep(.book-filter-panel .text-secondary) { color: #9eb4c3 !important; }
.book-list-page :deep(.book-filter-panel .form-select),
.book-list-page :deep(.book-filter-panel .form-control) { border-color: rgb(119 177 202 / 24%); background-color: #06172a; color: #e6f4fb; }
.book-list-page :deep(.book-filter-panel .form-select:focus),
.book-list-page :deep(.book-filter-panel .form-control:focus) { border-color: #35cddd; box-shadow: 0 0 0 .2rem rgb(40 201 216 / 15%); }
.book-list-page :deep(.book-filter-panel .form-check-input) { border-color: #58778c; background-color: #06172a; }
.book-list-page :deep(.book-filter-panel .form-check-input:checked) { border-color: #25c7d5; background-color: #17b9ca; }
.book-list-page :deep(.book-card) { border-color: rgb(119 177 202 / 18%); border-radius: .8rem; background: #081d31; box-shadow: 0 .5rem 1.5rem rgb(0 8 20 / 18%); }
.book-list-page :deep(.book-card-title) { color: #e8f4fa; }
.book-list-page :deep(.book-card-title:hover) { color: #61dce8; }
.book-list-page :deep(.book-card-author),
.book-list-page :deep(.rating-stars-count) { color: #9eb4c3; }
.book-list-page :deep(.rating-stars-value) { color: #e8f4fa; }
.book-list-page :deep(.book-row) { border-color: rgb(119 177 202 / 18%); background: #081d31; color: #d5e8f1; }
.book-list-page :deep(.book-row-title) { color: #e8f4fa; }
.book-list-page :deep(.book-row-title:hover) { color: #61dce8; }
.book-list-page :deep(.book-row-author) { color: #9eb4c3; }
.book-list-page :deep(.book-row .btn-outline-primary) { border-color: #25bfd0; color: #6de4ed; }
.book-list-page :deep(.book-row .btn-outline-secondary) { border-color: rgb(119 177 202 / 28%); color: #b9cfdb; }
.book-list-page :deep(.book-row .btn-outline-primary:hover),
.book-list-page :deep(.book-row .btn-outline-secondary:hover) { background: #0d3a50; color: #a5f3fc; }
.book-list-page :deep(.card:has(.empty-state)) { border: 1px solid rgb(119 177 202 / 18%) !important; background: #081d31; }
.book-list-page :deep(.empty-state h2) { color: #e8f4fa; }
.book-list-page :deep(.empty-state-icon) { color: #61dce8; }
.book-list-page :deep(.page-link) { border-color: rgb(119 177 202 / 20%); background: #081d31; color: #b9cfdb; }
.book-list-page :deep(.page-item.active .page-link) { border-color: #20bfd0; background: #0d8299; color: #fff; }
.book-list-page :deep(.page-item.disabled .page-link) { background: #06172a; color: #60798a; }
.book-list-page :deep(.placeholder) { background-color: #14344e; }
.book-list-page :deep(.offcanvas) { background: #061a2d; color: #d5e8f1; }
.book-list-page :deep(.offcanvas-header) { border-color: rgb(119 177 202 / 18%) !important; }
.book-list-page :deep(.offcanvas .btn-close) { filter: invert(1); }
.book-list-page :deep(.alert-danger) { border-color: rgb(248 113 113 / 25%); background: #351d2a; color: #ffd1d1; }

.search-input-wrap {
  flex: 1 1 26rem;
  min-width: min(100%, 18rem);
  max-width: 32rem;
}

.book-list-header .catalog-search-icon {
  border-color: rgb(119 177 202 / 24%);
  background: #06172a;
  color: #60dce8;
}

.sort-select-wrap select {
  min-width: 9rem;
}

.filter-sticky-wrap {
  top: 5rem;
  z-index: 10;
}

.breadcrumb-item + .breadcrumb-item::before {
  content: "›";
  font-size: 1.1rem;
  line-height: 1;
  vertical-align: middle;
}
</style>

