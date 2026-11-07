<template>
  <div class="thread-new-page py-4 bg-light min-vh-100">
    <div
      class="container"
      style="max-width: 900px;"
    >
      <!-- Breadcrumb -->
      <nav
        aria-label="breadcrumb"
        class="mb-3"
      >
        <ol class="breadcrumb mb-0 small">
          <li class="breadcrumb-item">
            <RouterLink
              to="/"
              class="text-decoration-none text-secondary"
            >
              Trang chủ
            </RouterLink>
          </li>
          <li class="breadcrumb-item">
            <RouterLink
              to="/forum"
              class="text-decoration-none text-secondary"
            >
              Diễn đàn
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active text-dark fw-medium"
            aria-current="page"
          >
            Tạo chủ đề mới
          </li>
        </ol>
      </nav>

      <!-- Card Form tạo chủ đề -->
      <div class="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        <div class="card-header bg-white border-bottom p-4">
          <h1 class="h4 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i
              class="bi bi-pencil-square text-primary"
              aria-hidden="true"
            />
            <span>Tạo chủ đề thảo luận mới</span>
          </h1>
          <p class="text-secondary small mb-0">
            Chia sẻ cảm nhận sách, đặt câu hỏi hoặc trao đổi cùng cộng đồng độc giả thư viện.
          </p>
        </div>

        <form
          class="card-body p-4"
          @submit.prevent="handleSubmit"
        >
          <!-- 1. Chọn Chuyên mục -->
          <div class="mb-3">
            <label
              for="threadCategory"
              class="form-label fw-semibold text-dark small"
            >
              Chuyên mục <span class="text-danger">*</span>
            </label>
            <div class="position-relative">
              <select
                id="threadCategory"
                v-model="form.category"
                class="form-select rounded-3"
                :class="{ 'is-invalid': errors.category }"
                :disabled="loadingCategories || submitting"
              >
                <option
                  value=""
                  disabled
                >
                  -- Chọn chuyên mục diễn đàn phù hợp --
                </option>
                <option
                  v-for="cat in categories"
                  :key="cat._id"
                  :value="cat._id"
                >
                  {{ cat.name }}
                </option>
              </select>
              <div
                v-if="loadingCategories"
                class="position-absolute end-0 top-50 translate-middle-y me-4"
              >
                <span class="spinner-border spinner-border-sm text-secondary" />
              </div>
            </div>
            <div
              v-if="errors.category"
              class="invalid-feedback d-block"
            >
              {{ errors.category }}
            </div>
          </div>

          <!-- 2. Tiêu đề chủ đề -->
          <div class="mb-3">
            <label
              for="threadTitle"
              class="form-label fw-semibold text-dark small"
            >
              Tiêu đề chủ đề <span class="text-danger">*</span>
            </label>
            <input
              id="threadTitle"
              v-model="form.title"
              type="text"
              class="form-control rounded-3"
              :class="{ 'is-invalid': errors.title }"
              maxlength="150"
              placeholder="Tóm tắt ngắn gọn nội dung bài viết (tối đa 150 ký tự)..."
              :disabled="submitting"
            >
            <div class="d-flex justify-content-between align-items-center mt-1 small">
              <div
                v-if="errors.title"
                class="text-danger"
              >
                {{ errors.title }}
              </div>
              <div
                v-else
                class="text-muted"
              >
                Nên đặt tiêu đề rõ ràng, lịch sự và thu hút.
              </div>
              <div class="text-muted ms-auto">
                {{ form.title.length }}/150
              </div>
            </div>
          </div>

          <!-- 3. Gắn sách liên quan (Tùy chọn) -->
          <div class="mb-3">
            <label class="form-label fw-semibold text-dark small mb-1">
              Sách liên quan <span class="text-muted fw-normal">(tùy chọn)</span>
            </label>

            <!-- Sách đã chọn -->
            <div
              v-if="selectedBook"
              class="d-flex align-items-center justify-content-between p-2.5 rounded-3 border bg-light-subtle mb-2"
            >
              <div class="d-flex align-items-center gap-3 min-w-0">
                <img
                  v-if="selectedBookCover"
                  :src="selectedBookCover"
                  :alt="selectedBook.title"
                  class="rounded object-fit-cover border"
                  style="width: 36px; height: 50px;"
                >
                <div class="min-w-0">
                  <div class="fw-bold text-dark text-truncate small">
                    {{ selectedBook.title }}
                  </div>
                  <div class="text-muted fs-8">
                    {{ selectedBookAuthors }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger rounded-circle p-1 ms-2"
                style="width: 28px; height: 28px;"
                title="Gỡ sách liên quan"
                :disabled="submitting"
                @click="removeSelectedBook"
              >
                <i
                  class="bi bi-x"
                  aria-hidden="true"
                />
              </button>
            </div>

            <!-- Ô tìm kiếm sách nếu chưa chọn -->
            <div
              v-else
              class="position-relative"
            >
              <div class="input-group">
                <span class="input-group-text bg-white border-end-0 text-muted">
                  <i
                    class="bi bi-search"
                    aria-hidden="true"
                  />
                </span>
                <input
                  v-model="bookSearchQuery"
                  type="text"
                  class="form-control border-start-0"
                  placeholder="Gõ tên cuốn sách để tìm kiếm và gắn vào chủ đề..."
                  :disabled="submitting"
                  @input="handleBookSearch"
                  @focus="showBookResults = true"
                >
                <button
                  v-if="bookSearchQuery"
                  class="btn btn-outline-secondary border-start-0"
                  type="button"
                  @click="clearBookSearch"
                >
                  <i
                    class="bi bi-x"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <!-- Menu kết quả tìm kiếm -->
              <div
                v-if="showBookResults && (searchingBooks || searchBookResults.length > 0 || (bookSearchQuery && !searchingBooks))"
                class="position-absolute start-0 end-0 bg-white shadow rounded-3 border mt-1 p-2 z-3 overflow-auto"
                style="max-height: 280px;"
              >
                <div
                  v-if="searchingBooks"
                  class="text-center py-3 text-muted small"
                >
                  <span class="spinner-border spinner-border-sm me-1" />
                  Đang tìm kiếm sách...
                </div>
                <div
                  v-else-if="searchBookResults.length === 0"
                  class="text-center py-3 text-muted small"
                >
                  Không tìm thấy cuốn sách nào phù hợp.
                </div>
                <div
                  v-for="b in searchBookResults"
                  v-else
                  :key="b._id"
                  class="d-flex align-items-center gap-2.5 p-2 rounded-2 hover-bg-light cursor-pointer"
                  @click="selectBook(b)"
                >
                  <img
                    v-if="getBookThumb(b)"
                    :src="getBookThumb(b)"
                    :alt="b.title"
                    class="rounded object-fit-cover border flex-shrink-0"
                    style="width: 32px; height: 44px;"
                  >
                  <div class="min-w-0 flex-grow-1">
                    <div class="fw-semibold text-dark text-truncate small">
                      {{ b.title }}
                    </div>
                    <div class="text-muted fs-8">
                      {{ (b.authors || []).map(a => a.name || a).join(', ') || 'Nhiều tác giả' }}
                    </div>
                  </div>
                  <span class="btn btn-sm btn-light border-0 text-primary fs-8 rounded-pill px-2 py-0.5">
                    Chọn
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Thẻ Tag (Tùy chọn) -->
          <div class="mb-3">
            <label class="form-label fw-semibold text-dark small mb-1">
              Thẻ từ khóa (Tags) <span class="text-muted fw-normal">(tùy chọn, tối đa 10 thẻ)</span>
            </label>
            <div class="d-flex flex-wrap align-items-center gap-1.5 p-2 rounded-3 border bg-white">
              <span
                v-for="(tag, index) in form.tags"
                :key="tag"
                class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill py-1 px-2.5 d-inline-flex align-items-center gap-1 small"
              >
                #{{ tag }}
                <button
                  type="button"
                  class="btn-close fs-8 ms-1 p-0"
                  aria-label="Xóa thẻ"
                  :disabled="submitting"
                  @click="removeTag(index)"
                />
              </span>
              <input
                v-if="form.tags.length < 10"
                v-model="tagInput"
                type="text"
                class="form-control form-control-sm border-0 shadow-none flex-grow-1 min-w-120"
                placeholder="Nhập thẻ rồi nhấn Enter hoặc dấu phẩy..."
                :disabled="submitting"
                @keydown.enter.prevent="addTag"
                @keydown="handleTagKeydown"
              >
            </div>
            <div class="small text-muted mt-1">
              Ví dụ: <code>review</code>, <code>kinh-te</code>, <code>hoi-dap</code>
            </div>
          </div>

          <!-- 5. Nội dung bài viết (Markdown Editor có xem trước) -->
          <div class="mb-4">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <label class="form-label fw-semibold text-dark small mb-0">
                Nội dung chi tiết <span class="text-danger">*</span>
              </label>

              <!-- Tabs Soạn thảo / Xem trước -->
              <div
                class="btn-group btn-group-sm"
                role="group"
              >
                <button
                  type="button"
                  class="btn"
                  :class="editorTab === 'write' ? 'btn-primary' : 'btn-outline-secondary'"
                  :disabled="submitting"
                  @click="editorTab = 'write'"
                >
                  <i
                    class="bi bi-pencil-square me-1"
                    aria-hidden="true"
                  />
                  Soạn thảo
                </button>
                <button
                  type="button"
                  class="btn"
                  :class="editorTab === 'preview' ? 'btn-primary' : 'btn-outline-secondary'"
                  :disabled="submitting"
                  @click="editorTab = 'preview'"
                >
                  <i
                    class="bi bi-eye me-1"
                    aria-hidden="true"
                  />
                  Xem trước
                </button>
              </div>
            </div>

            <!-- Toolbar định dạng nhanh Markdown -->
            <div
              v-show="editorTab === 'write'"
              class="d-flex flex-wrap align-items-center gap-1 p-2 bg-light border border-bottom-0 rounded-top-3"
            >
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="Tiêu đề"
                :disabled="submitting"
                @click="insertPrefix('### ')"
              >
                <i
                  class="bi bi-type-h3"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="In đậm (Ctrl+B)"
                :disabled="submitting"
                @click="insertFormat('**', '**', 'nội dung in đậm')"
              >
                <i
                  class="bi bi-type-bold"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="In nghiêng (Ctrl+I)"
                :disabled="submitting"
                @click="insertFormat('*', '*', 'nội dung in nghiêng')"
              >
                <i
                  class="bi bi-type-italic"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="Trích dẫn"
                :disabled="submitting"
                @click="insertPrefix('> ')"
              >
                <i
                  class="bi bi-quote"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="Danh sách gạch đầu dòng"
                :disabled="submitting"
                @click="insertPrefix('- ')"
              >
                <i
                  class="bi bi-list-ul"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="Đoạn mã code"
                :disabled="submitting"
                @click="insertFormat('```\n', '\n```', 'đoạn mã')"
              >
                <i
                  class="bi bi-code-slash"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-white border-0 text-secondary p-1 px-2 rounded"
                title="Chèn liên kết"
                :disabled="submitting"
                @click="insertLink"
              >
                <i
                  class="bi bi-link-45deg"
                  aria-hidden="true"
                />
              </button>
            </div>

            <!-- Khung viết textarea -->
            <div v-show="editorTab === 'write'">
              <textarea
                ref="contentTextareaRef"
                v-model="form.content"
                class="form-control rounded-bottom-3"
                :class="{ 'rounded-top-0': true, 'is-invalid': errors.content }"
                rows="10"
                maxlength="10000"
                placeholder="Viết nội dung thảo luận chi tiết của bạn tại đây... Hỗ trợ cú pháp Markdown chuẩn."
                :disabled="submitting"
              />
            </div>

            <!-- Khung xem trước Markdown -->
            <div
              v-show="editorTab === 'preview'"
              class="card-body border rounded-3 p-3 bg-light min-h-editor-preview overflow-auto"
            >
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="form.content.trim()"
                class="markdown-body fs-6 text-dark"
                v-html="renderedContent"
              />
              <!-- eslint-enable vue/no-v-html -->
              <div
                v-else
                class="text-muted small fst-italic py-5 text-center"
              >
                Chưa có nội dung để xem trước...
              </div>
            </div>

            <!-- Footer textarea: Lỗi & Đếm ký tự -->
            <div class="d-flex justify-content-between align-items-center mt-1 small">
              <div
                v-if="errors.content"
                class="text-danger"
              >
                {{ errors.content }}
              </div>
              <div
                v-else
                class="text-muted"
              >
                Hỗ trợ định dạng văn bản Markdown cơ bản.
              </div>
              <div class="text-muted ms-auto">
                {{ form.content.length }}/10000
              </div>
            </div>
          </div>

          <!-- Lỗi tổng thể từ máy chủ (nếu có) -->
          <div
            v-if="serverError"
            class="alert alert-danger py-2.5 small d-flex align-items-center gap-2 rounded-3 mb-4"
          >
            <i
              class="bi bi-exclamation-octagon-fill"
              aria-hidden="true"
            />
            <span>{{ serverError }}</span>
          </div>

          <!-- Thanh nút hành động -->
          <div class="d-flex align-items-center justify-content-between pt-3 border-top">
            <RouterLink
              to="/forum"
              class="btn btn-outline-secondary rounded-pill px-4"
            >
              Hủy bỏ
            </RouterLink>

            <button
              type="submit"
              class="btn btn-primary rounded-pill px-5 fw-semibold d-inline-flex align-items-center gap-2"
              :disabled="submitting || !isValid"
            >
              <span
                v-if="submitting"
                class="spinner-border spinner-border-sm"
                aria-hidden="true"
              />
              <i
                v-else
                class="bi bi-send-fill"
                aria-hidden="true"
              />
              <span>Đăng chủ đề</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import forumService from '@/services/forum.service';
import bookService from '@/services/book.service';
import { renderMarkdown } from '@/utils/markdown';
import { cloudinaryThumb } from '@/utils/image';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const categories = ref([]);
const loadingCategories = ref(true);
const submitting = ref(false);
const serverError = ref('');

const form = reactive({
  category: '',
  title: '',
  content: '',
  book: '',
  tags: [],
});

const errors = reactive({
  category: '',
  title: '',
  content: '',
});

// Sách liên quan
const selectedBook = ref(null);
const bookSearchQuery = ref('');
const searchingBooks = ref(false);
const searchBookResults = ref([]);
const showBookResults = ref(false);
let searchDebounceTimer = null;

// Thẻ tags
const tagInput = ref('');

// Markdown editor
const editorTab = ref('write'); // 'write' | 'preview'
const contentTextareaRef = ref(null);

const isValid = computed(() => {
  return Boolean(form.category) && form.title.trim().length >= 1 && form.content.trim().length >= 1;
});

const renderedContent = computed(() => {
  return renderMarkdown(form.content);
});

const selectedBookCover = computed(() => {
  if (!selectedBook.value) return '';
  const raw = selectedBook.value.cover?.url || selectedBook.value.cover;
  if (!raw || typeof raw !== 'string') return '';
  return cloudinaryThumb(raw, 80);
});

const selectedBookAuthors = computed(() => {
  if (!selectedBook.value) return '';
  const authors = selectedBook.value.authors || [];
  return authors.map((a) => a.name || a).join(', ') || 'Nhiều tác giả';
});

function getBookThumb(book) {
  const raw = book?.cover?.url || book?.cover;
  if (!raw || typeof raw !== 'string') return '';
  return cloudinaryThumb(raw, 70);
}

async function loadCategories() {
  loadingCategories.value = true;
  try {
    const list = await forumService.getCategories();
    categories.value = list;

    // Nếu query có category slug hoặc id
    const queryCat = route.query.category;
    if (queryCat) {
      const matched = list.find((c) => c._id === queryCat || c.slug === queryCat);
      if (matched) {
        form.category = matched._id;
      }
    }
  } catch (err) {
    toast.error('Không thể tải danh sách chuyên mục diễn đàn: ' + (err?.message || ''));
  } finally {
    loadingCategories.value = false;
  }
}

async function checkPrefilledBook() {
  const bookId = route.query.bookId;
  const bookTitle = route.query.bookTitle;

  if (bookId) {
    form.book = bookId;
    if (bookTitle) {
      selectedBook.value = { _id: bookId, title: bookTitle };
    }
    try {
      const bookData = await bookService.getBookByIdOrSlug(bookId);
      if (bookData) {
        selectedBook.value = bookData;
        form.book = bookData._id;
      }
    } catch {
      // Giữ thông tin cơ bản nếu không tải được chi tiết
    }
  }
}

function handleBookSearch() {
  clearTimeout(searchDebounceTimer);
  const q = bookSearchQuery.value.trim();

  if (!q) {
    searchBookResults.value = [];
    return;
  }

  showBookResults.value = true;
  searchingBooks.value = true;

  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await bookService.getBooks({ q, limit: 6 });
      searchBookResults.value = res.books || [];
    } catch {
      searchBookResults.value = [];
    } finally {
      searchingBooks.value = false;
    }
  }, 300);
}

