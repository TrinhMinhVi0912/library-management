<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { createAdminAuthor, createAdminCategory } from '@/services/admin.service';

const props = defineProps({
  book: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
  authors: { type: Array, default: () => [] },
  publishers: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
});
const emit = defineEmits(['submit', 'cancel', 'author-created', 'category-created']);
const toast = useToast();
const imageFile = ref(null);
const imagePreview = ref('');
const quickAuthorLoading = ref(false);
const quickCategoryLoading = ref(false);
const newCategoryName = ref('');
const authorSearch = ref('');
const categorySearch = ref('');
const form = reactive({});
let previewObjectUrl = '';

const title = computed(() => (props.book?._id ? 'Cập nhật sách' : 'Thêm sách'));
const selectedAuthors = computed(() => props.authors.filter((author) => form.authors?.includes(author._id)));
const selectedCategories = computed(() => props.categories.filter((category) => form.categories?.includes(category._id)));
const filteredAuthors = computed(() => filterOptions(props.authors, authorSearch.value));
const filteredCategories = computed(() => filterOptions(props.categories, categorySearch.value));
watch(() => props.book, initializeForm, { immediate: true });
onBeforeUnmount(clearPreviewUrl);

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
}

function filterOptions(options, query) {
  const normalizedQuery = normalizeSearch(query.trim());
  if (!normalizedQuery) return [];
  return options
    .filter((option) => normalizeSearch(option.name).includes(normalizedQuery))
    .slice(0, 6);
}

function toggleSelection(field, id) {
  form[field] = form[field].includes(id)
    ? form[field].filter((selectedId) => selectedId !== id)
    : [...form[field], id];
}

function initializeForm() {
  const book = props.book || {};
  Object.assign(form, {
    title: book.title || '',
    isbn: book.isbn || '',
    authors: (book.authors || []).map((author) => (typeof author === 'object' ? author._id : author)),
    authorText: book.authorText || '',
    publisher: typeof book.publisher === 'object' ? book.publisher?._id || '' : book.publisher || '',
    publishYear: book.publishYear || '',
    price: book.price ?? 0,
    totalCopies: book.totalCopies ?? 0,
    categories: (book.categories || []).map((category) => (typeof category === 'object' ? category._id : category)),
    language: book.language || 'Tiếng Việt',
    pages: book.pages || '',
    description: book.description || '',
    location: book.location || '',
  });
  authorSearch.value = '';
  categorySearch.value = '';
  imageFile.value = null;
  clearPreviewUrl();
  imagePreview.value = book.cover?.url || '';
}

function clearPreviewUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
}

function handleImage(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
    event.target.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Ảnh bìa không được vượt quá 2MB.');
    event.target.value = '';
    return;
  }
  clearPreviewUrl();
  imageFile.value = file;
  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.value = previewObjectUrl;
}

async function quickAddAuthor() {
  if (quickAuthorLoading.value) return;
  const name = window.prompt('Nhập tên tác giả mới');
  if (!name?.trim()) return;
  quickAuthorLoading.value = true;
  try {
    const author = await createAdminAuthor({ name: name.trim() });
    emit('author-created', author);
    form.authors = [...form.authors, author._id];
    toast.success('Đã tạo và chọn tác giả.');
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể tạo tác giả mới.');
  } finally {
    quickAuthorLoading.value = false;
  }
}

async function quickAddCategory() {
  const name = newCategoryName.value.trim();
  if (!name || quickCategoryLoading.value) return;
  quickCategoryLoading.value = true;
  try {
    const category = await createAdminCategory({ name });
    emit('category-created', category);
    form.categories = [...form.categories, category._id];
    newCategoryName.value = '';
    toast.success('Đã tạo và chọn thể loại.');
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể tạo thể loại mới.');
  } finally {
    quickCategoryLoading.value = false;
  }
}

function submitForm() {
  const payload = {
    ...form,
    publishYear: form.publishYear ? Number(form.publishYear) : null,
    pages: form.pages ? Number(form.pages) : null,
    price: Number(form.price) || 0,
    totalCopies: Number(form.totalCopies) || 0,
    publisher: form.publisher || null,
    status: props.book?.status || 'active',
  };
  emit('submit', { payload, imageFile: imageFile.value });
}
</script>

