<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import shelfService from '@/services/shelf.service';
import RatingStars from '@/components/book/RatingStars.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import FormModal from '@/components/common/FormModal.vue';
import { cloudinaryThumb } from '@/utils/image';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const cartStore = useCartStore();

const shelves = ref([]);
const activeShelfId = ref(null);
const loading = ref(true);
const searchQuery = ref('');

// Modal tạo kệ mới
const createModalOpen = ref(false);
const newShelfName = ref('');
const isSubmittingCreate = ref(false);

// Modal đổi tên kệ
const renameModalOpen = ref(false);
const renameShelfName = ref('');
const isSubmittingRename = ref(false);

// Modal xóa kệ
const deleteShelfModalOpen = ref(false);
const isSubmittingDeleteShelf = ref(false);

// Modal xóa sách khỏi kệ
const removeBookModalOpen = ref(false);
const bookToRemove = ref(null);
const isSubmittingRemoveBook = ref(false);

// Modal chuyển sách sang kệ khác
const moveBookModalOpen = ref(false);
const bookToMove = ref(null);
const targetShelfId = ref('');
const isSubmittingMoveBook = ref(false);

// Tải danh sách kệ sách
async function fetchShelves() {
  loading.value = true;
  try {
    const data = await shelfService.getMyShelves();
    shelves.value = Array.isArray(data) ? data : [];
    if (shelves.value.length > 0) {
      // Nếu chưa chọn hoặc kệ được chọn không còn tồn tại
      if (!activeShelfId.value || !shelves.value.some((s) => s._id === activeShelfId.value)) {
        activeShelfId.value = shelves.value[0]._id;
      }
    } else {
      activeShelfId.value = null;
    }
  } catch (err) {
    console.error('Lỗi tải danh sách kệ sách:', err);
    toast.error('Không thể tải danh sách kệ sách.');
  } finally {
    loading.value = false;
  }
}

// Kệ hiện đang được kích hoạt
const activeShelf = computed(() => {
  return shelves.value.find((s) => s._id === activeShelfId.value) || shelves.value[0] || null;
});

// Kiểm tra kệ có phải là kệ mặc định không
const isDefaultShelf = computed(() => {
  if (!activeShelf.value) return false;
  return activeShelf.value.type !== 'custom' || ['Muốn đọc', 'Đang đọc', 'Đã đọc'].includes(activeShelf.value.name);
});

// Các kệ khác để chuyển sách tới (loại trừ kệ hiện tại)
const otherShelves = computed(() => {
  if (!activeShelf.value) return [];
  return shelves.value.filter((s) => s._id !== activeShelf.value._id);
});

// Lọc sách theo từ khóa tìm kiếm
const filteredBooks = computed(() => {
  if (!activeShelf.value || !Array.isArray(activeShelf.value.items)) return [];
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return activeShelf.value.items;

  return activeShelf.value.items.filter((item) => {
    const book = item.book;
    if (!book) return false;
    const titleMatch = book.title?.toLowerCase().includes(q);
    const codeMatch = book.code?.toLowerCase().includes(q);
    const authors = book.authors?.map((a) => (typeof a === 'string' ? a : a.name)).join(' ').toLowerCase();
    const authorMatch = authors?.includes(q);
    return titleMatch || codeMatch || authorMatch;
  });
});

// Icon theo loại kệ
function getShelfIcon(shelf) {
  if (shelf.type === 'want' || shelf.name === 'Muốn đọc') return 'bi-bookmark-star text-warning';
  if (shelf.type === 'reading' || shelf.name === 'Đang đọc') return 'bi-book-half text-primary';
  if (shelf.type === 'read' || shelf.name === 'Đã đọc') return 'bi-check2-circle text-success';
  return 'bi-folder2 text-secondary';
}

// Định dạng danh sách tác giả
function formatAuthors(book) {
  if (!book) return 'Chưa cập nhật';
  const names = book.authors?.map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean);
  return names?.join(', ') || book.authorText || 'Chưa cập nhật';
}

