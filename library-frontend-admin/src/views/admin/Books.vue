<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import { Bar } from 'vue-chartjs';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import DataTable from '@/components/admin/DataTable.vue';
import {
  deleteAdminBook,
  getAdminBooks,
  getAdminBookStatistics,
  getCatalogOptions,
  updateAdminBookStatus,
} from '@/services/admin.service';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const route = useRoute();
const router = useRouter();
const toast = useToast();
const books = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const actionId = ref('');
const categories = ref([]);
const authors = ref([]);
const statistics = ref(null);
const statisticsLoading = ref(true);
const statisticsError = ref(false);
const statisticsVisible = ref(true);
const lowStockThreshold = ref(2);
const lowStockPage = ref(1);
const openPanels = ref({ categories: true, lowStock: true, authors: true });

const query = computed(() => String(route.query.q || ''));
const status = computed(() => String(route.query.status || 'all'));
const category = computed(() => String(route.query.category || ''));
const author = computed(() => String(route.query.author || ''));
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const columns = [
  { key: 'cover', label: 'Bìa' },
  { key: 'code', label: 'Mã sách', sortable: true },
  { key: 'title', label: 'Tên sách', sortable: true },
  { key: 'authors', label: 'Tác giả' },
  { key: 'categories', label: 'Thể loại' },
  { key: 'inventory', label: 'Tồn kho' },
  { key: 'status', label: 'Hiển thị' },
  { key: 'actions', label: 'Thao tác' },
];
let statisticsRequestId = 0;

onMounted(() => {
  loadBooks();
  loadCatalogFilters();
  loadStatistics();
});
watch(() => [route.query.q, route.query.status, route.query.category, route.query.author, route.query.page, route.query.sort], loadBooks);

const categoryChartData = computed(() => ({
  labels: (statistics.value?.categories || []).map((item) => item.name),
  datasets: [{
    label: 'Đầu sách',
    data: (statistics.value?.categories || []).map((item) => item.count),
    backgroundColor: ['#2563eb', '#0ea5e9', '#14b8a6', '#6366f1', '#38bdf8', '#60a5fa'],
    borderRadius: 5,
  }],
}));

const authorChartData = computed(() => ({
  labels: (statistics.value?.topAuthors || []).map((item) => item.name),
  datasets: [{
    label: 'Đầu sách',
    data: (statistics.value?.topAuthors || []).map((item) => item.bookCount),
    backgroundColor: '#2563eb',
    borderRadius: 5,
  }],
}));

const categoryChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const authorChartOptions = {
  ...categoryChartOptions,
  indexAxis: 'y',
  scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
};

