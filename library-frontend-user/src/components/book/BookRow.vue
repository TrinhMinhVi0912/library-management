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
const coverUrl = computed(() => cloudinaryThumb(props.book.cover?.url || props.book.cover, 180));
const bookLink = computed(() => ({ name: 'book-detail', params: { slug: props.book.slug || props.book._id } }));
</script>

<template>
  <article class="book-row">
    <RouterLink
      class="book-row-cover-link"
      :to="bookLink"
      :aria-label="`Xem sách ${book.title}`"
    >
      <img
        v-if="coverUrl && !imageFailed"
        class="book-row-cover"
        :src="coverUrl"
        :alt="`Bìa sách ${book.title}`"
        loading="lazy"
        @error="imageFailed = true"
      >
      <span
        v-else
        class="book-row-cover book-row-cover-fallback"
        aria-hidden="true"
      >
        <i class="bi bi-book" />
      </span>
    </RouterLink>

    <div class="book-row-main">
      <RouterLink
        class="book-row-title"
        :to="bookLink"
      >
        {{ book.title }}
      </RouterLink>
      <p class="book-row-author">
        {{ authors }}
      </p>
      <div class="book-row-meta">
        <RatingStars
          :rating="Number(book.ratingAvg) || 0"
          :count="Number(book.ratingCount) || 0"
        />
        <BookAvailability :available-copies="Number(book.availableCopies) || 0" />
      </div>
    </div>

    <div class="book-row-actions">
      <button
        class="btn btn-sm btn-outline-primary"
        type="button"
        @click="emit('add-to-cart', book)"
      >
        <i
          class="bi bi-bag-plus me-1"
          aria-hidden="true"
        />Thêm vào giỏ
      </button>
      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        @click="emit('add-to-shelf', book)"
      >
        <i
          class="bi bi-bookmark-plus me-1"
          aria-hidden="true"
        />Thêm vào kệ
      </button>
    </div>
  </article>
</template>

<style scoped>
.book-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.75rem;
}

.book-row-cover-link {
  flex: 0 0 5rem;
}

.book-row-cover {
  display: block;
  width: 5rem;
  aspect-ratio: 3 / 4;
  border-radius: 0.35rem;
  background: #f8f9fa;
  object-fit: cover;
}

.book-row-cover-fallback {
  display: grid;
  place-items: center;
  color: #2563eb;
  font-size: 1.5rem;
}

.book-row-main {
  flex: 1;
  min-width: 0;
}

.book-row-title {
  color: #111827;
  font-weight: 650;
  text-decoration: none;
}

.book-row-title:hover {
  color: #2563eb;
}

.book-row-author {
  margin: 0.25rem 0 0.55rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.book-row-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 1rem;
}

.book-row-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .book-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .book-row-actions {
    width: 100%;
    flex-direction: row;
    padding-left: 6rem;
  }
}
</style>
