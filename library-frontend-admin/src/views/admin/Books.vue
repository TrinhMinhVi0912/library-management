<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import BookForm from '@/components/admin/BookForm.vue';
import {
  createAdminBook,
  deleteAdminBook,
  getAdminBooks,
  getCatalogOptions,
  getAdminBook,
  updateAdminBook,
  updateAdminBookStatus,
  uploadAdminImage,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const books = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const lookupLoading = ref(false);
const saving = ref(false);
const actionId = ref('');
const formOpen = ref(false);
const selectedBook = ref(null);
const categories = ref([]);
const authors = ref([]);
const publishers = ref([]);
const lookupsError = ref(false);

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

onMounted(() => {
  loadBooks();
  loadLookups();
});
watch(() => [route.query.q, route.query.status, route.query.category, route.query.author, route.query.page, route.query.sort], loadBooks);

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

async function loadLookups() {
  lookupLoading.value = true;
  lookupsError.value = false;
  try {
    const result = await getCatalogOptions();
    categories.value = result.categories;
    authors.value = result.authors;
    publishers.value = result.publishers;
  } catch (error) {
    lookupsError.value = true;
    toast.error(error.response?.data?.message || 'Không tải được danh mục sách.');
  } finally {
    lookupLoading.value = false;
  }
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
  selectedBook.value = null;
  formOpen.value = true;
}

async function openEdit(book) {
  saving.value = true;
  try {
    selectedBook.value = await getAdminBook(book._id);
    formOpen.value = true;
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tải được thông tin sách.');
  } finally {
    saving.value = false;
  }
}

async function saveBook({ payload, imageFile }) {
  if (saving.value) return;
  saving.value = true;
  try {
    if (imageFile) {
      const uploaded = await uploadAdminImage(imageFile, 'books');
      payload.cover = { url: uploaded.url, publicId: uploaded.publicId };
    }
    if (selectedBook.value?._id) await updateAdminBook(selectedBook.value._id, payload);
    else await createAdminBook(payload);
    toast.success(selectedBook.value?._id ? 'Đã cập nhật sách.' : 'Đã thêm sách mới.');
    formOpen.value = false;
    selectedBook.value = null;
    await loadBooks();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể lưu thông tin sách.');
  } finally {
    saving.value = false;
  }
}

function handleAuthorCreated(authorRecord) {
  if (authorRecord?._id && !authors.value.some((item) => item._id === authorRecord._id)) {
    authors.value = [...authors.value, authorRecord].sort((first, second) => first.name.localeCompare(second.name, 'vi'));
  }
}

function handleCategoryCreated(categoryRecord) {
  if (categoryRecord?._id && !categories.value.some((item) => item._id === categoryRecord._id)) {
    categories.value = [...categories.value, categoryRecord].sort((first, second) => first.name.localeCompare(second.name, 'vi'));
  }
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
    await loadBooks();
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
    await loadBooks();
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
        :disabled="lookupLoading || lookupsError"
        @click="openCreate"
      >
        <i
          class="bi bi-plus-lg me-1"
          aria-hidden="true"
        />Thêm sách
      </button>
    </div>

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
            :disabled="Boolean(actionId) || saving"
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

    <div
      v-if="formOpen"
      class="modal-backdrop-custom"
      @click.self="formOpen = false"
    >
      <BookForm
        :book="selectedBook"
        :categories="categories"
        :authors="authors"
        :publishers="publishers"
        :saving="saving"
        @submit="saveBook"
        @cancel="formOpen = false"
        @author-created="handleAuthorCreated"
        @category-created="handleCategoryCreated"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.books-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.books-heading p { margin-top: .35rem; font-size: .9rem; }
.filter-controls { display: flex; flex-wrap: wrap; gap: .75rem; }.filter-field { display: grid; min-width: 160px; gap: .25rem; color: #6b7280; font-size: .75rem; }.filter-field select { min-width: 160px; }
.book-cover-thumb,.cover-placeholder { display: grid; width: 44px; height: 58px; place-items: center; border-radius: .25rem; background: #f3f4f6; object-fit: cover; color: #9ca3af; }
.book-title { display: grid; min-width: 160px; gap: .2rem; }.book-title small,.book-meta,.inventory-total { color: #6b7280; font-size: .75rem; }.book-meta { display: block; min-width: 110px; max-width: 180px; white-space: normal; }
.status-badge { display: inline-flex; padding: .3rem .55rem; border-radius: 999px; font-size: .75rem; font-weight: 600; white-space: nowrap; }.status-active { background: #ecfdf5; color: #047857; }.status-hidden { background: #f3f4f6; color: #6b7280; }
.row-actions { display: flex; flex-wrap: wrap; gap: .35rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: grid; overflow-y: auto; place-items: center; padding: 1rem; background: rgb(17 24 39 / 45%); }
.books-page :deep(.table-toolbar) { align-items: flex-end; flex-wrap: wrap; }
.books-page :deep(.search-field) { width: min(100%, 560px); flex: 1 1 420px; }
.books-page :deep(.search-field input) { min-width: 0; }
@media (max-width: 575.98px) { .books-heading { align-items: flex-start; flex-direction: column; }.books-heading > button { width: 100%; }.filter-controls { display: grid; width: 100%; grid-template-columns: 1fr; }.filter-field,.filter-field select { width: 100%; }.row-actions { align-items: flex-start; flex-direction: column; } }
</style>
