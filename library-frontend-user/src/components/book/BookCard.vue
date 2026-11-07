<script setup>
import { computed, ref } from 'vue';
import BookAvailability from '@/components/book/BookAvailability.vue';
import RatingStars from '@/components/book/RatingStars.vue';
import { cloudinaryThumb } from '@/utils/image';

const props = defineProps({
  book: { type: Object, required: true },
});
const emit = defineEmits(['add-to-cart', 'add-to-shelf']);
const imageFailed = ref(false);
const authors = computed(() => {
  const names = props.book.authors?.map((author) => (typeof author === 'string' ? author : author.name)).filter(Boolean);
  return names?.join(', ') || props.book.authorText || 'Chưa cập nhật tác giả';
});
const coverUrl = computed(() => cloudinaryThumb(props.book.cover?.url || props.book.cover, 300));
const bookLink = computed(() => ({
  name: 'book-detail',
  params: { slug: props.book.slug || props.book._id },
}));
</script>

<template>
  <article class="book-card">
    <div class="book-card-cover-wrap">
      <RouterLink
        class="book-card-cover-link"
        :to="bookLink"
        :aria-label="`Xem sách ${book.title}`"
      >
        <img
          v-if="coverUrl && !imageFailed"
          class="book-card-cover"
          :src="coverUrl"
          :alt="`Bìa sách ${book.title}`"
          loading="lazy"
          @error="imageFailed = true"
        >
        <div
          v-else
          class="book-card-cover book-card-cover-fallback"
          aria-hidden="true"
        >
          <i class="bi bi-book" />
          <span>Chưa có ảnh bìa</span>
        </div>
      </RouterLink>
      <div
        class="book-card-quick-actions"
        aria-label="Thao tác nhanh"
      >
        <button
          class="book-card-action"
          type="button"
          :aria-label="`Thêm ${book.title} vào giỏ mượn`"
          title="Thêm vào giỏ mượn"
          @click="emit('add-to-cart', book)"
        >
          <i
            class="bi bi-bag-plus"
            aria-hidden="true"
          />
        </button>
        <button
          class="book-card-action"
          type="button"
          :aria-label="`Thêm ${book.title} vào kệ sách`"
          title="Thêm vào kệ sách"
          @click="emit('add-to-shelf', book)"
        >
          <i
            class="bi bi-bookmark-plus"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div class="book-card-content">
      <RouterLink
        class="book-card-title"
        :to="bookLink"
      >
        {{ book.title }}
      </RouterLink>
      <p class="book-card-author">
        {{ authors }}
      </p>
      <RatingStars
        :rating="Number(book.ratingAvg) || 0"
        :count="Number(book.ratingCount) || 0"
      />
      <BookAvailability
        class="mt-2"
        :available-copies="Number(book.availableCopies) || 0"
      />
    </div>
  </article>
</template>

<style scoped>
.book-card {
  height: 100%;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  transition: box-shadow 160ms ease;
}

.book-card:hover,
.book-card:focus-within {
  box-shadow: 0 0.125rem 0.5rem rgb(17 24 39 / 8%);
}

.book-card-cover-wrap {
  position: relative;
  overflow: hidden;
  background: #f8f9fa;
}

.book-card-cover-link {
  display: block;
}

.book-card-cover {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}

.book-card-cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #6b7280;
  font-size: 0.8125rem;
}

.book-card-cover-fallback i {
  color: #2563eb;
  font-size: 2rem;
}

.book-card-quick-actions {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 160ms ease;
}

.book-card:hover .book-card-quick-actions,
.book-card:focus-within .book-card-quick-actions {
  opacity: 1;
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
}

.book-card-action:hover {
  background: #2563eb;
  color: #ffffff;
}

.book-card-content {
  padding: 0.875rem;
}

.book-card-title {
  display: -webkit-box;
  overflow: hidden;
  min-height: 2.75rem;
  color: #111827;
  font-weight: 650;
  line-height: 1.35;
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.book-card-title:hover {
  color: #2563eb;
}

.book-card-author {
  overflow: hidden;
  margin: 0.4rem 0 0.65rem;
  color: #6b7280;
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767.98px) {
  .book-card-quick-actions {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-card,
  .book-card-quick-actions {
    transition: none;
  }
}
</style>