async function loadBooks() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminBooks({
      q: query.value || undefined,
      status: status.value,
      category: category.value || undefined,
      author: author.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    books.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.books) ? result.books : []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadCatalogFilters() {
  try {
    const result = await getCatalogOptions();
    categories.value = result.categories;
    authors.value = result.authors;
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tải được bộ lọc danh mục sách.');
  }
}

async function loadStatistics() {
  const requestId = ++statisticsRequestId;
  statisticsLoading.value = true;
  statisticsError.value = false;
  try {
    const result = await getAdminBookStatistics({
      lowStockThreshold: lowStockThreshold.value,
      lowStockPage: lowStockPage.value,
    });
    if (!result || typeof result !== 'object') throw new Error('Dữ liệu thống kê không hợp lệ');
    if (requestId === statisticsRequestId) {
      statistics.value = {
        ...result,
        categories: Array.isArray(result.categories) ? result.categories : [],
        topAuthors: Array.isArray(result.topAuthors) ? result.topAuthors : [],
        lowStockBooks: Array.isArray(result.lowStockBooks) ? result.lowStockBooks : [],
        lowStockCount: Number(result.lowStockCount) || 0,
        lowStockMeta: result.lowStockMeta || { page: 1, totalPages: 1 },
      };
    }
  } catch {
    if (requestId === statisticsRequestId) statisticsError.value = true;
  } finally {
    if (requestId === statisticsRequestId) statisticsLoading.value = false;
  }
}

function togglePanel(panel) {
  openPanels.value[panel] = !openPanels.value[panel];
}

function updateLowStockThreshold(value) {
  lowStockThreshold.value = Number(value);
  lowStockPage.value = 1;
  loadStatistics();
}

function updateLowStockPage(pageNumber) {
  lowStockPage.value = pageNumber;
  loadStatistics();
}

function updateQuery(value) {
  const nextQuery = { ...route.query, q: value.trim() || undefined, page: undefined };
  router.replace({ query: nextQuery });
}

function updateFilter(key, value) {
  const nextQuery = { ...route.query, [key]: value || undefined, page: undefined };
  router.replace({ query: nextQuery });
}

function updatePage(value) {
  router.replace({ query: { ...route.query, page: value === 1 ? undefined : String(value) } });
}

function updateSort({ key, order }) {
  router.replace({ query: { ...route.query, sort: order === 'desc' ? `-${key}` : key, page: undefined } });
}

function openCreate() {
  router.push({ name: 'admin-book-create', query: route.query });
}

function openEdit(book) {
  router.push({ name: 'admin-book-edit', params: { id: book._id }, query: route.query });
}

async function toggleVisibility(book) {
  const nextStatus = book.status === 'active' ? 'hidden' : 'active';
  const result = await Swal.fire({
    title: `${nextStatus === 'hidden' ? 'Ẩn' : 'Hiện'} sách này?`,
    text: nextStatus === 'hidden' ? 'Sách sẽ không còn hiển thị trong danh mục công khai.' : 'Sách sẽ được hiển thị trong danh mục công khai.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: nextStatus === 'hidden' ? 'Ẩn sách' : 'Hiện sách',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: nextStatus === 'hidden' ? '#dc2626' : '#2563eb',
  });
  if (!result.isConfirmed) return;
  actionId.value = book._id;
  try {
    await updateAdminBookStatus(book._id, nextStatus);
    toast.success(nextStatus === 'hidden' ? 'Đã ẩn sách.' : 'Đã hiện sách công khai.');
    await Promise.all([loadBooks(), loadStatistics()]);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể đổi trạng thái hiển thị.');
  } finally {
    actionId.value = '';
  }
}

async function removeBook(book) {
  const result = await Swal.fire({
    title: `Xóa sách “${book.title}”?`,
    text: 'Chỉ xóa được sách chưa có lịch sử mượn.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Xóa sách',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!result.isConfirmed) return;
  actionId.value = book._id;
  try {
    await deleteAdminBook(book._id);
    toast.success('Đã xóa sách.');
    await Promise.all([loadBooks(), loadStatistics()]);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể xóa sách có lịch sử mượn.');
  } finally {
    actionId.value = '';
  }
}

function displayAuthors(book) {
  return book.authors?.map((item) => item.name).filter(Boolean).join(', ') || book.authorText || '—';
}

function displayCategories(book) {
  return book.categories?.map((item) => item.name).filter(Boolean).join(', ') || '—';
}
</script>

<template>
  <section class="books-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Quản lý sách</span>
    </nav>
    <div class="page-heading books-heading">
      <div>
        <h1>Quản lý sách</h1><p class="text-muted-strong mb-0">
          Tìm kiếm, cập nhật thông tin và quản lý hiển thị sách.
        </p>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        @click="openCreate"
      >
        <i
          class="bi bi-plus-lg me-1"
          aria-hidden="true"
        />Thêm sách
      </button>
    </div>

    <section
      class="book-statistics"
      aria-labelledby="book-statistics-title"
    >
      <div class="statistics-heading">
        <div>
          <h2 id="book-statistics-title">
            Thống kê kho sách
          </h2>
          <p>Theo dõi cơ cấu thể loại, lượng sách sẵn có và đầu sách theo tác giả.</p>
        </div>
        <button
          class="btn btn-sm btn-outline-primary"
          type="button"
          :aria-expanded="statisticsVisible"
          @click="statisticsVisible = !statisticsVisible"
        >
          <i
            class="bi"
            :class="statisticsVisible ? 'bi-eye-slash' : 'bi-eye'"
            aria-hidden="true"
          />
          {{ statisticsVisible ? 'Ẩn thống kê' : 'Hiện thống kê' }}
        </button>
      </div>

      <div
        v-if="statisticsVisible"
        class="statistics-content"
      >
        <div
          v-if="statisticsLoading"
          class="statistics-state surface-card"
          role="status"
        >
          <span class="spinner-border spinner-border-sm text-primary" /> Đang tải thống kê kho sách…
        </div>
        <div
          v-else-if="statisticsError || !statistics"
          class="statistics-state surface-card"
          role="alert"
        >
          <span>Không tải được thống kê kho sách.</span>
          <button
            class="btn btn-sm btn-outline-primary"
            type="button"
            @click="loadStatistics"
          >
            Thử lại
          </button>
        </div>
        <div
          v-else
          class="statistics-grid"
        >
          <section class="surface-card statistics-panel">
            <header class="statistics-panel-heading">
              <div>
                <h3>Sách theo thể loại</h3>
                <p>Số đầu sách được gắn với từng thể loại.</p>
              </div>
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="openPanels.categories"
                aria-label="Thu gọn hoặc mở thống kê sách theo thể loại"
                @click="togglePanel('categories')"
              >
                <i
                  class="bi"
                  :class="openPanels.categories ? 'bi-chevron-up' : 'bi-chevron-down'"
                  aria-hidden="true"
                />
              </button>
            </header>
            <div
              v-if="openPanels.categories"
              class="chart-area"
            >
              <Bar
                v-if="statistics.categories?.length"
                :data="categoryChartData"
                :options="categoryChartOptions"
                aria-label="Biểu đồ số đầu sách theo thể loại"
              />
              <div
                v-else
                class="panel-empty"
              >
                Chưa có dữ liệu thể loại.
              </div>
            </div>
          </section>

          <section class="surface-card statistics-panel">
            <header class="statistics-panel-heading">
              <div>
                <h3>Sách sắp hết</h3>
                <p>{{ statistics.lowStockCount }} đầu sách có số bản khả dụng dưới {{ lowStockThreshold }}.</p>
              </div>
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="openPanels.lowStock"
                aria-label="Thu gọn hoặc mở danh sách sách sắp hết"
                @click="togglePanel('lowStock')"
              >
                <i
                  class="bi"
                  :class="openPanels.lowStock ? 'bi-chevron-up' : 'bi-chevron-down'"
                  aria-hidden="true"
                />
              </button>
            </header>
            <div
              v-if="openPanels.lowStock"
              class="low-stock-content"
            >
              <label class="threshold-control">
                <span>Ngưỡng số bản khả dụng</span>
                <select
                  class="form-select form-select-sm"
                  :value="lowStockThreshold"
                  @change="updateLowStockThreshold($event.target.value)"
                >
                  <option
                    v-for="threshold in [2, 3, 4, 5]"
                    :key="threshold"
                    :value="threshold"
                  >Dưới {{ threshold }} quyển</option>
                </select>
              </label>
              <div
                v-if="statistics.lowStockBooks?.length"
                class="low-stock-list"
              >
                <div
                  v-for="book in statistics.lowStockBooks"
                  :key="book._id"
                  class="low-stock-row"
                >
                  <div class="low-stock-title">
                    <strong>{{ book.title }}</strong>
                    <small>{{ book.code }}<span v-if="book.status === 'hidden'"> · Đang ẩn</span></small>
                  </div>
                  <span class="low-stock-count">{{ book.availableCopies }} / {{ book.totalCopies }}</span>
                </div>
                <p
                  v-if="statistics.lowStockMeta?.totalPages > 1"
                  class="list-note"
                >
                  Trang {{ statistics.lowStockMeta.page }} / {{ statistics.lowStockMeta.totalPages }} · {{ statistics.lowStockCount }} đầu sách phù hợp ngưỡng.
                </p>
                <div
                  v-if="statistics.lowStockMeta?.totalPages > 1"
                  class="low-stock-pagination"
                >
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    type="button"
                    :disabled="statistics.lowStockMeta.page <= 1"
                    @click="updateLowStockPage(statistics.lowStockMeta.page - 1)"
                  >
                    Trước
                  </button>
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    type="button"
                    :disabled="statistics.lowStockMeta.page >= statistics.lowStockMeta.totalPages"
                    @click="updateLowStockPage(statistics.lowStockMeta.page + 1)"
                  >
                    Sau
                  </button>
                </div>
              </div>
              <div
                v-else
                class="panel-empty compact"
              >
                Không có sách nào dưới ngưỡng tồn kho này.
              </div>
            </div>
          </section>

          <section class="surface-card statistics-panel">
            <header class="statistics-panel-heading">
              <div>
                <h3>Top 5 tác giả</h3>
                <p>Xếp theo số đầu sách đang có trong thư viện.</p>
              </div>
              <button
                class="panel-toggle"
                type="button"
                :aria-expanded="openPanels.authors"
                aria-label="Thu gọn hoặc mở thống kê top tác giả"
                @click="togglePanel('authors')"
              >
                <i
                  class="bi"
                  :class="openPanels.authors ? 'bi-chevron-up' : 'bi-chevron-down'"
                  aria-hidden="true"
                />
              </button>
            </header>
            <div
              v-if="openPanels.authors"
              class="chart-area author-chart-area"
            >
              <Bar
                v-if="statistics.topAuthors?.length"
                :data="authorChartData"
                :options="authorChartOptions"
                aria-label="Biểu đồ top năm tác giả theo số đầu sách"
              />
              <div
                v-else
                class="panel-empty"
              >
                Chưa có dữ liệu tác giả.
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>

    <DataTable
      :columns="columns"
      :rows="books"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :query="query"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :searchable="true"
      @update:query="updateQuery"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadBooks"
    >
      <template #toolbar>
        <div class="filter-controls">
          <label class="filter-field"><span>Trạng thái</span><select
            class="form-select form-select-sm"
            :value="status"
            @change="updateFilter('status', $event.target.value)"
          ><option value="all">Tất cả</option><option value="active">Đang hiển thị</option><option value="hidden">Đang ẩn</option></select></label>
          <label class="filter-field"><span>Thể loại</span><select
            class="form-select form-select-sm"
            :value="category"
            @change="updateFilter('category', $event.target.value)"
          ><option value="">Tất cả thể loại</option><option
            v-for="item in categories"
            :key="item._id"
            :value="item._id"
          >{{ item.name }}</option></select></label>
          <label class="filter-field"><span>Tác giả</span><select
            class="form-select form-select-sm"
            :value="author"
            @change="updateFilter('author', $event.target.value)"
          ><option value="">Tất cả tác giả</option><option
            v-for="item in authors"
            :key="item._id"
            :value="item._id"
          >{{ item.name }}</option></select></label>
        </div>
      </template>
      <template #cell-cover="{ row }">
        <img
          v-if="row.cover?.url"
          class="book-cover-thumb"
          :src="row.cover.url"
          :alt="`Bìa sách ${row.title}`"
        ><span
          v-else
          class="cover-placeholder"
        ><i
          class="bi bi-image"
          aria-hidden="true"
        /></span>
      </template>
      <template #cell-title="{ row }">
        <div class="book-title">
          <strong>{{ row.title }}</strong><small>{{ row.publisher?.name || 'Chưa có nhà xuất bản' }} · {{ row.publishYear || 'Chưa rõ năm' }}</small>
        </div>
      </template>
      <template #cell-authors="{ row }">
        <span class="book-meta">{{ displayAuthors(row) }}</span>
      </template>
      <template #cell-categories="{ row }">
        <span class="book-meta">{{ displayCategories(row) }}</span>
      </template>
      <template #cell-inventory="{ row }">
        <strong>{{ row.availableCopies ?? 0 }}</strong><span class="inventory-total"> / {{ row.totalCopies ?? 0 }}</span>
      </template>
      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="row.status === 'active' ? 'status-active' : 'status-hidden'"
        >{{ row.status === 'active' ? 'Đang hiện' : 'Đang ẩn' }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-sm btn-outline-primary"
            type="button"
            :disabled="Boolean(actionId)"
            @click="openEdit(row)"
          >
            Sửa
          </button><button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            :disabled="Boolean(actionId)"
            @click="toggleVisibility(row)"
          >
            {{ row.status === 'active' ? 'Ẩn' : 'Hiện' }}
          </button><button
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(actionId)"
            @click="removeBook(row)"
          >
            Xóa
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-book"
            aria-hidden="true"
          /><span>Không có sách phù hợp bộ lọc.</span>
        </div>
      </template>
      <template #error>
        Không tải được danh sách sách.<button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadBooks"
        >
          Thử lại
        </button>
      </template>
    </DataTable>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.books-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.books-heading p { margin-top: .35rem; font-size: .9rem; }
.book-statistics { margin-bottom: 1.25rem; }
.statistics-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; }
.statistics-heading h2 { margin: 0; font-size: 1.1rem; font-weight: 650; }
.statistics-heading p,.statistics-panel-heading p { margin: .2rem 0 0; color: #6b7280; font-size: .8rem; }
.statistics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: .85rem; }
.statistics-panel { min-width: 0; padding: 1rem; }
.statistics-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; }
.statistics-panel-heading h3 { margin: 0; font-size: .95rem; font-weight: 650; }
.panel-toggle { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border: 1px solid #dbe2ea; border-radius: .45rem; background: #fff; color: #475569; }
.panel-toggle:hover { background: #eff6ff; color: #1d4ed8; }
.chart-area { position: relative; height: 240px; margin-top: .75rem; }
.author-chart-area { height: 220px; }
.panel-empty { display: grid; height: 100%; place-items: center; color: #6b7280; font-size: .85rem; }
.panel-empty.compact { min-height: 130px; }
.low-stock-content { margin-top: .8rem; }
.threshold-control { display: grid; gap: .3rem; margin-bottom: .55rem; color: #6b7280; font-size: .75rem; }
.threshold-control select { max-width: 190px; }
.low-stock-list { max-height: 205px; overflow-y: auto; }
.low-stock-row { display: flex; align-items: center; justify-content: space-between; gap: .6rem; padding: .5rem 0; border-bottom: 1px solid #eef2f7; }
.low-stock-title { display: grid; min-width: 0; gap: .12rem; }
.low-stock-title strong { overflow: hidden; font-size: .78rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.low-stock-title small { color: #6b7280; font-size: .7rem; }
.low-stock-count { flex: 0 0 auto; color: #b45309; font-size: .8rem; font-weight: 700; }
.list-note { margin: .55rem 0 0; color: #6b7280; font-size: .72rem; }
.low-stock-pagination { display: flex; justify-content: flex-end; gap: .4rem; margin-top: .55rem; }
.statistics-state { display: flex; min-height: 140px; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; color: #475569; }
.filter-controls { display: flex; flex-wrap: wrap; gap: .75rem; }.filter-field { display: grid; min-width: 160px; gap: .25rem; color: #6b7280; font-size: .75rem; }.filter-field select { min-width: 160px; }
.book-cover-thumb,.cover-placeholder { display: grid; width: 44px; height: 58px; place-items: center; border-radius: .25rem; background: #f3f4f6; object-fit: cover; color: #9ca3af; }
.book-title { display: grid; min-width: 160px; gap: .2rem; }.book-title small,.book-meta,.inventory-total { color: #6b7280; font-size: .75rem; }.book-meta { display: block; min-width: 110px; max-width: 180px; white-space: normal; }
.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 600; white-space: nowrap; }.status-active { background: #ecfdf5; color: #047857; }.status-hidden { background: #f3f4f6; color: #6b7280; }
.row-actions { display: flex; flex-wrap: wrap; gap: .35rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.books-page :deep(.table-toolbar) { align-items: flex-end; flex-wrap: wrap; }
.books-page :deep(.search-field) { width: min(100%, 560px); flex: 1 1 420px; }
.books-page :deep(.search-field input) { min-width: 0; }
@media (max-width: 1199.98px) { .statistics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.statistics-panel:last-child { grid-column: 1 / -1; } }
@media (max-width: 767.98px) { .statistics-grid { grid-template-columns: minmax(0, 1fr); }.statistics-panel:last-child { grid-column: auto; } }
@media (max-width: 575.98px) { .books-heading { align-items: flex-start; flex-direction: column; }.books-heading > button { width: 100%; }.statistics-heading { align-items: flex-start; flex-direction: column; }.statistics-heading > button { width: 100%; }.filter-controls { display: grid; width: 100%; grid-template-columns: 1fr; }.filter-field,.filter-field select { width: 100%; }.row-actions { align-items: flex-start; flex-direction: column; } }
</style>
