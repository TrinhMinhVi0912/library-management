<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import shelfService from '@/services/shelf.service';

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String,
    default: 'outline-secondary',
  },
  size: {
    type: String,
    default: 'md',
  },
  label: {
    type: String,
    default: 'Thêm vào kệ',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  buttonClass: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['added', 'removed', 'changed']);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const triggerRef = ref(null);
const menuRef = ref(null);
const isOpen = ref(false);
const loading = ref(false);
const shelves = ref([]);
const isCreating = ref(false);
const newShelfName = ref('');
const submittingNewShelf = ref(false);
const updatingShelfId = ref(null);

const currentBookId = computed(() => props.book._id || props.book.id);
const bookTitle = computed(() => props.book.title || 'Sách');

// Vị trí của dropdown menu khi dùng teleport
const menuStyle = ref({
  position: 'fixed',
  top: '0px',
  left: '0px',
  zIndex: 1060,
});

function calculatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const dropdownWidth = 280;
  const viewportWidth = window.innerWidth;

  let left = rect.left;
  if (left + dropdownWidth > viewportWidth - 12) {
    left = Math.max(12, rect.right - dropdownWidth);
  }

  let top = rect.bottom + 6;
  // Nếu sát đáy màn hình, lật lên trên
  if (top + 320 > window.innerHeight && rect.top > 320) {
    top = Math.max(12, rect.top - 320);
  }

  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${dropdownWidth}px`,
    zIndex: 1060,
  };
}

async function loadShelves() {
  if (!authStore.isAuthenticated) return;
  loading.value = true;
  try {
    shelves.value = await shelfService.getMyShelves();
  } catch (err) {
    console.error('Không thể tải danh sách kệ sách:', err);
    toast.error('Không thể tải danh sách kệ sách.');
  } finally {
    loading.value = false;
  }
}

async function toggleDropdown() {
  if (props.disabled) return;

  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để lưu sách vào kệ.');
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  if (isOpen.value) {
    closeDropdown();
    return;
  }

  isOpen.value = true;
  isCreating.value = false;
  newShelfName.value = '';

  await nextTick();
  calculatePosition();
  await loadShelves();
  calculatePosition();
}

function closeDropdown() {
  isOpen.value = false;
  isCreating.value = false;
  newShelfName.value = '';
}

function isBookInShelf(shelf) {
  if (!shelf.items || !currentBookId.value) return false;
  return shelf.items.some((item) => {
    const bId = item.book?._id || item.book;
    return String(bId) === String(currentBookId.value);
  });
}

async function handleToggleShelf(shelf) {
  if (!currentBookId.value || updatingShelfId.value) return;
  updatingShelfId.value = shelf._id;

  const inShelf = isBookInShelf(shelf);
  try {
    if (inShelf) {
      await shelfService.removeBookFromShelf(shelf._id, currentBookId.value);
      shelf.items = shelf.items.filter((item) => {
        const bId = item.book?._id || item.book;
        return String(bId) !== String(currentBookId.value);
      });
      toast.success(`Đã xóa khỏi kệ "${shelf.name}".`);
      emit('removed', { shelf, book: props.book });
    } else {
      await shelfService.addBookToShelf(shelf._id, currentBookId.value);
      if (!shelf.items) shelf.items = [];
      shelf.items.push({ book: props.book });
      toast.success(`Đã thêm vào kệ "${shelf.name}".`);
      emit('added', { shelf, book: props.book });
    }
    emit('changed', { shelf, inShelf: !inShelf, book: props.book });
  } catch (err) {
    const message = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật kệ.';
    toast.error(message);
  } finally {
    updatingShelfId.value = null;
  }
}

async function handleCreateAndAdd() {
  const name = newShelfName.value.trim();
  if (!name) {
    toast.warning('Vui lòng nhập tên kệ sách.');
    return;
  }

  submittingNewShelf.value = true;
  try {
    const createdShelf = await shelfService.createShelf({ name });
    if (currentBookId.value && createdShelf?._id) {
      await shelfService.addBookToShelf(createdShelf._id, currentBookId.value);
      createdShelf.items = [{ book: props.book }];
      toast.success(`Đã tạo kệ "${name}" và thêm sách thành công!`);
      emit('added', { shelf: createdShelf, book: props.book });
      emit('changed', { shelf: createdShelf, inShelf: true, book: props.book });
    }
    shelves.value.push(createdShelf);
    newShelfName.value = '';
    isCreating.value = false;
    calculatePosition();
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể tạo kệ sách mới.';
    toast.error(message);
  } finally {
    submittingNewShelf.value = false;
  }
}

function handleDocumentClick(event) {
  if (!isOpen.value) return;
  if (triggerRef.value?.contains(event.target)) return;
  if (menuRef.value?.contains(event.target)) return;
  closeDropdown();
}

function handleKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

function handleScrollOrResize() {
  if (isOpen.value) {
    calculatePosition();
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('scroll', handleScrollOrResize, true);
  window.addEventListener('resize', handleScrollOrResize);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('scroll', handleScrollOrResize, true);
  window.removeEventListener('resize', handleScrollOrResize);
});

const buttonSizeClass = computed(() => {
  if (props.size === 'sm') return 'btn-sm';
  if (props.size === 'lg') return 'btn-lg';
  return '';
});

const totalShelvedCount = computed(() => {
  return shelves.value.filter(isBookInShelf).length;
});
</script>

<template>
  <div class="shelf-dropdown-wrapper">
    <!-- Trigger Button: Icon only mode -->
    <button
      v-if="iconOnly"
      ref="triggerRef"
      type="button"
      :class="['book-card-action', buttonClass, { active: isOpen || totalShelvedCount > 0 }]"
      :disabled="disabled"
      :aria-label="`Thêm ${bookTitle} vào kệ sách`"
      :title="totalShelvedCount > 0 ? `Đã lưu trong ${totalShelvedCount} kệ` : 'Thêm vào kệ sách'"
      :aria-expanded="isOpen"
      @click.stop="toggleDropdown"
    >
      <i
        :class="totalShelvedCount > 0 ? 'bi bi-bookmark-check-fill' : 'bi bi-bookmark-plus'"
        aria-hidden="true"
      />
    </button>

    <!-- Trigger Button: Standard button mode -->
    <button
      v-else
      ref="triggerRef"
      type="button"
      :class="['btn', `btn-${variant}`, buttonSizeClass, buttonClass, { active: isOpen }]"
      :disabled="disabled"
      :aria-expanded="isOpen"
      @click.stop="toggleDropdown"
    >
      <i
        :class="totalShelvedCount > 0 ? 'bi bi-bookmark-check-fill text-primary me-2' : 'bi bi-bookmark-plus me-2'"
        aria-hidden="true"
      />
      <span>{{ label }}</span>
      <span
        v-if="totalShelvedCount > 0"
        class="badge bg-primary-subtle text-primary ms-1.5"
      >
        {{ totalShelvedCount }}
      </span>
      <i
        class="bi bi-chevron-down ms-2 fs-xs"
        aria-hidden="true"
      />
    </button>

    <!-- Teleported Dropdown Menu -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="shelf-menu card shadow-lg border animate-fade-in"
        :style="menuStyle"
        role="dialog"
        aria-label="Chọn kệ sách"
      >
        <div class="shelf-menu-header d-flex align-items-center justify-content-between p-2.5 border-bottom bg-light">
          <div class="d-flex align-items-center gap-1.5">
            <i
              class="bi bi-collection text-primary"
              aria-hidden="true"
            />
            <strong class="fs-sm text-dark">Kệ sách của tôi</strong>
          </div>
          <button
            type="button"
            class="btn-close fs-xs"
            aria-label="Đóng"
            @click="closeDropdown"
          />
        </div>

        <div class="shelf-menu-body p-2">
          <!-- Loading state -->
          <div
            v-if="loading"
            class="text-center py-3 text-muted fs-sm"
          >
            <div
              class="spinner-border spinner-border-sm text-primary me-1.5"
              role="status"
            />
            <span>Đang tải danh sách kệ...</span>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="shelves.length === 0"
            class="text-center py-3 text-muted fs-sm"
          >
            Chưa có kệ sách nào.
          </div>

          <!-- Shelf list -->
          <ul
            v-else
            class="list-unstyled mb-0 shelf-list"
          >
            <li
              v-for="shelf in shelves"
              :key="shelf._id"
              class="shelf-item"
            >
              <button
                type="button"
                class="shelf-item-btn w-100 d-flex align-items-center justify-content-between p-2 rounded text-start"
                :class="{ 'is-selected': isBookInShelf(shelf) }"
                :disabled="updatingShelfId === shelf._id"
                @click="handleToggleShelf(shelf)"
              >
                <div class="d-flex align-items-center gap-2 overflow-hidden me-2">
                  <i
                    :class="[
                      isBookInShelf(shelf)
                        ? 'bi bi-check-circle-fill text-success'
                        : 'bi bi-circle text-muted',
                      'fs-base flex-shrink-0'
                    ]"
                    aria-hidden="true"
                  />
                  <span class="text-truncate fs-sm shelf-name">
                    {{ shelf.name }}
                  </span>
                  <span
                    v-if="shelf.type !== 'custom'"
                    class="badge bg-secondary-subtle text-secondary fs-xs flex-shrink-0"
                  >
                    Mặc định
                  </span>
                </div>

                <div class="d-flex align-items-center gap-1 flex-shrink-0">
                  <span
                    v-if="updatingShelfId === shelf._id"
                    class="spinner-border spinner-border-sm text-primary"
                    role="status"
                  />
                  <span
                    v-else
                    class="badge rounded-pill bg-light text-muted border fs-xs"
                  >
                    {{ shelf.items?.length || 0 }} sách
                  </span>
                </div>
              </button>
            </li>
          </ul>

          <!-- Create new shelf inline section -->
          <div class="create-shelf-section mt-2 pt-2 border-top">
            <div
              v-if="!isCreating"
              class="d-grid"
            >
              <button
                type="button"
                class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-1.5"
                @click="isCreating = true"
              >
                <i
                  class="bi bi-folder-plus"
                  aria-hidden="true"
                />
                <span>Tạo kệ mới...</span>
              </button>
            </div>

            <div
              v-else
              class="create-shelf-form"
            >
              <label
                for="new-shelf-input"
                class="form-label fs-xs text-muted mb-1"
              >Tên kệ mới:</label>
              <input
                id="new-shelf-input"
                v-model="newShelfName"
                type="text"
                class="form-control form-control-sm mb-2"
                placeholder="Ví dụ: Sách lập trình, Muốn mua..."
                maxlength="50"
                :disabled="submittingNewShelf"
                @keyup.enter="handleCreateAndAdd"
              >
              <div class="d-flex justify-content-end gap-1.5">
                <button
                  type="button"
                  class="btn btn-sm btn-link text-secondary text-decoration-none py-0 px-2 fs-xs"
                  :disabled="submittingNewShelf"
                  @click="isCreating = false; newShelfName = ''"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-primary py-0.5 px-2.5 fs-xs d-flex align-items-center gap-1"
                  :disabled="submittingNewShelf || !newShelfName.trim()"
                  @click="handleCreateAndAdd"
                >
                  <span
                    v-if="submittingNewShelf"
                    class="spinner-border spinner-border-sm"
                    role="status"
                  />
                  <span>Tạo & Lưu</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="shelf-menu-footer p-2 border-top bg-light text-center">
          <RouterLink
            :to="{ name: 'my-shelves' }"
            class="text-decoration-none fs-xs text-primary fw-medium d-inline-flex align-items-center gap-1"
            @click="closeDropdown"
          >
            <span>Quản lý tất cả kệ sách</span>
            <i
              class="bi bi-arrow-right"
              aria-hidden="true"
            />
          </RouterLink>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shelf-dropdown-wrapper {
  position: relative;
  display: inline-block;
}

.fs-xs {
  font-size: 0.75rem;
}

.fs-sm {
  font-size: 0.875rem;
}

.shelf-menu {
  background: #ffffff;
  border-radius: 0.5rem;
  border-color: #e5e7eb !important;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 12%), 0 8px 10px -6px rgb(0 0 0 / 8%) !important;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.shelf-menu-body {
  overflow-y: auto;
  max-height: 340px;
}

.shelf-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shelf-item-btn {
  background: transparent;
  border: none;
  transition: background-color 140ms ease, color 140ms ease;
  cursor: pointer;
}

.shelf-item-btn:hover {
  background-color: #f3f4f6;
}

.shelf-item-btn.is-selected {
  background-color: #eff6ff;
}

.shelf-item-btn.is-selected .shelf-name {
  font-weight: 600;
  color: #1d4ed8;
}

.book-card-action {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #2563eb;
  font-size: 1.125rem;
  transition: all 140ms ease;
}

.book-card-action:hover,
.book-card-action.active {
  background: #2563eb;
  color: #ffffff;
}

.animate-fade-in {
  animation: fadeIn 120ms ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
