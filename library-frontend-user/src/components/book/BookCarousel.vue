<script setup>
import { ref } from 'vue';
import BookCard from '@/components/book/BookCard.vue';

defineProps({
  title: { type: String, required: true },
  books: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
});

const emit = defineEmits(['add-to-cart', 'add-to-shelf']);
const track = ref(null);

function scroll(direction) {
  track.value?.scrollBy({ left: direction * Math.max(260, track.value.clientWidth * 0.8), behavior: 'smooth' });
}
</script>

<template>
  <section
    class="book-carousel"
    :aria-label="ariaLabel || title"
  >
    <header class="book-carousel-heading">
      <h2>{{ title }}</h2>
      <div class="book-carousel-controls">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          :aria-label="`Cuộn ${title} sang trái`"
          @click="scroll(-1)"
        >
          <i
            class="bi bi-chevron-left"
            aria-hidden="true"
          />
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          :aria-label="`Cuộn ${title} sang phải`"
          @click="scroll(1)"
        >
          <i
            class="bi bi-chevron-right"
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
    <div
      ref="track"
      class="book-carousel-track"
      tabindex="0"
    >
      <div
        v-for="book in books"
        :key="book._id"
        class="book-carousel-item"
      >
        <BookCard
          :book="book"
          @add-to-cart="emit('add-to-cart', $event)"
          @add-to-shelf="emit('add-to-shelf', $event)"
        />
      </div>
      <p
        v-if="books.length === 0"
        class="text-secondary mb-0"
      >
        Chưa có sách để hiển thị.
      </p>
    </div>
  </section>
</template>

<style scoped>
.book-carousel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.book-carousel-heading h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.book-carousel-controls {
  display: flex;
  gap: 0.5rem;
}

.book-carousel-track {
  display: flex;
  overflow-x: auto;
  gap: 1rem;
  padding: 0.15rem 0.15rem 0.75rem;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.book-carousel-item {
  flex: 0 0 clamp(10.5rem, 20vw, 14rem);
  scroll-snap-align: start;
}

@media (prefers-reduced-motion: reduce) {
  .book-carousel-track {
    scroll-behavior: auto;
  }
}
</style>