// Mở modal tạo kệ
function openCreateModal() {
  newShelfName.value = '';
  createModalOpen.value = true;
}

// Xử lý tạo kệ
async function handleCreateShelf() {
  const name = newShelfName.value.trim();
  if (!name) {
    toast.warning('Vui lòng nhập tên kệ sách.');
    return;
  }

  isSubmittingCreate.value = true;
  try {
    const created = await shelfService.createShelf({ name });
    toast.success(`Đã tạo kệ "${name}" thành công!`);
    createModalOpen.value = false;
    await fetchShelves();
    if (created?._id) {
      activeShelfId.value = created._id;
    }
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể tạo kệ sách.';
    toast.error(message);
  } finally {
    isSubmittingCreate.value = false;
  }
}

// Mở modal đổi tên kệ
function openRenameModal() {
  if (isDefaultShelf.value) return;
  renameShelfName.value = activeShelf.value.name;
  renameModalOpen.value = true;
}

// Xử lý đổi tên kệ
async function handleRenameShelf() {
  const name = renameShelfName.value.trim();
  if (!name) {
    toast.warning('Vui lòng nhập tên mới cho kệ sách.');
    return;
  }

  isSubmittingRename.value = true;
  try {
    await shelfService.updateShelf(activeShelf.value._id, { name });
    toast.success('Đã cập nhật tên kệ sách thành công!');
    renameModalOpen.value = false;
    await fetchShelves();
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể đổi tên kệ sách.';
    toast.error(message);
  } finally {
    isSubmittingRename.value = false;
  }
}

// Mở modal xóa kệ
function openDeleteShelfModal() {
  if (isDefaultShelf.value) return;
  deleteShelfModalOpen.value = true;
}

// Xử lý xóa kệ
async function handleDeleteShelf() {
  if (!activeShelf.value) return;

  isSubmittingDeleteShelf.value = true;
  try {
    await shelfService.deleteShelf(activeShelf.value._id);
    toast.success(`Đã xóa kệ "${activeShelf.value.name}".`);
    deleteShelfModalOpen.value = false;
    activeShelfId.value = null;
    await fetchShelves();
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể xóa kệ sách.';
    toast.error(message);
  } finally {
    isSubmittingDeleteShelf.value = false;
  }
}

// Mở modal xóa sách khỏi kệ
function openRemoveBookModal(book) {
  bookToRemove.value = book;
  removeBookModalOpen.value = true;
}

// Xử lý xóa sách khỏi kệ
async function handleRemoveBook() {
  if (!activeShelf.value || !bookToRemove.value) return;

  const bookId = bookToRemove.value._id || bookToRemove.value.id;
  const bookTitle = bookToRemove.value.title;

  isSubmittingRemoveBook.value = true;
  try {
    await shelfService.removeBookFromShelf(activeShelf.value._id, bookId);
    toast.success(`Đã xóa "${bookTitle}" khỏi kệ "${activeShelf.value.name}".`);
    removeBookModalOpen.value = false;
    bookToRemove.value = null;
    await fetchShelves();
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể xóa sách khỏi kệ.';
    toast.error(message);
  } finally {
    isSubmittingRemoveBook.value = false;
  }
}

// Mở modal chuyển sách
function openMoveBookModal(book) {
  bookToMove.value = book;
  targetShelfId.value = otherShelves.value[0]?._id || '';
  moveBookModalOpen.value = true;
}

// Xử lý chuyển sách sang kệ khác
async function handleMoveBook() {
  if (!activeShelf.value || !bookToMove.value || !targetShelfId.value) return;

  const bookId = bookToMove.value._id || bookToMove.value.id;
  const bookTitle = bookToMove.value.title;
  const destShelf = shelves.value.find((s) => s._id === targetShelfId.value);
  const destName = destShelf?.name || 'kệ đích';

  isSubmittingMoveBook.value = true;
  try {
    await shelfService.moveBookBetweenShelves(activeShelf.value._id, targetShelfId.value, bookId);
    toast.success(`Đã chuyển "${bookTitle}" sang kệ "${destName}".`);
    moveBookModalOpen.value = false;
    bookToMove.value = null;
    await fetchShelves();
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể chuyển sách sang kệ khác.';
    toast.error(message);
  } finally {
    isSubmittingMoveBook.value = false;
  }
}

