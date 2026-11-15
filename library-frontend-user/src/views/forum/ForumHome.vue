<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import forumService from '@/services/forum.service';
import ThreadList from '@/components/forum/ThreadList.vue';
import Pagination from '@/components/common/Pagination.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const categories = ref([]);
const categoriesLoading = ref(true);

const threads = ref([]);
const threadsLoading = ref(true);
const meta = ref({ page: 1, limit: 10, total: 0, totalPages: 1 });

const currentSort = ref(route.query.sort || 'active');
const currentPage = ref(Number(route.query.page) || 1);
const searchQuery = ref(route.query.q || '');
const inputSearch = ref(route.query.q || '');

// Icon gợi ý cho từng chuyên mục dựa trên slug hoặc tên
function getCategoryIcon(cat) {
  const s = (cat.slug || '').toLowerCase();
  const n = (cat.name || '').toLowerCase();
  if (s.includes('gioi-thieu') || n.includes('giới thiệu')) return 'bi-journal-bookmark text-primary';
  if (s.includes('hoi-dap') || n.includes('hỏi đáp')) return 'bi-question-circle text-info';
  if (s.includes('review') || n.includes('cảm nhận')) return 'bi-star-half text-warning';
  if (s.includes('trao-doi') || n.includes('trao đổi')) return 'bi-arrow-left-right text-success';
  if (s.includes('gop-y') || n.includes('góp ý')) return 'bi-chat-heart text-danger';
  return 'bi-chat-dots text-secondary';
}

async function fetchCategories() {
  categoriesLoading.value = true;
  try {
    categories.value = await forumService.getCategories();
  } catch (err) {
    console.error('Lỗi khi tải chuyên mục diễn đàn:', err);
    categories.value = [];
  } finally {
    categoriesLoading.value = false;
  }
}

async function fetchThreads() {
  threadsLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: 10,
      sort: currentSort.value,
      q: searchQuery.value.trim() || undefined,
    };
    const res = await forumService.getThreads(params);
    threads.value = res.threads || [];
    meta.value = res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
  } catch (err) {
    console.error('Lỗi khi tải danh sách chủ đề:', err);
    threads.value = [];
    meta.value = { page: 1, limit: 10, total: 0, totalPages: 1 };
  } finally {
    threadsLoading.value = false;
  }
}

function handleTabChange(tab) {
  if (currentSort.value === tab) return;
  currentSort.value = tab;
  currentPage.value = 1;
  syncQuery();
  fetchThreads();
}

function handleSearch() {
  searchQuery.value = inputSearch.value.trim();
  currentPage.value = 1;
  syncQuery();
  fetchThreads();
}

function handleClearSearch() {
  inputSearch.value = '';
  searchQuery.value = '';
  currentPage.value = 1;
  syncQuery();
  fetchThreads();
}

function handlePageChange(newPage) {
  currentPage.value = newPage;
  syncQuery();
  fetchThreads();
  window.scrollTo({ top: 400, behavior: 'smooth' });
}

function syncQuery() {
  const query = {};
  if (currentSort.value && currentSort.value !== 'active') query.sort = currentSort.value;
  if (currentPage.value > 1) query.page = String(currentPage.value);
  if (searchQuery.value) query.q = searchQuery.value;

  router.replace({ query });
}

function handleCreateThread() {
  if (!authStore.isAuthenticated) {
    router.push({
      name: 'login',
      query: { redirect: '/forum/new' },
    });
    return;
  }
  router.push({ name: 'forum-new' });
}

watch(
  () => route.query,
  (newQuery) => {
    currentSort.value = newQuery.sort || 'active';
    currentPage.value = Number(newQuery.page) || 1;
    searchQuery.value = newQuery.q || '';
    inputSearch.value = newQuery.q || '';
  }
);

onMounted(() => {
  fetchCategories();
  fetchThreads();
});
</script>