<template>
  <section
    class="book-form surface-card"
  >
    <header class="form-heading">
      <div>
        <span class="eyebrow">Kho sách</span><h2 id="book-form-title">
          {{ title }}
        </h2>
      </div>
      <button
        class="icon-close"
        type="button"
        aria-label="Quay lại danh sách sách"
        @click="emit('cancel')"
      >
        <i class="bi bi-x-lg" />
      </button>
    </header>
    <form @submit.prevent="submitForm">
      <div class="form-layout">
        <div class="cover-field">
          <span class="field-label">Ảnh bìa</span>
          <div class="cover-preview">
            <img
              v-if="imagePreview"
              :src="imagePreview"
              alt="Xem trước ảnh bìa sách"
            >
            <i
              v-else
              class="bi bi-image"
              aria-hidden="true"
            />
          </div>
          <label
            class="btn btn-outline-primary btn-sm"
            for="book-cover"
          >Chọn ảnh bìa</label>
          <input
            id="book-cover"
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="handleImage"
          >
          <small>JPG, PNG hoặc WEBP · tối đa 2MB</small>
        </div>
        <div class="fields-grid">
          <label class="form-field span-two"><span>Tên sách <b>*</b></span><input
            v-model.trim="form.title"
            class="form-control"
            maxlength="255"
            required
          ></label>
          <label class="form-field"><span>Mã ISBN</span><input
            v-model.trim="form.isbn"
            class="form-control"
            maxlength="30"
          ></label>
          <label class="form-field"><span>Năm xuất bản</span><input
            v-model="form.publishYear"
            class="form-control"
            type="number"
            min="1000"
            :max="new Date().getFullYear() + 1"
          ></label>
          <div class="form-field span-two">
            <span>Tác giả</span>
            <input
              v-model="authorSearch"
              class="form-control"
              type="search"
              autocomplete="off"
              placeholder="Tìm tên tác giả để thêm vào sách"
              aria-label="Tìm tác giả"
            >
            <div
              v-if="selectedAuthors.length"
              class="selected-options"
              aria-label="Tác giả đã chọn"
            >
              <span
                v-for="author in selectedAuthors"
                :key="author._id"
                class="selected-option"
              >
                {{ author.name }}
                <button
                  type="button"
                  :aria-label="`Bỏ tác giả ${author.name}`"
                  @click="toggleSelection('authors', author._id)"
                >
                  <i
                    class="bi bi-x"
                    aria-hidden="true"
                  />
                </button>
              </span>
            </div>
            <div
              v-if="authorSearch.trim()"
              class="search-results"
              role="listbox"
              aria-label="Kết quả tác giả"
              aria-multiselectable="true"
            >
              <button
                v-for="author in filteredAuthors"
                :key="author._id"
                class="search-result"
                :class="{ 'is-selected': form.authors.includes(author._id) }"
                type="button"
                role="option"
                :aria-selected="form.authors.includes(author._id)"
                @click="toggleSelection('authors', author._id)"
              >
                <span>{{ author.name }}</span><i
                  v-if="form.authors.includes(author._id)"
                  class="bi bi-check2"
                  aria-hidden="true"
                />
              </button>
              <span
                v-if="!filteredAuthors.length"
                class="search-empty"
              >Không tìm thấy tác giả phù hợp.</span>
              <span
                v-else-if="filteredAuthors.length === 6"
                class="search-hint"
              >Đang hiển thị 6 kết quả đầu. Nhập thêm để thu hẹp kết quả.</span>
            </div>
            <div class="field-inline">
              <input
                v-model.trim="form.authorText"
                class="form-control"
                maxlength="255"
                placeholder="Tên hiển thị nếu tác giả chưa có trong danh mục"
              ><button
                class="btn btn-outline-secondary btn-sm"
                type="button"
                :disabled="quickAuthorLoading"
                @click="quickAddAuthor"
              >
                Thêm tác giả nhanh
              </button>
            </div>
          </div>
          <label class="form-field"><span>Nhà xuất bản</span><select
            v-model="form.publisher"
            class="form-select"
          ><option value="">Chưa chọn</option><option
            v-for="publisher in publishers"
            :key="publisher._id"
            :value="publisher._id"
          >{{ publisher.name }}</option></select></label>
          <div class="form-field">
            <span>Thể loại</span>
            <input
              v-model="categorySearch"
              class="form-control"
              type="search"
              autocomplete="off"
              placeholder="Tìm thể loại để thêm vào sách"
              aria-label="Tìm thể loại"
            >
            <div
              v-if="selectedCategories.length"
              class="selected-options"
              aria-label="Thể loại đã chọn"
            >
              <span
                v-for="category in selectedCategories"
                :key="category._id"
                class="selected-option"
              >
                {{ category.name }}
                <button
                  type="button"
                  :aria-label="`Bỏ thể loại ${category.name}`"
                  @click="toggleSelection('categories', category._id)"
                >
                  <i
                    class="bi bi-x"
                    aria-hidden="true"
                  />
                </button>
              </span>
            </div>
            <div
              v-if="categorySearch.trim()"
              class="search-results"
              role="listbox"
              aria-label="Kết quả thể loại"
              aria-multiselectable="true"
            >
              <button
                v-for="category in filteredCategories"
                :key="category._id"
                class="search-result"
                :class="{ 'is-selected': form.categories.includes(category._id) }"
                type="button"
                role="option"
                :aria-selected="form.categories.includes(category._id)"
                @click="toggleSelection('categories', category._id)"
              >
                <span>{{ category.name }}</span><i
                  v-if="form.categories.includes(category._id)"
                  class="bi bi-check2"
                  aria-hidden="true"
                />
              </button>
              <span
                v-if="!filteredCategories.length"
                class="search-empty"
              >Không tìm thấy thể loại phù hợp.</span>
              <span
                v-else-if="filteredCategories.length === 6"
                class="search-hint"
              >Đang hiển thị 6 kết quả đầu. Nhập thêm để thu hẹp kết quả.</span>
            </div>
          </div>
          <div class="form-field span-two quick-category">
            <span>Thêm thể loại mới</span>
            <div class="field-inline">
              <input
                v-model.trim="newCategoryName"
                class="form-control"
                maxlength="100"
                placeholder="Nhập tên thể loại"
                @keydown.enter.prevent="quickAddCategory"
              >
              <button
                class="btn btn-outline-secondary btn-sm"
                type="button"
                :disabled="quickCategoryLoading || !newCategoryName.trim()"
                @click="quickAddCategory"
              >
                {{ quickCategoryLoading ? 'Đang tạo...' : 'Tạo thể loại' }}
              </button>
            </div>
          </div>
          <label class="form-field"><span>Đơn giá (VND)</span><input
            v-model="form.price"
            class="form-control"
            type="number"
            min="0"
            step="1000"
          ></label>
          <label class="form-field"><span>Tổng số bản</span><input
            v-model="form.totalCopies"
            class="form-control"
            type="number"
            min="0"
            step="1"
          ></label>
          <label class="form-field"><span>Ngôn ngữ</span><input
            v-model.trim="form.language"
            class="form-control"
            maxlength="50"
          ></label>
          <label class="form-field"><span>Số trang</span><input
            v-model="form.pages"
            class="form-control"
            type="number"
            min="1"
            step="1"
          ></label>
          <label class="form-field span-two"><span>Vị trí kệ</span><input
            v-model.trim="form.location"
            class="form-control"
            maxlength="100"
          ></label>
          <label class="form-field span-two"><span>Mô tả</span><textarea
            v-model.trim="form.description"
            class="form-control"
            rows="4"
            maxlength="5000"
          /></label>
        </div>
      </div>
      <footer class="form-actions">
        <button
          class="btn btn-outline-secondary"
          type="button"
          :disabled="saving"
          @click="emit('cancel')"
        >
          Hủy
        </button><button
          class="btn btn-primary"
          type="submit"
          :disabled="saving"
        >
          <span
            v-if="saving"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          />{{ book?._id ? 'Lưu thay đổi' : 'Tạo sách' }}
        </button>
      </footer>
    </form>
  </section>