function clearBookSearch() {
  bookSearchQuery.value = '';
  searchBookResults.value = [];
  showBookResults.value = false;
}

function selectBook(b) {
  selectedBook.value = b;
  form.book = b._id;
  clearBookSearch();
}

function removeSelectedBook() {
  selectedBook.value = null;
  form.book = '';
}

function addTag() {
  const val = tagInput.value.trim().replace(/^#/, '').toLowerCase();
  if (!val) return;

  if (form.tags.length >= 10) {
    toast.info('Tối đa 10 thẻ từ khóa cho một chủ đề');
    tagInput.value = '';
    return;
  }

  if (!form.tags.includes(val)) {
    form.tags.push(val);
  }
  tagInput.value = '';
}

function handleTagKeydown(e) {
  if (e.key === ',') {
    e.preventDefault();
    addTag();
  }
}

function removeTag(index) {
  form.tags.splice(index, 1);
}

function insertFormat(prefix, suffix, defaultText = '') {
  const el = contentTextareaRef.value;
  if (!el) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = form.content.substring(start, end) || defaultText;

  form.content = form.content.substring(0, start) + prefix + selected + suffix + form.content.substring(end);

  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  });
}

function insertPrefix(prefix) {
  const el = contentTextareaRef.value;
  if (!el) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = form.content.substring(start, end);

  form.content = form.content.substring(0, start) + prefix + selected + form.content.substring(end);

  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  });
}

