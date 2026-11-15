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
import forumService from '@/services/forum.service';
import ThreadItem from '@/components/forum/ThreadItem.vue';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();
const homeBooks = ref({ newest: [], popular: [], topRated: [] });
const categories = ref([]);
const featuredThreads = ref([]);
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
const quickCategories = computed(() => categories.value.slice(0, 5));
let searchTimer;
let suggestionRequestId = 0;

async function loadHome() {
  loading.value = true;
  error.value = '';
  try {
    const [booksResult, categoriesResult, forumResult] = await Promise.all([
      bookService.getHomeBooks(),
      catalogService.getCategories({ all: true }),
      forumService.getThreads({ sort: 'popular', limit: 3 }).catch(() => ({ threads: [] })),
    ]);
    homeBooks.value = {
      newest: booksResult.newest || [],
      popular: booksResult.popular || [],
      topRated: booksResult.topRated || [],
    };
    categories.value = categoriesResult.categories || [];
    featuredThreads.value = forumResult?.threads || [];
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

function getCategoryMeta(category) {
  const normalizedName = String(category?.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi-VN');
  const categoriesMeta = [
    { match: ['cong nghe', 'lap trinh', 'ky thuat'], icon: 'bi-cpu', description: 'Khám phá lập trình, phần mềm và những ý tưởng công nghệ mới.' },
    { match: ['kinh doanh', 'kinh te', 'tai chinh'], icon: 'bi-graph-up-arrow', description: 'Kiến thức quản trị, khởi nghiệp và phát triển sự nghiệp.' },
    { match: ['khoa hoc', 'tu nhien'], icon: 'bi-stars', description: 'Tìm hiểu thế giới tự nhiên qua những trang sách khám phá.' },
    { match: ['van hoc', 'tieu thuyet', 'truyen'], icon: 'bi-feather', description: 'Những câu chuyện và tác phẩm đưa trí tưởng tượng đi xa.' },
    { match: ['lich su', 'dia ly'], icon: 'bi-globe-americas', description: 'Du hành qua các thời đại, vùng đất và nền văn minh.' },
    { match: ['thieu nhi', 'tre em'], icon: 'bi-balloon', description: 'Những câu chuyện nuôi dưỡng trí tò mò và niềm vui đọc sách.' },
    { match: ['tam ly', 'ky nang', 'phat trien ban than'], icon: 'bi-compass', description: 'Gợi mở góc nhìn mới và đồng hành cùng bạn trưởng thành.' },
  ];
  const match = categoriesMeta.find((item) => item.match.some((keyword) => normalizedName.includes(keyword)));
  return {
    icon: match?.icon || 'bi-book-half',
    description: category?.description || match?.description || 'Mở rộng hiểu biết và tìm cảm hứng mới qua những cuốn sách trong chủ đề này.',
  };
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
        <span class="home-search-eyebrow"><i
          class="bi bi-water me-2"
          aria-hidden="true"
        />Thư viện trực tuyến · Mở lối tri thức</span>
        <h1 id="home-search-title">
          Khám phá đại dương sách<br><span>theo cách của bạn</span>
        </h1>
        <p class="home-search-description">
          Tìm cuốn sách tiếp theo theo tên sách, tác giả hoặc ISBN và bắt đầu hành trình khám phá của riêng bạn.
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
            <i
              class="bi bi-search home-search-icon"
              aria-hidden="true"
            />
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
              placeholder="Nhập tên sách, tác giả hoặc ISBN..."
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
            class="btn home-search-button"
            type="submit"
          >
            <i
              class="bi bi-search me-2"
              aria-hidden="true"
            />Tìm sách
          </button>
        </form>
        <div
          v-if="quickCategories.length"
          class="home-quick-categories"
          aria-label="Khám phá nhanh thể loại"
        >
          <span class="home-quick-label"><i
            class="bi bi-lightning-charge-fill"
            aria-hidden="true"
          /> Khám phá nhanh</span>
          <button
            v-for="category in quickCategories"
            :key="category._id"
            type="button"
            @click="openCategory(category)"
          >
            {{ category.name }}
          </button>
        </div>
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
        <section
          class="home-category-section mb-5"
          aria-labelledby="home-categories-heading"
        >
          <header class="home-content-heading">
            <div>
              <p class="home-section-eyebrow">
                Khám phá theo lĩnh vực
              </p>
              <h2
                id="home-categories-heading"
                class="home-section-title mb-1"
              >
                Lãnh địa tri thức
              </h2>
              <p class="home-section-description mb-0">
                Chọn một chủ đề để tìm cuốn sách khơi nguồn cảm hứng tiếp theo.
              </p>
            </div>
            <RouterLink
              :to="{ name: 'books' }"
              class="home-view-all"
            >
              Tất cả thể loại <i
                class="bi bi-arrow-right"
                aria-hidden="true"
              />
            </RouterLink>
          </header>
          <div
            v-if="categories.length"
            class="home-category-grid"
          >
            <button
              v-for="category in categories"
              :key="category._id"
              class="home-category-card"
              type="button"
              @click="openCategory(category)"
            >
              <span class="home-category-icon"><i
                class="bi"
                :class="getCategoryMeta(category).icon"
                aria-hidden="true"
              /></span>
              <span class="home-category-copy">
                <strong>{{ category.name }}</strong>
                <span>{{ getCategoryMeta(category).description }}</span>
              </span>
              <i
                class="bi bi-arrow-up-right home-category-arrow"
                aria-hidden="true"
              />
            </button>
          </div>
          <p
            v-else
            class="home-category-empty"
          >
            Chưa có thể loại công khai.
          </p>
        </section>

        <BookCarousel
          v-if="homeBooks.newest.length"
          class="mb-5 home-carousel-theme"
          title="Sách mới"
          :books="homeBooks.newest"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />
        <BookCarousel
          v-if="homeBooks.popular.length"
          class="mb-5 home-carousel-theme"
          title="Mượn nhiều"
          :books="homeBooks.popular"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />
        <BookCarousel
          v-if="homeBooks.topRated.length"
          class="mb-5 home-carousel-theme"
          title="Đánh giá cao"
          :books="homeBooks.topRated"
          @add-to-cart="handleAddToCart"
          @add-to-shelf="handleQuickAction('shelf')"
        />

        <div class="row g-3">
          <div class="col-md-6">
            <section
              class="home-forum-section home-surface h-100 p-3 rounded-3"
              aria-labelledby="home-forum-heading"
            >
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h2
                  id="home-forum-heading"
                  class="h5 fw-bold mb-0 d-flex align-items-center gap-2"
                >
                  <i
                    class="bi bi-chat-quote-fill"
                    aria-hidden="true"
                  />
                  <span>Chủ đề diễn đàn nổi bật</span>
                </h2>
                <RouterLink
                  :to="{ name: 'forum' }"
                  class="home-view-all text-decoration-none fs-xs fw-medium d-inline-flex align-items-center gap-1"
                >
                  <span>Xem tất cả</span>
                  <i
                    class="bi bi-arrow-right"
                    aria-hidden="true"
                  />
                </RouterLink>
              </div>

              <div
                v-if="featuredThreads.length > 0"
                class="featured-threads-list"
              >
                <ThreadItem
                  v-for="thread in featuredThreads"
                  :key="thread._id"
                  :thread="thread"
                  compact
                  :show-category="true"
                />
              </div>

              <p
                v-else
                class="text-secondary mb-0 fs-sm"
              >
                Chưa có chủ đề thảo luận nào. Hãy ghé thăm
                <RouterLink :to="{ name: 'forum' }">
                  Diễn đàn
                </RouterLink>
                để mở đầu chủ đề đầu tiên!
              </p>
            </section>
          </div>
          <div class="col-md-6">
            <section
              class="home-placeholder-section home-surface h-100"
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
.home-page { min-height: 100%; background: #041426; color: #e6f4fb; }
.home-search-section { position: relative; display: grid; min-height: clamp(28rem, 56vw, 36rem); place-items: center; overflow: visible; padding: clamp(3.5rem, 8vw, 6.5rem) 0 clamp(3rem, 6vw, 5rem); isolation: isolate; background: #03172a; }
.home-search-section::before,
.home-search-section::after { position: absolute; z-index: -1; content: ''; inset: 0; pointer-events: none; }
.home-search-section::before { background-image: linear-gradient(180deg, rgb(2 13 25 / 34%), rgb(2 13 25 / 20%) 46%, #041426 100%), url('@/assets/images/ocean-home-search.png'); background-position: center 44%; background-size: cover; }
.home-search-section::after { background: radial-gradient(ellipse at 50% 44%, rgb(4 20 38 / 14%), rgb(4 20 38 / 48%) 72%); }
.home-search-content { position: relative; max-width: 62rem; text-align: center; }
.home-search-eyebrow,
.home-section-eyebrow { display: inline-flex; align-items: center; color: #6de7ef; font-size: .76rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.home-search-eyebrow { margin-bottom: 1.15rem; padding: .45rem .8rem; border: 1px solid rgb(91 212 230 / 24%); border-radius: 999px; background: rgb(3 26 45 / 60%); backdrop-filter: blur(8px); }
.home-search-content h1 { margin: 0 auto 1rem; color: #f5fbff; font-size: clamp(2.25rem, 5vw, 4rem); font-weight: 800; letter-spacing: -.045em; line-height: 1.08; text-shadow: 0 .25rem 2rem rgb(0 9 20 / 55%); }
.home-search-content h1 span { color: #6ce4ed; }
.home-search-description { max-width: 43rem; margin: 0 auto 1.75rem; color: #d0e4ef; font-size: clamp(.98rem, 1.5vw, 1.12rem); line-height: 1.7; text-shadow: 0 2px 12px rgb(0 9 20 / 70%); }
.home-search-form { display: flex; align-items: stretch; gap: .75rem; max-width: 49rem; margin: 0 auto; padding: .4rem; border: 1px solid rgb(66 215 232 / 56%); border-radius: .9rem; background: rgb(3 19 34 / 88%); box-shadow: 0 0 0 .2rem rgb(44 204 224 / 10%), 0 1rem 2.5rem rgb(0 8 20 / 35%); backdrop-filter: blur(12px); }
.home-search-input-wrap { position: relative; flex: 1; min-width: 0; }
.home-search-icon { position: absolute; z-index: 1; top: 50%; left: 1rem; color: #59dce9; font-size: 1rem; pointer-events: none; transform: translateY(-50%); }
.home-search-input { min-height: 3.2rem; padding-left: 2.8rem; border: 0; border-radius: .65rem; background: transparent; color: #f3fbff; font-size: 1rem; text-align: left; box-shadow: none; }
.home-search-input::placeholder { color: #91aaba; }
.home-search-input:focus { background: transparent; color: #f3fbff; box-shadow: none; }
.home-search-input::-webkit-search-cancel-button { filter: invert(1); }
.home-search-input-wrap:has(.home-suggestions) { z-index: 12; }
.home-search-input-wrap:has(.home-suggestions) .home-search-input { border-radius: .65rem .65rem 0 0; }
.home-search-button { min-width: 8.5rem; border: 0; border-radius: .65rem; background: linear-gradient(105deg, #21cabb, #29c3e9); color: #03253a; font-weight: 800; }
.home-search-button:hover { background: linear-gradient(105deg, #45e0cc, #5ed7f2); color: #03253a; }
.home-quick-categories { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
.home-quick-label,
.home-quick-categories button { display: inline-flex; align-items: center; gap: .35rem; min-height: 2rem; padding: .3rem .7rem; border: 1px solid rgb(119 177 202 / 20%); border-radius: 999px; background: rgb(4 25 43 / 72%); color: #c7dbe7; font-size: .78rem; backdrop-filter: blur(8px); }
.home-quick-label { color: #66dfe9; }
.home-quick-categories button { cursor: pointer; transition: border-color .18s ease, color .18s ease, background .18s ease; }
.home-quick-categories button:hover { border-color: #36cddd; background: rgb(11 70 91 / 76%); color: #fff; }
.home-category-section { padding-bottom: .75rem; }
.home-content-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.home-section-eyebrow { margin-bottom: .4rem; font-size: .68rem; }
.home-section-title { color: #f4fbff; font-size: clamp(1.4rem, 2.4vw, 1.8rem); font-weight: 800; letter-spacing: -.025em; }
.home-section-description { color: #9eb5c5; font-size: .9rem; }
.home-view-all { display: inline-flex; align-items: center; gap: .45rem; color: #5edce9; font-size: .86rem; text-decoration: none; white-space: nowrap; }
.home-view-all:hover { color: #a5f3fc; }
.home-category-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .85rem; }
.home-category-card { position: relative; display: flex; min-height: 9.5rem; align-items: flex-start; gap: .9rem; padding: 1.15rem; overflow: hidden; border: 1px solid rgb(105 164 190 / 17%); border-radius: .9rem; background: linear-gradient(145deg, #0a2135, #071a2d); color: #e8f4fa; text-align: left; cursor: pointer; transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
.home-category-card::after { position: absolute; right: -2rem; bottom: -3rem; width: 7rem; height: 7rem; border-radius: 50%; background: rgb(23 184 205 / 7%); content: ''; transition: transform .2s ease; }
.home-category-card:hover,
.home-category-card:focus-visible { border-color: rgb(61 209 225 / 58%); box-shadow: 0 .75rem 2rem rgb(0 8 20 / 28%); transform: translateY(-3px); }
.home-category-card:hover::after { transform: scale(1.4); }
.home-category-icon { display: grid; width: 2.65rem; height: 2.65rem; flex: 0 0 2.65rem; place-items: center; border: 1px solid rgb(74 214 229 / 20%); border-radius: .75rem; background: linear-gradient(145deg, rgb(22 192 210 / 18%), rgb(20 65 92 / 48%)); color: #64e1eb; font-size: 1.2rem; }
.home-category-copy { display: grid; gap: .45rem; min-width: 0; padding-top: .1rem; }
.home-category-copy strong { color: #f0f8fc; font-size: .95rem; line-height: 1.35; }
.home-category-copy > span { color: #9eb4c3; font-size: .78rem; line-height: 1.5; }
.home-category-arrow { position: absolute; right: 1rem; bottom: .9rem; color: #55d8e6; font-size: .9rem; }
.home-category-empty { color: #9eb4c3; }
.home-carousel-theme :deep(.book-carousel-heading) { margin-bottom: .85rem; }
.home-carousel-theme :deep(.book-carousel-heading h2) { color: #f4fbff; font-size: 1.3rem; }
.home-carousel-theme :deep(.book-carousel-controls .btn) { border-color: rgb(119 177 202 / 28%); color: #b9cfdb; }
.home-carousel-theme :deep(.book-carousel-controls .btn:hover) { border-color: #35cddd; background: #0d3a50; color: #72e5ed; }
.home-carousel-theme :deep(.book-card) { border-color: rgb(119 177 202 / 18%); border-radius: .8rem; background: #081d31; box-shadow: 0 .5rem 1.5rem rgb(0 8 20 / 18%); }
.home-carousel-theme :deep(.book-card:hover),
.home-carousel-theme :deep(.book-card:focus-within) { box-shadow: 0 .75rem 2rem rgb(0 8 20 / 36%); }
.home-carousel-theme :deep(.book-card-cover-wrap) { background: #0c263d; }
.home-carousel-theme :deep(.book-card-content) { padding: .8rem; }
.home-carousel-theme :deep(.book-card-title) { color: #e8f4fa; }
.home-carousel-theme :deep(.book-card-title:hover) { color: #61dce8; }
.home-carousel-theme :deep(.book-card-author),
.home-carousel-theme :deep(.rating-stars-count) { color: #9eb4c3; }
.home-carousel-theme :deep(.rating-stars-value) { color: #e8f4fa; }
.home-carousel-theme :deep(.book-card-action) { border-color: rgb(119 177 202 / 22%); background: #09253b; color: #67dfe9; }
.home-carousel-theme :deep(.book-card-action:hover) { background: #16aabd; color: #03172a; }
.home-surface { border: 1px solid rgb(105 164 190 / 17%); background: linear-gradient(145deg, #081d31, #06182a); box-shadow: 0 .75rem 2rem rgb(0 8 20 / 18%); }
.home-forum-section h2 { color: #edf7fb; }
.home-forum-section :deep(.thread-item) { border-color: rgb(119 177 202 / 18%) !important; background: #091f33 !important; color: #d5e8f1; }
.home-forum-section :deep(.thread-link) { color: #edf7fb !important; }
.home-forum-section :deep(.thread-link:hover) { color: #65dfe9 !important; }
.home-forum-section :deep(.thread-preview),
.home-forum-section :deep(.thread-meta) { color: #a9bfce !important; }
.home-forum-section :deep(.category-badge),
.home-forum-section :deep(.thread-item .bg-light) { border-color: rgb(119 177 202 / 18%) !important; background: #10334a !important; color: #c7dbe7 !important; }
.home-placeholder-section { border-radius: .9rem; padding: 1.25rem; }
.home-placeholder-section h2 { color: #edf7fb; font-size: 1.1rem; font-weight: 750; }
.home-placeholder-section p { color: #9eb4c3 !important; }
.home-loading .placeholder { background-color: #14344e; }
.home-category-skeleton { display: grid; min-height: 8rem; place-items: center; padding: .75rem; border: 1px solid rgb(105 164 190 / 17%); border-radius: .9rem; background: #0a2135; }
.home-suggestions { position: absolute; z-index: 20; top: calc(100% + .25rem); right: 0; left: 0; max-height: 20rem; overflow-y: auto; border: 1px solid rgb(105 164 190 / 25%); border-radius: 0 0 .75rem .75rem; background: #071c30; box-shadow: 0 .75rem 2rem rgb(0 8 20 / 40%); text-align: left; }
.home-suggestions > .list-group-item { border-color: rgb(119 177 202 / 14%); background: #071c30; color: #a9bfce !important; }
.home-suggestion { display: flex; flex-direction: column; gap: .15rem; border-color: rgb(119 177 202 / 14%); background: #071c30; color: #e3f2f8; }
.home-suggestion-title { font-weight: 650; }
.home-suggestion-author { color: #9eb4c3; font-size: .875rem; }
.home-suggestion.active { border-color: #148caa; background: #0d4660; color: white; }
.home-suggestion.active .home-suggestion-author { color: #c8eaf1; }

@media (max-width: 991.98px) { .home-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 575.98px) {
  .home-search-section { min-height: 30rem; padding: 3.5rem 0 3rem; }
  .home-search-section::before { background-position: 54% center; }
  .home-search-content h1 { font-size: clamp(2rem, 9vw, 3rem); }
  .home-search-description { max-width: 30rem; margin-bottom: 1.25rem; font-size: .95rem; }
  .home-search-form { flex-direction: column; gap: .4rem; padding: .45rem; }
  .home-search-input { min-height: 3rem; }
  .home-search-button { min-height: 3rem; width: 100%; }
  .home-quick-categories { gap: .4rem; }
  .home-quick-label,
  .home-quick-categories button { font-size: .72rem; }
  .home-content-heading { align-items: flex-start; flex-direction: column; }
  .home-category-grid { grid-template-columns: 1fr; gap: .65rem; }
  .home-category-card { min-height: 7rem; padding: .9rem; }
  .home-placeholder-section { min-height: 9rem; }
}

@media (prefers-reduced-motion: reduce) {
  .home-category-card,
  .home-category-card::after,
  .home-quick-categories button { transition: none; }
}
</style>
