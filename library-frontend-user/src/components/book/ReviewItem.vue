<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import RatingStars from '@/components/book/RatingStars.vue';
import { formatDate, formatRelativeTime } from '@/utils/format';

const props = defineProps({
  review: {
    type: Object,
    required: true,
  },
  showBook: {
    type: Boolean,
    default: false,
  },
  allowActions: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['edit', 'delete']);

const readerName = computed(() => {
  const r = props.review.reader;
  if (!r) return 'Độc giả';
  return [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Độc giả';
});

const readerAvatar = computed(() => props.review.reader?.avatar?.url || null);

const initials = computed(() => {
  const parts = readerName.value.split(/\s+/).filter(Boolean);
  return parts.slice(-2).map((p) => p[0]).join('').toLocaleUpperCase('vi-VN') || 'DG';
});

const isEdited = computed(() => {
  if (!props.review.updatedAt || !props.review.createdAt) return false;
  const created = new Date(props.review.createdAt).getTime();
  const updated = new Date(props.review.updatedAt).getTime();
  return updated - created > 60000; // Cách nhau trên 1 phút
});

const relativeTime = computed(() => formatRelativeTime(props.review.createdAt));
</script>

<template>
  <div class="review-item card border-0 shadow-sm p-3 p-md-4 mb-3">
    <!-- Thông tin sách (nếu hiển thị ở trang /my/reviews) -->
    <div
      v-if="showBook && review.book"
      class="review-book-header d-flex align-items-center gap-3 pb-3 mb-3 border-bottom"
    >
      <RouterLink
        :to="{ name: 'book-detail', params: { slug: review.book.slug } }"
        class="book-cover-thumb flex-shrink-0"
      >
        <img
          v-if="review.book.cover?.url"
          :src="review.book.cover.url"
          :alt="review.book.title"
          class="img-fluid rounded"
        >
        <div
          v-else
          class="cover-placeholder rounded"
        >
          <i
            class="bi bi-book text-secondary"
            aria-hidden="true"
          />
        </div>
      </RouterLink>

      <div class="book-info flex-grow-1 min-w-0">
        <RouterLink
          :to="{ name: 'book-detail', params: { slug: review.book.slug } }"
          class="book-title text-decoration-none fw-semibold text-dark text-truncate d-block"
        >
          {{ review.book.title }}
        </RouterLink>
        <div class="text-secondary small">
          Mã sách: <code>{{ review.book.code }}</code>
        </div>
      </div>
    </div>

    <!-- Nội dung đánh giá -->
    <div class="d-flex align-items-start justify-content-between gap-3">
      <div class="d-flex align-items-center gap-3">
        <!-- Avatar độc giả (khi xem chi tiết sách) -->
        <div
          v-if="!showBook"
          class="reader-avatar-wrapper flex-shrink-0"
        >
          <img
            v-if="readerAvatar"
            :src="readerAvatar"
            :alt="readerName"
            class="reader-avatar rounded-circle"
          >
          <div
            v-else
            class="avatar-fallback rounded-circle"
          >
            {{ initials }}
          </div>
        </div>

        <div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span
              v-if="!showBook"
              class="reader-name fw-semibold text-dark"
            >{{ readerName }}</span>
            <RatingStars
              :rating="review.rating || 0"
              :show-value="false"
            />
          </div>
          <div class="review-date text-secondary small mt-1">
            <span>{{ formatDate(review.createdAt, 'DD/MM/YYYY HH:mm') }}</span>
            <span class="mx-1">•</span>
            <span>{{ relativeTime }}</span>
            <span
              v-if="isEdited"
              class="badge bg-light text-secondary border ms-2"
            >Đã chỉnh sửa</span>
          </div>
        </div>
      </div>

      <!-- Nút thao tác (nếu allowActions = true) -->
      <div
        v-if="allowActions"
        class="review-actions d-flex align-items-center gap-1 flex-shrink-0"
      >
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          title="Chỉnh sửa đánh giá"
          @click="emit('edit', review)"
        >
          <i
            class="bi bi-pencil"
            aria-hidden="true"
          />
          <span class="d-none d-sm-inline">Sửa</span>
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
          title="Xóa đánh giá"
          @click="emit('delete', review)"
        >
          <i
            class="bi bi-trash3"
            aria-hidden="true"
          />
          <span class="d-none d-sm-inline">Xóa</span>
        </button>
      </div>
    </div>

    <!-- Nhận xét văn bản -->
    <div class="review-comment mt-3">
      <p
        v-if="review.comment"
        class="mb-0 text-secondary"
      >
        {{ review.comment }}
      </p>
      <p
        v-else
        class="mb-0 text-muted fst-italic small"
      >
        (Độc giả không để lại lời nhận xét)
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.review-item {
  border-radius: 0.75rem;
  background-color: #ffffff;
}

.book-cover-thumb {
  width: 48px;
  height: 64px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    background-color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.book-title {
  &:hover {
    color: #2563eb !important;
  }
}

.reader-avatar-wrapper {
  width: 40px;
  height: 40px;

  .reader-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    background-color: #e0e7ff;
    color: #3730a3;
    font-size: 0.875rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.review-comment {
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
}
</style>

