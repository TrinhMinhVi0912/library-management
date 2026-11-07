<script setup>
import { computed } from 'vue';

const props = defineProps({
  rating: { type: Number, default: 0 },
  count: { type: Number, default: null },
  showValue: { type: Boolean, default: true },
});

const normalizedRating = computed(() => Math.min(5, Math.max(0, Number(props.rating) || 0)));
const roundedRating = computed(() => Math.round(normalizedRating.value * 2) / 2);
const ratingLabel = computed(() => `${normalizedRating.value.toFixed(1)} trên 5 sao`);

function starIcon(index) {
  const value = roundedRating.value - index;
  if (value >= 1) return 'bi-star-fill';
  if (value >= 0.5) return 'bi-star-half';
  return 'bi-star';
}
</script>

<template>
  <span
    class="rating-stars"
    :aria-label="ratingLabel"
  >
    <span
      class="rating-stars-icons"
      aria-hidden="true"
    >
      <i
        v-for="index in 5"
        :key="index"
        class="bi"
        :class="starIcon(index - 1)"
      />
    </span>
    <span
      v-if="showValue"
      class="rating-stars-value"
    >{{ normalizedRating.toFixed(1) }}</span>
    <span
      v-if="count !== null"
      class="rating-stars-count"
    >({{ count }})</span>
  </span>
</template>

<style scoped>
.rating-stars,
.rating-stars-icons {
  display: inline-flex;
  align-items: center;
}

.rating-stars {
  gap: 0.35rem;
  color: #f59e0b;
  font-size: 0.875rem;
  white-space: nowrap;
}

.rating-stars-icons {
  gap: 0.08rem;
  color: #f59e0b;
}

.rating-stars-value {
  color: #374151;
  font-weight: 600;
}

.rating-stars-count {
  color: #6b7280;
}
</style>