function insertLink() {
  insertFormat('[', '](https://)', 'Tiêu đề liên kết');
}

function validate() {
  let ok = true;
  errors.category = '';
  errors.title = '';
  errors.content = '';

  if (!form.category) {
    errors.category = 'Vui lòng chọn một chuyên mục cho chủ đề.';
    ok = false;
  }

  if (!form.title.trim()) {
    errors.title = 'Vui lòng nhập tiêu đề chủ đề.';
    ok = false;
  } else if (form.title.trim().length > 150) {
    errors.title = 'Tiêu đề không được vượt quá 150 ký tự.';
    ok = false;
  }

  if (!form.content.trim()) {
    errors.content = 'Vui lòng nhập nội dung chi tiết bài viết.';
    ok = false;
  }

  return ok;
}

async function handleSubmit() {
  if (!validate() || submitting.value) return;

  submitting.value = true;
  serverError.value = '';

  // Thêm tag đang gõ dở nếu có
  if (tagInput.value.trim()) {
    addTag();
  }

  const payload = {
    category: form.category,
    title: form.title.trim(),
    content: form.content.trim(),
    book: form.book || null,
    tags: form.tags,
  };

  try {
    const createdThread = await forumService.createThread(payload);
    toast.success('Đã tạo chủ đề thành công');
    router.push({ path: `/forum/t/${createdThread.slug || createdThread._id}` });
  } catch (err) {
    serverError.value = err?.response?.data?.message || err?.message || 'Không thể đăng chủ đề. Vui lòng kiểm tra lại.';
    toast.error('Lỗi đăng bài: ' + serverError.value);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadCategories();
  checkPrefilledBook();
});
</script>

<style scoped>
.min-w-120 {
  min-width: 120px;
}

.min-h-editor-preview {
  min-height: 250px;
}

.fs-8 {
  font-size: 0.75rem;
}

.cursor-pointer {
  cursor: pointer;
}

.hover-bg-light:hover {
  background-color: #f3f4f6;
}

.btn-white {
  background-color: #ffffff;
}

.btn-white:hover {
  background-color: #e5e7eb;
}
</style>
