<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import {
  createAdminCatalogItem,
  deleteAdminCatalogItem,
  getAdminCatalogItems,
  updateAdminCatalogItem,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const items = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);
const deletingId = ref('');
const modalOpen = ref(false);
const editingItem = ref(null);
const form = reactive({ name: '', detail: '' });

const catalogTypes = [
  { key: 'publishers', label: 'Nhà xuất bản' },
  { key: 'authors', label: 'Tác giả' },
  { key: 'categories', label: 'Thể loại' },
];
const type = computed(() => catalogTypes.some((item) => item.key === route.query.type)
  ? String(route.query.type)
  : 'publishers');
const typeConfig = computed(() => catalogTypes.find((item) => item.key === type.value));
const query = computed(() => String(route.query.q || ''));
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const sortValue = computed(() => String(route.query.sort || 'name'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const detailLabel = computed(() => ({ publishers: 'Địa chỉ', authors: 'Tiểu sử', categories: 'Mô tả' }[type.value]));
const detailField = computed(() => ({ publishers: 'address', authors: 'bio', categories: 'description' }[type.value]));
const detailPlaceholder = computed(() => ({ publishers: 'Địa chỉ nhà xuất bản', authors: 'Thông tin giới thiệu về tác giả', categories: 'Mô tả thể loại' }[type.value]));
const detailMaxLength = computed(() => (type.value === 'authors' ? 2000 : type.value === 'categories' ? 1000 : 255));
const columns = computed(() => [
  { key: 'name', label: `Tên ${type.value === 'publishers' ? 'nhà xuất bản' : type.value === 'authors' ? 'tác giả' : 'thể loại'}`, sortable: true },
  { key: detailField.value, label: detailLabel.value },
  { key: 'createdAt', label: 'Ngày tạo', sortable: true },
]);

onMounted(loadItems);
watch(() => [type.value, route.query.q, route.query.page, route.query.sort], loadItems);

async function loadItems() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminCatalogItems(type.value, {
      q: query.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    const payload = Array.isArray(result.data) ? result.data : [];
    const key = type.value === 'publishers' ? 'publishers' : type.value;
    items.value = payload.length || Array.isArray(result[key]) ? payload : (result[key] || []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function setQuery(values) {
  const nextQuery = { ...route.query, ...values };
  Object.keys(nextQuery).forEach((key) => {
    if (nextQuery[key] === '' || nextQuery[key] == null) delete nextQuery[key];
  });
  router.replace({ query: nextQuery });
}

function chooseType(value) {
  setQuery({ type: value, page: undefined, sort: undefined });
}

function updateSearch(value) { setQuery({ q: value.trim() || undefined, page: undefined }); }
function updatePage(value) { setQuery({ page: value === 1 ? undefined : String(value) }); }
function updateSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key, page: undefined }); }

function openCreate() {
  editingItem.value = null;
  form.name = '';
  form.detail = '';
  modalOpen.value = true;
}

function openEdit(item) {
  editingItem.value = item;
  form.name = item.name || '';
  form.detail = item[detailField.value] || '';
  modalOpen.value = true;
}

async function submitForm() {
  const name = form.name.trim();
  if (!name || saving.value) return;
  const payload = { name, [detailField.value]: form.detail.trim() };
  saving.value = true;
  try {
    if (editingItem.value?._id) {
      await updateAdminCatalogItem(type.value, editingItem.value._id, payload);
      toast.success(`Đã cập nhật ${typeConfig.value.label.toLowerCase()}.`);
    } else {
      await createAdminCatalogItem(type.value, payload);
      toast.success(`Đã thêm ${typeConfig.value.label.toLowerCase()}.`);
    }
    modalOpen.value = false;
    await loadItems();
  } catch (error) {
    const message = error.response?.data?.message;
    toast.error(message || `Không thể lưu ${typeConfig.value.label.toLowerCase()}.`);
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  const result = await Swal.fire({
    title: `Xóa “${item.name}”?`,
    text: 'Không thể xóa mục danh mục đang được sách sử dụng.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Xóa',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!result.isConfirmed) return;
  deletingId.value = item._id;
  try {
    await deleteAdminCatalogItem(type.value, item._id);
    toast.success(`Đã xóa ${typeConfig.value.label.toLowerCase()}.`);
    await loadItems();
  } catch (error) {
    const statusCode = error.response?.status;
    if (statusCode === 409) {
      toast.error(error.response?.data?.message || 'Không thể xóa vì mục danh mục đang được sách sử dụng.');
    } else {
      toast.error(error.response?.data?.message || `Không thể xóa ${typeConfig.value.label.toLowerCase()}.`);
    }
  } finally {
    deletingId.value = '';
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}
</script>

<template>
  <section class="catalog-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Danh mục</span>
    </nav>
    <div class="page-heading catalog-heading">
      <div>
        <h1>Quản lý danh mục</h1><p class="text-muted-strong mb-0">
          Quản lý nhà xuất bản, tác giả và thể loại sách.
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
        />Thêm {{ typeConfig.label.toLowerCase() }}
      </button>
    </div>

    <div
      class="catalog-tabs"
      role="tablist"
      aria-label="Loại danh mục"
    >
      <button
        v-for="tab in catalogTypes"
        :key="tab.key"
        class="catalog-tab"
        :class="{ 'is-active': type === tab.key }"
        type="button"
        role="tab"
        :aria-selected="type === tab.key"
        @click="chooseType(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="items"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :query="query"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      @update:query="updateSearch"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadItems"
    >
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
      </template>
      <template #[`cell-${detailField}`]="{ value }">
        <span class="detail-cell">{{ value || '—' }}</span>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #row="{ row }">
        <div class="row-actions">
          <button
            class="btn btn-sm btn-outline-primary"
            type="button"
            :disabled="Boolean(deletingId)"
            @click="openEdit(row)"
          >
            Sửa
          </button>
          <button
            class="btn btn-sm btn-outline-danger"
            type="button"
            :disabled="Boolean(deletingId)"
            @click="removeItem(row)"
          >
            <span
              v-if="deletingId === row._id"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            />Xóa
          </button>
        </div>
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-tags"
            aria-hidden="true"
          /><span>Chưa có {{ typeConfig.label.toLowerCase() }} phù hợp.</span>
        </div>
      </template>
      <template #error>
        Không tải được {{ typeConfig.label.toLowerCase() }}.
        <button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadItems"
        >
          Thử lại
        </button>
      </template>
    </DataTable>

    <div
      v-if="modalOpen"
      class="modal-backdrop-custom"
      @click.self="modalOpen = false"
    >
      <section
        class="catalog-modal surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-modal-title"
      >
        <header class="modal-heading">
          <div>
            <span class="eyebrow">Danh mục thư viện</span><h2 id="catalog-modal-title">
              {{ editingItem ? 'Cập nhật' : 'Thêm' }} {{ typeConfig.label.toLowerCase() }}
            </h2>
          </div>
          <button
            class="icon-close"
            type="button"
            aria-label="Đóng biểu mẫu"
            @click="modalOpen = false"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <form @submit.prevent="submitForm">
          <label
            class="form-field"
            for="catalog-name"
          ><span>Tên {{ type === 'publishers' ? 'nhà xuất bản' : type === 'authors' ? 'tác giả' : 'thể loại' }} <b>*</b></span><input
            id="catalog-name"
            v-model.trim="form.name"
            class="form-control"
            :maxlength="type === 'publishers' ? 150 : 100"
            required
          ></label>
          <label
            class="form-field"
            for="catalog-detail"
          ><span>{{ detailLabel }}</span><textarea
            id="catalog-detail"
            v-model.trim="form.detail"
            class="form-control"
            :placeholder="detailPlaceholder"
            :maxlength="detailMaxLength"
            rows="4"
          /></label>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="saving"
              @click="modalOpen = false"
            >
              Hủy
            </button><button
              class="btn btn-primary"
              type="submit"
              :disabled="saving || !form.name.trim()"
            >
              <span
                v-if="saving"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />{{ editingItem ? 'Lưu thay đổi' : 'Thêm mới' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }
.catalog-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }.catalog-heading p { margin-top: .35rem; font-size: .9rem; }
.catalog-tabs { display: flex; gap: .35rem; margin-bottom: 1rem; padding: .3rem; border-bottom: 1px solid #e5e7eb; }.catalog-tab { padding: .65rem 1rem; border: 0; border-radius: .5rem .5rem 0 0; background: transparent; color: #6b7280; font-size: .9rem; }.catalog-tab:hover { background: #f8fafc; color: #1d4ed8; }.catalog-tab.is-active { border-bottom: 2px solid #2563eb; color: #1d4ed8; font-weight: 600; }
.detail-cell { display: block; max-width: 520px; color: #6b7280; white-space: normal; }.row-actions { display: flex; gap: .4rem; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: grid; overflow-y: auto; place-items: center; padding: 1rem; background: rgb(17 24 39 / 45%); }.catalog-modal { width: min(100%, 520px); padding: 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }
.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }
.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }.form-field b { color: #dc2626; }.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 575.98px) { .catalog-heading { align-items: flex-start; flex-direction: column; }.catalog-heading > button { width: 100%; }.catalog-tabs { overflow-x: auto; }.catalog-tab { flex: 1 0 auto; padding-right: .7rem; padding-left: .7rem; }.catalog-modal { padding: 1rem; }.row-actions { align-items: flex-start; flex-direction: column; } }
</style>
