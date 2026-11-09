<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import BookForm from '@/components/admin/BookForm.vue';
import {
  createAdminBook,
  getAdminBook,
  getCatalogOptions,
  updateAdminBook,
  uploadAdminImage,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const book = ref(null);
const categories = ref([]);
const authors = ref([]);
const publishers = ref([]);
const loading = ref(true);
const loadError = ref(false);
const lookupError = ref(false);
const saving = ref(false);
const isEditing = computed(() => Boolean(route.params.id));

onMounted(loadEditorData);

async function loadEditorData() {
  loading.value = true;
  loadError.value = false;
  lookupError.value = false;

  const requests = [getCatalogOptions()];
  if (isEditing.value) requests.push(getAdminBook(route.params.id));

  const [catalogResult, bookResult] = await Promise.allSettled(requests);

  if (catalogResult.status === 'fulfilled') {
    categories.value = catalogResult.value.categories;
    authors.value = catalogResult.value.authors;
    publishers.value = catalogResult.value.publishers;
  } else {
    lookupError.value = true;
    toast.error(catalogResult.reason.response?.data?.message || 'Không tải được danh mục sách.');
  }

  if (isEditing.value) {
    if (bookResult.status === 'fulfilled') book.value = bookResult.value;
    else {
      loadError.value = true;
      toast.error(bookResult.reason.response?.data?.message || 'Không tải được thông tin sách.');
    }
  }

  loading.value = false;
}

function goBack() {
  router.push({ name: 'admin-books', query: route.query });
}

function addOption(options, record) {
  if (record?._id && !options.value.some((item) => item._id === record._id)) {
    options.value = [...options.value, record].sort((first, second) => first.name.localeCompare(second.name, 'vi'));
  }
}

async function saveBook({ payload, imageFile }) {
  if (saving.value || loadError.value) return;
  saving.value = true;
  try {
    if (imageFile) {
      const uploaded = await uploadAdminImage(imageFile, 'books');
      payload.cover = { url: uploaded.url, publicId: uploaded.publicId };
    }

    if (isEditing.value) await updateAdminBook(route.params.id, payload);
    else await createAdminBook(payload);

    toast.success(isEditing.value ? 'Đã cập nhật sách.' : 'Đã thêm sách mới.');
    await router.push({ name: 'admin-books', query: route.query });
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể lưu thông tin sách.');
  } finally {
    saving.value = false;
  }
}

async function retryLookups() {
  try {
    const result = await getCatalogOptions();
    categories.value = result.categories;
    authors.value = result.authors;
    publishers.value = result.publishers;
    lookupError.value = false;
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tải được danh mục sách.');
  }
}
</script>

<template>
  <section class="book-editor-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <RouterLink :to="{ name: 'admin-books', query: route.query }">
        Quản lý sách
      </RouterLink>
      <i
        class="bi bi-chevron-right"
        aria-hidden="true"
      />
      <span aria-current="page">{{ isEditing ? 'Sửa sách' : 'Thêm sách' }}</span>
    </nav>

    <header class="page-heading editor-heading">
      <div>
        <h1>{{ isEditing ? 'Cập nhật thông tin sách' : 'Thêm sách mới' }}</h1>
        <p class="text-muted-strong mb-0">
          Nhập thông tin sách, phân loại, tác giả và số lượng bản trong kho.
        </p>
      </div>
      <button
        class="btn btn-outline-secondary"
        type="button"
        @click="goBack"
      >
        <i
          class="bi bi-arrow-left me-1"
          aria-hidden="true"
        />Quay lại danh sách
      </button>
    </header>

    <div
      v-if="loading"
      class="surface-card editor-state"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm"
        aria-hidden="true"
      /> Đang tải biểu mẫu…
    </div>
    <div
      v-else-if="loadError"
      class="alert alert-danger"
      role="alert"
    >
      Không tải được thông tin sách. Hãy thử tải lại hoặc quay về danh sách.
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        type="button"
        @click="loadEditorData"
      >
        Thử lại
      </button>
    </div>
    <template v-else>
      <div
        v-if="lookupError"
        class="alert alert-warning d-flex align-items-center justify-content-between gap-3"
        role="alert"
      >
        <span>Không tải được danh mục tác giả/thể loại. Bạn có thể thử tải lại trước khi nhập.</span>
        <button
          class="btn btn-sm btn-outline-secondary flex-shrink-0"
          type="button"
          @click="retryLookups"
        >
          Tải lại danh mục
        </button>
      </div>
      <BookForm
        :book="book"
        :categories="categories"
        :authors="authors"
        :publishers="publishers"
        :saving="saving"
        @submit="saveBook"
        @cancel="goBack"
        @author-created="(record) => addOption(authors, record)"
        @category-created="(record) => addOption(categories, record)"
      />
    </template>
  </section>
</template>

<style scoped>
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.book-editor-page { width: min(100%, 1200px); margin-inline: auto; }
.breadcrumb-line a { color: #2563eb; text-decoration: none; }
.editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.editor-heading p { margin-top: .35rem; font-size: .9rem; }
.editor-state { display: flex; align-items: center; justify-content: center; gap: .75rem; min-height: 12rem; padding: 2rem; }
@media (max-width: 575.98px) { .editor-heading { align-items: stretch; flex-direction: column; }.editor-heading > button { width: 100%; } }
</style>