<template>
  <div class="forum-home-page py-4">
    <div class="container">
      <!-- Forum Hero Header -->
      <section class="forum-hero p-4 p-md-5 rounded-4 mb-4 text-white position-relative overflow-hidden shadow-sm">
        <div class="row align-items-center g-3 position-relative z-1">
          <div class="col-lg-8">
            <div class="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill hero-pill mb-2 fs-xs">
              <i
                class="bi bi-chat-quote-fill"
                aria-hidden="true"
              />
              <span>Cộng đồng yêu sách thư viện</span>
            </div>
            <h1 class="display-6 fw-bold mb-2">
              Diễn đàn Thư viện
            </h1>
            <p class="lead fs-6 mb-0 text-white-50">
              Không gian thảo luận, kết nối bạn đọc, chia sẻ cảm nhận về sách và lan tỏa văn hóa đọc.
            </p>
          </div>

          <div class="col-lg-4 text-lg-end">
            <div class="d-flex flex-wrap justify-content-lg-end gap-2">
              <RouterLink
                v-if="authStore.isAuthenticated"
                :to="{ name: 'forum-my' }"
                class="btn btn-outline-light btn-lg px-4 py-2.5 fw-semibold d-inline-flex align-items-center gap-2"
              >
                <i
                  class="bi bi-person-lines-fill"
                  aria-hidden="true"
                />
                <span>Bài đăng của tôi</span>
              </RouterLink>
              <button
                type="button"
                class="btn btn-light btn-lg px-4 py-2.5 fw-semibold text-primary shadow-sm d-inline-flex align-items-center gap-2"
                @click="handleCreateThread"
              >
                <i
                  class="bi bi-pencil-square"
                  aria-hidden="true"
                />
                <span>Đăng chủ đề mới</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Layout: Left categories & threads, Right sidebar info -->
      <div class="row g-4">
        <!-- Main Content Area -->
        <main class="col-lg-8">
          <!-- Categories Section -->
          <section
            class="categories-section mb-4"
            aria-labelledby="categories-heading"
          >
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h2
                id="categories-heading"
                class="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2"
              >
                <i
                  class="bi bi-grid-fill text-primary"
                  aria-hidden="true"
                />
                <span>Chuyên mục thảo luận</span>
              </h2>
            </div>

            <!-- Categories Loading -->
            <div
              v-if="categoriesLoading"
              class="row g-3"
            >
              <div
                v-for="n in 4"
                :key="n"
                class="col-sm-6"
              >
                <div class="card p-3 rounded-3 border bg-white shadow-sm placeholder-glow">
                  <div class="d-flex align-items-center gap-3">
                    <span class="placeholder col-2 p-3 rounded-circle bg-secondary-subtle" />
                    <div class="w-100">
                      <span class="placeholder col-6 rounded mb-1" />
                      <span class="placeholder col-9 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Categories Grid -->
            <div
              v-else
              class="row g-3"
            >
              <div
                v-for="cat in categories"
                :key="cat._id"
                class="col-sm-6"
              >
                <RouterLink
                  :to="{ name: 'forum-category', params: { slug: cat.slug || cat._id } }"
                  class="card h-100 p-3 rounded-3 border bg-white shadow-sm category-card text-decoration-none transition"
                >
                  <div class="d-flex align-items-start gap-3">
                    <div class="category-icon-wrap rounded-3 p-2.5 bg-light flex-shrink-0">
                      <i
                        :class="[getCategoryIcon(cat), 'fs-4']"
                        aria-hidden="true"
                      />
                    </div>
                    <div class="overflow-hidden">
                      <h3 class="fs-base fw-bold text-dark mb-1 category-title">
                        {{ cat.name }}
                      </h3>
                      <p class="text-secondary fs-xs mb-0 line-clamp-2">
                        {{ cat.description || 'Tham gia thảo luận về chủ đề này cùng cộng đồng.' }}
                      </p>
                    </div>
                  </div>
                </RouterLink>
              </div>
            </div>
          </section>

          <!-- Threads Feed Section -->
          <section
            class="threads-section"
            aria-labelledby="threads-heading"
          >
            <!-- Navigation Tabs & Search Toolbar -->
            <div class="card border rounded-3 p-3 bg-white shadow-sm mb-3">
              <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                <!-- Tabs -->
                <div
                  class="nav nav-pills forum-tabs gap-1"
                  role="tablist"
                >
                  <button
                    type="button"
                    class="nav-link fs-sm py-1.5 px-3"
                    :class="{ active: currentSort === 'active' }"
                    @click="handleTabChange('active')"
                  >
                    <i
                      class="bi bi-fire me-1"
                      aria-hidden="true"
                    />
                    <span>Sôi nổi</span>
                  </button>

                  <button
                    type="button"
                    class="nav-link fs-sm py-1.5 px-3"
                    :class="{ active: currentSort === 'latest' }"
                    @click="handleTabChange('latest')"
                  >
                    <i
                      class="bi bi-clock-history me-1"
                      aria-hidden="true"
                    />
                    <span>Mới nhất</span>
                  </button>

                  <button
                    type="button"
                    class="nav-link fs-sm py-1.5 px-3"
                    :class="{ active: currentSort === 'popular' }"
                    @click="handleTabChange('popular')"
                  >
                    <i
                      class="bi bi-heart me-1"
                      aria-hidden="true"
                    />
                    <span>Nhiều thích</span>
                  </button>

                  <button
                    type="button"
                    class="nav-link fs-sm py-1.5 px-3"
                    :class="{ active: currentSort === 'views' }"
                    @click="handleTabChange('views')"
                  >
                    <i
                      class="bi bi-eye me-1"
                      aria-hidden="true"
                    />
                    <span>Xem nhiều</span>
                  </button>
                </div>

                <!-- Search Input -->
                <div class="search-box">
                  <div class="input-group input-group-sm">
                    <span class="input-group-text bg-light border-end-0 text-muted">
                      <i
                        class="bi bi-search"
                        aria-hidden="true"
                      />
                    </span>
                    <input
                      v-model="inputSearch"
                      type="search"
                      class="form-control border-start-0 bg-light"
                      placeholder="Tìm chủ đề..."
                      aria-label="Tìm kiếm chủ đề diễn đàn"
                      @keyup.enter="handleSearch"
                    >
                    <button
                      v-if="inputSearch"
                      type="button"
                      class="btn btn-light border border-start-0"
                      aria-label="Xóa tìm kiếm"
                      @click="handleClearSearch"
                    >
                      <i class="bi bi-x" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Search Query Active Alert -->
              <div
                v-if="searchQuery"
                class="mt-2 pt-2 border-top d-flex align-items-center justify-content-between fs-xs text-muted"
              >
                <span>Kết quả tìm kiếm cho từ khóa: <strong>"{{ searchQuery }}"</strong></span>
                <button
                  type="button"
                  class="btn btn-link btn-sm text-secondary p-0 fs-xs text-decoration-none"
                  @click="handleClearSearch"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              </div>
            </div>

            <!-- Thread List Component -->
            <ThreadList
              :threads="threads"
              :loading="threadsLoading"
              empty-title="Chưa có chủ đề nào"
              empty-description="Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại. Hãy là người mở đầu chủ đề!"
              empty-action-label="Đăng chủ đề ngay"
              @empty-action="handleCreateThread"
            />

            <!-- Pagination -->
            <div
              v-if="meta.totalPages > 1 && !threadsLoading"
              class="d-flex justify-content-center mt-4"
            >
              <Pagination
                :page="meta.page"
                :total-pages="meta.totalPages"
                :total="meta.total"
                @update:page="handlePageChange"
              />
            </div>
          </section>
        </main>

        <!-- Right Sidebar -->
        <aside class="col-lg-4">
          <!-- Community Guidelines Card -->
          <div class="card border rounded-3 p-3 p-lg-4 bg-white shadow-sm mb-3">
            <h3 class="h6 fw-bold text-dark d-flex align-items-center gap-2 mb-3">
              <i
                class="bi bi-shield-check text-success"
                aria-hidden="true"
              />
              <span>Văn hóa thảo luận</span>
            </h3>
            <ul class="list-unstyled mb-0 small text-secondary d-flex flex-column gap-2">
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-primary mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>Tôn trọng người đọc, trao đổi văn minh và mang tính xây dựng.</span>
              </li>
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-primary mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>Gắn đúng chuyên mục và tag sách tương ứng để người khác dễ tìm kiếm.</span>
              </li>
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-primary mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>Không đăng nội dung quảng cáo rác, thông tin sai sự thật hoặc vi phạm bản quyền.</span>
              </li>
            </ul>
          </div>

          <!-- Quick Navigation to Library Books -->
          <div class="card border rounded-3 p-3 p-lg-4 bg-white shadow-sm">
            <h3 class="h6 fw-bold text-dark d-flex align-items-center gap-2 mb-2">
              <i
                class="bi bi-book text-primary"
                aria-hidden="true"
              />
              <span>Khám phá kho sách</span>
            </h3>
            <p class="small text-muted mb-3">
              Mượn sách miễn phí tại thư viện để chia sẻ cảm nhận cùng cộng đồng bạn đọc.
            </p>
            <RouterLink
              :to="{ name: 'books' }"
              class="btn btn-outline-primary btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-1.5"
            >
              <span>Xem danh mục sách</span>
              <i
                class="bi bi-arrow-right"
                aria-hidden="true"
              />
            </RouterLink>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-home-page {
  min-height: 100vh;
  background: radial-gradient(ellipse at 50% 0%, rgb(13 61 83 / 30%), transparent 42%), #041321;
  color: #d5e8f1;
}