</template>

<style scoped lang="scss">
.book-form { width: 100%; padding: 1.5rem; }
.form-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }.form-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }
.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }
.form-layout { display: grid; grid-template-columns: 200px 1fr; align-items: start; gap: 1.25rem; }.cover-field { display: grid; justify-items: start; gap: .6rem; }.field-label { font-size: .85rem; font-weight: 600; }.cover-preview { display: grid; width: 180px; aspect-ratio: 3 / 4; place-items: center; overflow: hidden; border: 1px dashed #cbd5e1; border-radius: .75rem; background: #f8fafc; color: #94a3b8; font-size: 2rem; }.cover-preview img { width: 100%; height: 100%; object-fit: cover; }.cover-field small { color: #6b7280; font-size: .7rem; }
.fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }.form-field { display: grid; align-content: start; gap: .35rem; font-size: .82rem; }.form-field b { color: #dc2626; }.span-two { grid-column: span 2; }.field-inline { display: flex; gap: .5rem; }.form-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.25rem; }
.selected-options { display: flex; flex-wrap: wrap; gap: .4rem; }
.selected-option { display: inline-flex; align-items: center; gap: .25rem; max-width: 100%; padding: .2rem .35rem .2rem .6rem; border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: .75rem; }
.selected-option button { display: grid; width: 1.15rem; height: 1.15rem; place-items: center; border: 0; border-radius: 50%; background: transparent; color: inherit; }
.selected-option button:hover { background: #dbeafe; }
.search-results { display: grid; border: 1px solid #dbe2ea; border-radius: .5rem; background: #fff; }
.search-result { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .55rem .7rem; border: 0; border-bottom: 1px solid #f1f5f9; background: #fff; color: #1f2937; text-align: left; }
.search-result:last-of-type { border-bottom: 0; }
.search-result:hover,.search-result.is-selected { background: #eff6ff; color: #1d4ed8; }
.search-empty,.search-hint { padding: .55rem .7rem; color: #6b7280; font-size: .75rem; }
@media (max-width: 700px) { .book-form { padding: 1rem; }.form-layout { grid-template-columns: 1fr; }.cover-field { grid-template-columns: auto 1fr; align-items: center; }.cover-field .field-label,.cover-field small { grid-column: 1 / -1; }.cover-preview { width: 100px; }.fields-grid { grid-template-columns: 1fr; }.span-two { grid-column: auto; }.field-inline { flex-direction: column; } }
</style>
