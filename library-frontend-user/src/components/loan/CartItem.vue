<script setup>
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { cloudinaryThumb } from '@/utils/image';

const props = defineProps({
  item: { type: Object, required: true },
  removing: { type: Boolean, default: false },
});

const emit = defineEmits(['remove']);

const imageFailed = ref(false);

const book = computed(() => props.item?.book || {});

const coverUrl = computed(() => {
  return cloudinaryThumb(book.value.cover?.url || book.value.cover, 180);
});

const authorsText = computed(() => {
  if (Array.isArray(book.value.authors) && book.value.authors.length > 0) {
    return book.value.authors.map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean).join(', ');
  }
  return book.value.authorText || 'Đang cập nhật tác giả';
});

const isAvailable = computed(() => {
  if (!book.value || book.value.status !== 'active') return false;
  if (props.item.available === false) return false;
  return Number(book.value.availableCopies || 0) > 0;
});

const bookLink = computed(() => {
  return {
    name: 'book-detail',
    params: { slug: book.value.slug || book.value._id },
  };
});
</script>

<template>
  <article
    class="cart-item card border rounded-3 p-3 mb-3 shadow-xs"
    :class="{ 'border-danger-subtle bg-danger-subtle bg-opacity-10': !isAvailable }"
  >
    <div class="d-flex flex-column flex-sm-row align-items-sm-center gap-3">
      <!-- Ảnh bìa sách -->
      <div class="cart-item-cover-wrap flex-shrink-0 text-center">
        <RouterLink
          :to="bookLink"
          class="d-inline-block"
        >
          <img
            v-if="coverUrl && !imageFailed"
            :src="coverUrl"
            :alt="`Bìa sách ${book.title}`"
            class="cart-item-cover rounded shadow-xs"
            loading="lazy"
            @error="imageFailed = true"
          >
          <div
            v-else
            class="cart-item-cover cart-item-fallback rounded d-flex align-items-center justify-content-center text-muted"
          >
            <i
              class="bi bi-book fs-3"
              aria-hidden="true"
            />
          </div>
        </RouterLink>
      </div>

      <!-- Thông tin sách -->
      <div class="cart-item-info flex-grow-1">
        <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-1">
          <h3 class="h6 fw-bold mb-0">
            <RouterLink
              :to="bookLink"
              class="text-dark text-decoration-none hover-primary"
            >
              {{ book.title || 'Sách không rõ tiêu đề' }}
            </RouterLink>
          </h3>

          <!-- Nút xóa sách khỏi giỏ -->
          <button
            class="btn btn-outline-danger btn-sm px-2.5 py-1 text-nowrap d-inline-flex align-items-center gap-1"
            type="button"
            :disabled="removing"
            :aria-label="`Xóa ${book.title} khỏi giỏ mượn`"
            @click="emit('remove', book._id)"
          >
            <span
              v-if="removing"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            />
            <i
              v-else
              class="bi bi-trash3"
              aria-hidden="true"
            />
            <span class="d-none d-md-inline">Xóa</span>
          </button>
        </div>

        <!-- Tác giả & Thể loại -->
        <div class="text-secondary small mb-2">
          <span>Tác giả: <strong>{{ authorsText }}</strong></span>
          <span
            v-if="book.categories && book.categories.length"
            class="ms-2"
          >
            | Thể loại:
            <span
              v-for="(cat, idx) in book.categories"
              :key="cat._id || idx"
              class="badge bg-light text-secondary border ms-1"
            >
              {{ cat.name || cat }}
            </span>
          </span>
        </div>

        <!-- Vị trí kệ & Trạng thái tồn kho -->
        <div class="d-flex flex-wrap align-items-center gap-2 small">
          <span class="text-muted">
            <i
              class="bi bi-geo-alt me-1 text-primary"
              aria-hidden="true"
            />
            Kệ: <strong>{{ book.location || 'Khu chung' }}</strong>
          </span>

          <span class="text-muted opacity-50">|</span>

          <!-- Trạng thái còn / hết sách -->
          <div
            v-if="isAvailable"
            class="d-inline-flex align-items-center"
          >
            <StatusBadge
              type="book"
              status="available"
              :label="`Còn ${book.availableCopies} bản`"
            />
          </div>
          <div
            v-else
            class="d-inline-flex align-items-center gap-1 text-danger fw-semibold"
          >
            <i
              class="bi bi-exclamation-circle-fill text-danger"
              aria-hidden="true"
            />
            <span>Đã hết sách trong kho</span>
          </div>
        </div>

        <!-- Cảnh báo nếu sách đã hết bản sao -->
        <div
          v-if="!isAvailable"
          class="alert alert-danger py-1.5 px-2.5 mt-2 mb-0 small rounded-2 d-flex align-items-center gap-2"
        >
          <i
            class="bi bi-info-circle text-danger flex-shrink-0"
            aria-hidden="true"
          />
          <span>Vui lòng xóa cuốn sách này khỏi giỏ để có thể gửi yêu cầu mượn các sách còn lại.</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.cart-item-cover {
  width: 75px;
  height: 105px;
  object-fit: cover;
}

.cart-item-fallback {
  background-color: #f8f9fa;
  border: 1px dashed #dee2e6;
}

.hover-primary:hover {
  color: #0d6efd !important;
  text-decoration: underline !important;
}

.shadow-xs {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>