// Thêm nhanh vào giỏ mượn
async function handleAddToCart(book) {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để mượn sách.');
    router.push({ name: 'login' });
    return;
  }

  const bookId = book._id || book.id;
  if (cartStore.isInCart(bookId)) {
    toast.info(`"${book.title}" đã có trong giỏ mượn.`);
    return;
  }

  const result = await cartStore.addItem(bookId);
  if (result.success) {
    toast.success(`Đã thêm "${book.title}" vào giỏ mượn!`);
  } else {
    toast.error(result.message || 'Không thể thêm vào giỏ mượn.');
  }
}

onMounted(() => {
  fetchShelves();
});
</script>

<template>
  <div class="my-shelves-page py-4">
    <div class="container">
      <!-- Page Header -->
      <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 class="h3 fw-bold mb-1 text-dark d-flex align-items-center gap-2">
            <i
              class="bi bi-bookshelf text-primary"
              aria-hidden="true"
            />
            <span>Kệ sách của tôi</span>
          </h1>
          <p class="text-secondary mb-0">
            Sắp xếp và quản lý các cuốn sách bạn quan tâm theo từng giai đoạn và danh mục riêng.
          </p>
        </div>

        <div>
          <button
            type="button"
            class="btn btn-primary d-inline-flex align-items-center gap-2"
            @click="openCreateModal"
          >
            <i
              class="bi bi-folder-plus"
              aria-hidden="true"
            />
            <span>Tạo kệ mới</span>
          </button>
        </div>
      </header>

      <!-- Main Layout: Sidebar Tabs + Content Grid -->
      <div class="row g-4">
        <!-- Sidebar: Danh sách các tab kệ -->
        <aside class="col-lg-3 col-md-4">
          <div class="card border-0 shadow-sm rounded-3 overflow-hidden sticky-top shelf-sidebar">
            <div class="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <span class="fw-semibold text-dark">Danh sách kệ</span>
              <span class="badge bg-light text-secondary border">{{ shelves.length }} kệ</span>
            </div>

            <div
              v-if="loading && shelves.length === 0"
              class="p-4 text-center text-muted"
            >
              <div
                class="spinner-border spinner-border-sm text-primary me-2"
                role="status"
              />
              <span class="fs-sm">Đang tải kệ...</span>
            </div>

            <div
              v-else
              class="list-group list-group-flush shelf-nav-list"
            >
              <button
                v-for="shelf in shelves"
                :key="shelf._id"
                type="button"
                class="list-group-item list-group-item-action shelf-nav-item py-3 px-3 border-start-4 transition"
                :class="{
                  'active-shelf': shelf._id === activeShelfId,
                  'border-start-primary': shelf._id === activeShelfId,
                  'border-start-transparent': shelf._id !== activeShelfId,
                }"
                @click="activeShelfId = shelf._id"
              >
                <div class="shelf-nav-main">
                  <span
                    class="shelf-nav-icon"
                    aria-hidden="true"
                  >
                    <i :class="[getShelfIcon(shelf), 'fs-5']" />
                  </span>
                  <div class="shelf-nav-copy">
                    <span class="d-block text-truncate fw-medium fs-sm shelf-title">
                      {{ shelf.name }}
                    </span>
                    <small
                      v-if="shelf.type !== 'custom'"
                      class="text-muted d-block fs-xs"
                    >Mặc định</small>
                    <small
                      v-else
                      class="text-muted d-block fs-xs"
                    >Tùy chỉnh</small>
                  </div>
                </div>

                <span
                  class="badge rounded-pill shelf-nav-count"
                  :class="shelf._id === activeShelfId ? 'bg-primary text-white' : 'bg-light text-secondary border'"
                >
                  {{ shelf.items?.length || 0 }}
                </span>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Content: Chi tiết kệ & danh sách sách -->
        <main class="col-lg-9 col-md-8">
          <!-- Loading state -->
          <div
            v-if="loading"
            class="text-center py-5 bg-white rounded-3 shadow-sm border p-4"
          >
            <div
              class="spinner-border text-primary mb-3"
              role="status"
            />
            <p class="text-secondary mb-0">
              Đang tải danh sách sách trong kệ...
            </p>
          </div>

          <!-- Empty state when no shelves exist -->
          <div
            v-else-if="!activeShelf"
            class="bg-white rounded-3 shadow-sm border p-4"
          >
            <EmptyState
              title="Chưa có kệ sách nào"
              description="Hệ thống đang chuẩn bị kệ sách cho bạn. Vui lòng tải lại trang."
              icon="bi-bookshelf"
              action-label="Tải lại"
              @action="fetchShelves"
            />
          </div>

          <!-- Active Shelf View -->
          <div
            v-else
            class="d-flex flex-column gap-3"
          >
            <!-- Shelf Information & Action Bar -->
            <div class="card border-0 shadow-sm rounded-3 p-3 bg-white">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div class="active-shelf-summary">
                  <span
                    class="active-shelf-icon"
                    aria-hidden="true"
                  >
                    <i :class="[getShelfIcon(activeShelf), 'fs-3']" />
                  </span>
                  <div class="active-shelf-copy">
                    <div class="active-shelf-title">
                      <h2 class="h5 fw-bold mb-0 text-dark">
                        {{ activeShelf.name }}
                      </h2>
                      <span
                        v-if="isDefaultShelf"
                        class="badge bg-secondary-subtle text-secondary border fs-xs"
                      >
                        Kệ mặc định
                      </span>
                      <span
                        v-else
                        class="badge bg-info-subtle text-info border fs-xs"
                      >
                        Kệ tùy chỉnh
                      </span>
                    </div>
                    <span class="text-muted small">
                      Tổng số: <strong>{{ activeShelf.items?.length || 0 }}</strong> cuốn sách
                    </span>
                  </div>
                </div>

                <!-- Custom Shelf Actions (Rename / Delete) -->
                <div
                  v-if="!isDefaultShelf"
                  class="d-flex align-items-center gap-2"
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5"
                    title="Đổi tên kệ này"
                    @click="openRenameModal"
                  >
                    <i
                      class="bi bi-pencil"
                      aria-hidden="true"
                    />
                    <span>Đổi tên</span>
                  </button>

                  <button
                    type="button"
                    class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
                    title="Xóa kệ này"
                    @click="openDeleteShelfModal"
                  >
                    <i
                      class="bi bi-trash"
                      aria-hidden="true"
                    />
                    <span>Xóa kệ</span>
                  </button>
                </div>
              </div>

              <!-- Search filter within active shelf -->
              <div
                v-if="activeShelf.items && activeShelf.items.length > 0"
                class="mt-3 pt-3 border-top"
              >
                <div class="row align-items-center justify-content-between g-2">
                  <div class="col-sm-6 col-md-5">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-white border-end-0 text-muted">
                        <i
                          class="bi bi-search"
                          aria-hidden="true"
                        />
                      </span>
                      <input
                        v-model="searchQuery"
                        type="search"
                        class="form-control border-start-0"
                        placeholder="Tìm sách trong kệ này..."
                        aria-label="Tìm kiếm trong kệ sách"
                      >
                      <button
                        v-if="searchQuery"
                        type="button"
                        class="btn btn-outline-secondary"
                        aria-label="Xóa từ khóa"
                        @click="searchQuery = ''"
                      >
                        <i class="bi bi-x" />
                      </button>
                    </div>
                  </div>

                  <div class="col-sm-auto text-muted small">
                    <span v-if="searchQuery">
                      Tìm thấy <strong>{{ filteredBooks.length }}</strong> kết quả
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Shelf State -->
            <div
              v-if="activeShelf.items && activeShelf.items.length === 0"
              class="card border-0 shadow-sm rounded-3 p-5 bg-white text-center"
            >
              <EmptyState
                title="Kệ này chưa có cuốn sách nào"
                description="Hãy khám phá thư viện sách để lưu những cuốn sách bạn yêu thích vào kệ này nhé!"
                icon="bi-journal-bookmark"
                action-label="Khám phá sách ngay"
                @action="router.push({ name: 'books' })"
              />
            </div>

            <!-- Empty Search Filter State -->
            <div
              v-else-if="filteredBooks.length === 0"
              class="card border-0 shadow-sm rounded-3 p-4 bg-white text-center"
            >
              <EmptyState
                title="Không tìm thấy cuốn sách nào"
                :description="`Không có sách nào khớp với từ khóa '${searchQuery}' trong kệ này.`"
                icon="bi-search"
                action-label="Xóa bộ lọc"
                @action="searchQuery = ''"
              />
            </div>

            <!-- Book Grid -->
            <div
              v-else
              class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-xl-3 g-3"
            >
              <div
                v-for="item in filteredBooks"
                :key="item.book?._id || item._id"
                class="col"
              >
                <div
                  v-if="item.book"
                  class="card h-100 border rounded-3 shadow-sm book-shelf-card overflow-hidden"
                >
                  <div class="row g-0 h-100">
                    <!-- Book Cover Column -->
                    <div class="col-4 col-sm-5 bg-light position-relative">
                      <RouterLink
                        :to="{ name: 'book-detail', params: { slug: item.book.slug || item.book._id } }"
                        class="d-block h-100"
                        :aria-label="`Xem chi tiết ${item.book.title}`"
                      >
                        <img
                          v-if="item.book.cover"
                          :src="cloudinaryThumb(item.book.cover?.url || item.book.cover, 240)"
                          :alt="`Bìa ${item.book.title}`"
                          class="book-shelf-cover w-100 h-100"
                          loading="lazy"
                        >
                        <div
                          v-else
                          class="book-shelf-fallback h-100 w-100 d-flex flex-column align-items-center justify-content-center text-muted p-2"
                        >
                          <i
                            class="bi bi-book fs-2 text-primary"
                            aria-hidden="true"
                          />
                          <span class="fs-xs text-center mt-1">Không có ảnh</span>
                        </div>
                      </RouterLink>
                    </div>

                    <!-- Book Information Column -->
                    <div class="col-8 col-sm-7 d-flex flex-column justify-content-between p-3">
                      <div>
                        <!-- Book Code -->
                        <span
                          v-if="item.book.code"
                          class="badge bg-light text-secondary border fs-xs mb-1"
                        >
                          {{ item.book.code }}
                        </span>

                        <!-- Book Title -->
                        <h3 class="fs-sm fw-bold mb-1 line-clamp-2">
                          <RouterLink
                            :to="{ name: 'book-detail', params: { slug: item.book.slug || item.book._id } }"
                            class="text-dark text-decoration-none hover-primary"
                          >
                            {{ item.book.title }}
                          </RouterLink>
                        </h3>

                        <!-- Author -->
                        <p class="text-secondary fs-xs mb-2 text-truncate">
                          {{ formatAuthors(item.book) }}
                        </p>

                        <!-- Rating -->
                        <div class="mb-2">
                          <RatingStars
                            :rating="Number(item.book.ratingAvg) || 0"
                            :count="Number(item.book.ratingCount) || 0"
                          />
                        </div>
                      </div>

                      <!-- Book Actions in Shelf -->
                      <div class="mt-2 pt-2 border-top d-flex flex-wrap align-items-center gap-1.5 justify-content-between">
                        <!-- Add to cart button -->
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-primary py-0.5 px-2 fs-xs d-inline-flex align-items-center gap-1"
                          :disabled="cartStore.isInCart(item.book._id)"
                          :title="cartStore.isInCart(item.book._id) ? 'Đã có trong giỏ mượn' : 'Thêm vào giỏ mượn'"
                          @click="handleAddToCart(item.book)"
                        >
                          <i
                            :class="cartStore.isInCart(item.book._id) ? 'bi bi-check-lg' : 'bi bi-bag-plus'"
                            aria-hidden="true"
                          />
                          <span>{{ cartStore.isInCart(item.book._id) ? 'Đã trong giỏ' : 'Mượn sách' }}</span>
                        </button>

                        <div class="d-flex align-items-center gap-1">
                          <!-- Move book to other shelf button -->
                          <button
                            v-if="otherShelves.length > 0"
                            type="button"
                            class="btn btn-sm btn-light border py-0.5 px-1.5 fs-xs text-secondary"
                            title="Chuyển sang kệ khác"
                            @click="openMoveBookModal(item.book)"
                          >
                            <i
                              class="bi bi-arrow-left-right"
                              aria-hidden="true"
                            />
                          </button>

                          <!-- Remove book from this shelf button -->
                          <button
                            type="button"
                            class="btn btn-sm btn-light border py-0.5 px-1.5 fs-xs text-danger"
                            title="Xóa khỏi kệ này"
                            @click="openRemoveBookModal(item.book)"
                          >
                            <i
                              class="bi bi-trash"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <!-- Modal: Tạo kệ sách mới -->
    <FormModal
      v-model="createModalOpen"
      title="Tạo kệ sách mới"
      submit-text="Tạo kệ"
      cancel-text="Hủy"
      :loading="isSubmittingCreate"
      :submit-disabled="!newShelfName.trim()"
      @submit="handleCreateShelf"
    >
      <div class="mb-3">
        <label
          for="create-shelf-name"
          class="form-label fw-medium"
        >Tên kệ sách <span class="text-danger">*</span></label>
        <input
          id="create-shelf-name"
          v-model="newShelfName"
          type="text"
          class="form-control"
          placeholder="Ví dụ: Sách kinh tế, Sách cho cuối tuần..."
          maxlength="50"
          autofocus
          required
        >
        <div class="form-text">
          Đặt tên gợi nhớ để phân loại và sắp xếp sách theo sở thích của bạn (tối đa 50 ký tự).
        </div>
      </div>
    </FormModal>

    <!-- Modal: Đổi tên kệ sách -->
    <FormModal
      v-model="renameModalOpen"
      title="Đổi tên kệ sách"
      submit-text="Lưu thay đổi"
      cancel-text="Hủy"
      :loading="isSubmittingRename"
      :submit-disabled="!renameShelfName.trim() || renameShelfName.trim() === activeShelf?.name"
      @submit="handleRenameShelf"
    >
      <div class="mb-3">
        <label
          for="rename-shelf-name"
          class="form-label fw-medium"
        >Tên kệ mới <span class="text-danger">*</span></label>
        <input
          id="rename-shelf-name"
          v-model="renameShelfName"
          type="text"
          class="form-control"
          placeholder="Nhập tên kệ mới..."
          maxlength="50"
          autofocus
          required
        >
      </div>
    </FormModal>

    <!-- Modal: Xác nhận xóa kệ sách -->
    <ConfirmModal
      v-model="deleteShelfModalOpen"
      title="Xác nhận xóa kệ sách"
      :message="`Bạn có chắc chắn muốn xóa kệ '${activeShelf?.name}'? Sách trong kệ này sẽ bị gỡ liên kết nhưng vẫn được lưu trữ bình thường trong hệ thống.`"
      confirm-text="Xóa kệ"
      cancel-text="Hủy"
      variant="danger"
      :loading="isSubmittingDeleteShelf"
      @confirm="handleDeleteShelf"
    />

    <!-- Modal: Xác nhận xóa sách khỏi kệ -->
    <ConfirmModal
      v-model="removeBookModalOpen"
      title="Gỡ sách khỏi kệ"
      :message="`Bạn có chắc chắn muốn xóa cuốn sách '${bookToRemove?.title}' khỏi kệ '${activeShelf?.name}'?`"
      confirm-text="Gỡ khỏi kệ"
      cancel-text="Hủy"
      variant="danger"
      :loading="isSubmittingRemoveBook"
      @confirm="handleRemoveBook"
    />

    <!-- Modal: Chuyển sách sang kệ khác -->
    <FormModal
      v-model="moveBookModalOpen"
      title="Chuyển sách sang kệ khác"
      submit-text="Chuyển ngay"
      cancel-text="Hủy"
      :loading="isSubmittingMoveBook"
      :submit-disabled="!targetShelfId"
      @submit="handleMoveBook"
    >
      <div class="mb-3">
        <p class="fs-sm mb-3">
          Cuốn sách: <strong>{{ bookToMove?.title }}</strong>
        </p>

        <label
          for="select-target-shelf"
          class="form-label fw-medium"
        >
          Chọn kệ sách đích <span class="text-danger">*</span>
        </label>
        <select
          id="select-target-shelf"
          v-model="targetShelfId"
          class="form-select"
          required
        >
          <option
            value=""
            disabled
          >
            -- Chọn một kệ sách --
          </option>
          <option
            v-for="s in otherShelves"
            :key="s._id"
            :value="s._id"
          >
            {{ s.name }} ({{ s.items?.length || 0 }} sách)
          </option>
        </select>
        <div class="form-text">
          Sách sẽ được chuyển từ kệ "<strong>{{ activeShelf?.name }}</strong>" sang kệ đã chọn.
        </div>
      </div>
    </FormModal>
  </div>
