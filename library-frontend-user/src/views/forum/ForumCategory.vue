<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import forumService from '@/services/forum.service';
import ThreadList from '@/components/forum/ThreadList.vue';
import Pagination from '@/components/common/Pagination.vue';
import EmptyState from '@/components/common/EmptyState.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const category = ref(null);
const categoryLoading = ref(true);

const threads = ref([]);
const threadsLoading = ref(true);
const meta = ref({ page: 1, limit: 10, total: 0, totalPages: 1 });

const currentSort = ref(route.query.sort || 'active');
const currentPage = ref(Number(route.query.page) || 1);
const searchQuery = ref(route.query.q || '');
const inputSearch = ref(route.query.q || '');

async function fetchCategoryAndThreads() {
  categoryLoading.value = true;
  try {
    const categories = await forumService.getCategories();
    const slugOrId = String(route.params.slug);
    const matched = categories.find((c) => c.slug === slugOrId || c._id === slugOrId);

    if (!matched) {
      category.value = null;
      categoryLoading.value = false;
      return;
    }

    category.value = matched;
    categoryLoading.value = false;
    await fetchThreads();
  } catch (err) {
    console.error('Lỗi khi tải chuyên mục:', err);
    category.value = null;
    categoryLoading.value = false;
  }
}

async function fetchThreads() {
  if (!category.value) return;

  threadsLoading.value = true;
  try {
    const params = {
      category: category.value._id,
      page: currentPage.value,
      limit: 10,
      sort: currentSort.value,
      q: searchQuery.value.trim() || undefined,
    };
    const res = await forumService.getThreads(params);
    threads.value = res.threads || [];
    meta.value = res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
  } catch (err) {
    console.error('Lỗi khi tải chủ đề của chuyên mục:', err);
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
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

function syncQuery() {
  const query = {};
  if (currentSort.value && currentSort.value !== 'active') query.sort = currentSort.value;
  if (currentPage.value > 1) query.page = String(currentPage.value);
  if (searchQuery.value) query.q = searchQuery.value;

  router.replace({ query });
}

function handleCreateThread() {
  const catId = category.value?._id;
  if (!authStore.isAuthenticated) {
    const redirect = catId ? `/forum/new?category=${catId}` : '/forum/new';
    router.push({
      name: 'login',
      query: { redirect },
    });
    return;
  }

  router.push({
    name: 'forum-new',
    query: catId ? { category: catId } : {},
  });
}

watch(
  () => route.params.slug,
  () => {
    currentPage.value = 1;
    fetchCategoryAndThreads();
  }
);

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
  fetchCategoryAndThreads();
});
</script>

<template>
  <div class="forum-category-page py-4">
    <div class="container">
      <!-- Breadcrumb navigation -->
      <nav
        aria-label="Đường dẫn trang"
        class="mb-3"
      >
        <ol class="breadcrumb fs-xs text-muted mb-0">
          <li class="breadcrumb-item">
            <RouterLink
              :to="{ name: 'forum' }"
              class="text-decoration-none text-secondary"
            >
              Diễn đàn
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active text-dark fw-medium"
            aria-current="page"
          >
            {{ category?.name || 'Chuyên mục' }}
          </li>
        </ol>
      </nav>

      <!-- Category Not Found State -->
      <div
        v-if="!categoryLoading && !category"
        class="card border rounded-3 p-5 bg-white shadow-sm text-center"
      >
        <EmptyState
          title="Không tìm thấy chuyên mục"
          description="Chuyên mục diễn đàn bạn đang tìm không tồn tại hoặc đã bị xóa."
          icon="bi-exclamation-triangle"
          action-label="Quay lại Diễn đàn"
          @action="router.push({ name: 'forum' })"
        />
      </div>

      <template v-else>
        <!-- Category Banner Header -->
        <header class="card border rounded-3 p-4 bg-white shadow-sm mb-4">
          <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <div class="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded bg-primary-subtle text-primary fs-xs mb-2">
                <i
                  class="bi bi-tag-fill"
                  aria-hidden="true"
                />
                <span>Chuyên mục thảo luận</span>
              </div>
              <h1 class="h3 fw-bold text-dark mb-1">
                {{ category?.name || 'Đang tải chuyên mục...' }}
              </h1>
              <p class="text-secondary fs-sm mb-0">
                {{ category?.description || 'Tham gia thảo luận cùng các bạn đọc khác trong chuyên mục này.' }}
              </p>
            </div>

            <div>
              <button
                type="button"
                class="btn btn-primary d-inline-flex align-items-center gap-2 text-nowrap"
                @click="handleCreateThread"
              >
                <i
                  class="bi bi-pencil-square"
                  aria-hidden="true"
                />
                <span>Tạo chủ đề mới</span>
              </button>
            </div>
          </div>
        </header>

        <!-- Main Content Area -->
        <main>
          <!-- Toolbar: Sort Tabs + Search Input -->
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

              <!-- Search inside category -->
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
                    placeholder="Tìm trong chuyên mục..."
                    aria-label="Tìm kiếm trong chuyên mục này"
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

            <!-- Active search filter warning/notice -->
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
                Xóa bộ lọc
              </button>
            </div>
          </div>

          <!-- Thread List Component -->
          <ThreadList
            :threads="threads"
            :loading="threadsLoading"
            :show-category="false"
            empty-title="Chưa có chủ đề nào trong chuyên mục này"
            empty-description="Hãy là người đầu tiên chia sẻ và mở đầu cuộc trò chuyện!"
            empty-action-label="Tạo chủ đề ngay"
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
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fs-xs {
  font-size: 0.75rem;
}

.fs-sm {
  font-size: 0.875rem;
}

.forum-tabs .nav-link {
  color: #4b5563;
  border-radius: 0.375rem;
  transition: all 140ms ease;
}

.forum-tabs .nav-link:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.forum-tabs .nav-link.active {
  background-color: #2563eb;
  color: #ffffff;
}

.search-box {
  min-width: 220px;
}
</style>