.forum-hero {
  border: 1px solid rgb(79 211 226 / 22%);
  background: radial-gradient(ellipse at 82% 0%, rgb(44 194 208 / 22%), transparent 40%), linear-gradient(130deg, #0a3049, #071a2e 72%);
  box-shadow: 0 1rem 2.5rem rgb(0 8 20 / 28%) !important;
}

.forum-hero .hero-pill {
  border: 1px solid rgb(91 223 234 / 25%);
  background-color: #103a50;
  color: #8cecf1;
  font-weight: 500;
}

.forum-hero h1,
.forum-hero .lead {
  color: #ffffff;
}

.forum-hero .text-white-50 {
  color: #b3c8d5 !important;
}

.forum-home-page :deep(.card) {
  border-color: rgb(119 177 202 / 18%) !important;
  background: #081d31 !important;
  color: #d5e8f1;
  box-shadow: 0 0.5rem 1.5rem rgb(0 8 20 / 18%) !important;
}

.forum-home-page h2,
.forum-home-page h3 { color: #edf7fb !important; }
.forum-home-page .category-icon-wrap { background: #10334a !important; color: #65dfe9; }
.forum-home-page .category-card { transition: border-color 160ms ease, transform 160ms ease; }
.forum-home-page .category-card:hover { border-color: #35cddd !important; transform: translateY(-2px); }
.forum-home-page .category-card:hover .category-title { color: #72e5ed !important; }
.forum-home-page .text-secondary,
.forum-home-page .text-muted { color: #9eb4c3 !important; }
.forum-home-page .forum-tabs .nav-link { color: #b9cfdb; }
.forum-home-page .forum-tabs .nav-link:hover { background: #10334a; color: #edf7fb; }
.forum-home-page .forum-tabs .nav-link.active { background: #087d91; color: #fff; }
.forum-home-page .input-group-text,
.forum-home-page .form-control { border-color: rgb(119 177 202 / 24%); background: #06172a !important; color: #e6f4fb; }
.forum-home-page .input-group-text { color: #60dce8 !important; }
.forum-home-page .form-control::placeholder { color: #91aaba; }
.forum-home-page .btn-light { border-color: rgb(119 177 202 / 24%); background: #10334a; color: #c7dbe7; }
.forum-home-page .btn-outline-light { border-color: rgb(119 177 202 / 45%); color: #d5e8f1; }
.forum-home-page .btn-outline-light:hover { border-color: #35cddd; background: #103a50; color: #8cecf1; }
.forum-home-page .btn-primary { border-color: #0b91a4; background: #0b91a4; color: #fff; }
.forum-home-page .btn-primary:hover { border-color: #16adbf; background: #16adbf; }
.forum-home-page :deep(.thread-item) { border-color: rgb(119 177 202 / 18%) !important; background: #091f33 !important; color: #d5e8f1; }
.forum-home-page :deep(.thread-link) { color: #edf7fb !important; }
.forum-home-page :deep(.thread-link:hover) { color: #65dfe9 !important; }
.forum-home-page :deep(.thread-preview),
.forum-home-page :deep(.thread-meta) { color: #a9bfce !important; }
.forum-home-page :deep(.thread-item .thread-author-name) { color: #d5e8f1 !important; }
.forum-home-page :deep(.thread-item .thread-meta .text-muted) { color: #89a6b7 !important; }
.forum-home-page :deep(.thread-item .category-badge),
.forum-home-page :deep(.thread-item .associated-book-pill) { border-color: rgb(119 177 202 / 24%) !important; background: #10334a !important; color: #c7dbe7 !important; }
.forum-home-page :deep(.thread-item .associated-book-pill strong),
.forum-home-page :deep(.thread-item .associated-book-pill .text-secondary) { color: #b9cfdb !important; }
.forum-home-page :deep(.avatar-fallback) { border-color: rgb(119 177 202 / 22%) !important; background: #10334a !important; color: #72e5ed !important; }
.forum-home-page :deep(.interaction-btn),
.forum-home-page :deep(.interaction-badge) { border-color: rgb(119 177 202 / 20%); background: #0c2940; color: #b9cfdb; }
.forum-home-page :deep(.placeholder) { background-color: #14344e !important; }
.forum-home-page :deep(.empty-state h2) { color: #edf7fb !important; }
.forum-home-page :deep(.empty-state-icon) { color: #61dce8 !important; }
.forum-home-page :deep(.page-link) { border-color: rgb(119 177 202 / 20%); background: #081d31; color: #b9cfdb; }
.forum-home-page :deep(.page-item.active .page-link) { border-color: #20bfd0; background: #0d8299; color: #fff; }
.forum-home-page :deep(.page-item.disabled .page-link) { background: #06172a; color: #60798a; }

.fs-xs {
  font-size: 0.75rem;
}

.fs-base {
  font-size: 1rem;
}

.category-card {
  border-color: rgb(119 177 202 / 18%) !important;
  background: #081d31 !important;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.forum-tabs .nav-link {
  color: #b9cfdb;
  border-radius: 0.375rem;
  transition: all 140ms ease;
}

.forum-tabs .nav-link:hover {
  background-color: #10334a;
  color: #edf7fb;
}

.forum-tabs .nav-link.active {
  background-color: #0d8299;
  color: #ffffff;
}

.search-box {
  min-width: 200px;
}

@media (max-width: 575.98px) {
  .forum-hero { padding: 1.5rem !important; }
  .forum-hero .btn { width: 100%; justify-content: center; }
}
</style>