</template>

<style scoped>
.my-shelves-page {
  min-height: 80vh;
  background-color: #f9fafb;
}

.fs-xs {
  font-size: 0.75rem;
}

.fs-sm {
  font-size: 0.875rem;
}

.shelf-sidebar {
  top: 5rem;
}

.shelf-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.shelf-nav-main {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.75rem;
}

.shelf-nav-icon,
.active-shelf-icon {
  display: inline-flex;
  flex: 0 0 2.5rem;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #f8fafc;
}

.shelf-nav-copy,
.active-shelf-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.shelf-nav-copy {
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.shelf-nav-count {
  flex: 0 0 auto;
}

.active-shelf-summary {
  display: flex;
  min-width: 0;
  flex: 1 1 16rem;
  align-items: center;
  gap: 0.75rem;
}

.active-shelf-icon {
  flex-basis: 3rem;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: #f1f5f9;
}

.active-shelf-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.active-shelf-title h2 {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.shelf-nav-list .list-group-item {
  border-top: none;
  border-right: none;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  background-color: #ffffff;
  transition: all 140ms ease;
}

.shelf-nav-list .list-group-item:hover {
  background-color: #f8fafc;
}

.shelf-nav-list .list-group-item.active-shelf {
  background-color: #eff6ff;
  border-left-width: 4px;
}

.shelf-nav-list .list-group-item.active-shelf .shelf-title {
  color: #1d4ed8;
  font-weight: 700;
}

.border-start-4 {
  border-left-width: 4px !important;
}

.border-start-primary {
  border-left-color: #2563eb !important;
}

.border-start-transparent {
  border-left-color: transparent !important;
}

.book-shelf-card {
  transition: transform 160ms ease, box-shadow 160ms ease;
  background: #ffffff;
}

.book-shelf-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 8%) !important;
}

.book-shelf-cover {
  object-fit: cover;
  aspect-ratio: 3 / 4;
}

.book-shelf-fallback {
  background-color: #f3f4f6;
  aspect-ratio: 3 / 4;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hover-primary:hover {
  color: #2563eb !important;
}
</style>

