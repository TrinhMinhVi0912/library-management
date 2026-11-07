<script setup>
import { computed } from 'vue';
import RatingStars from '@/components/book/RatingStars.vue';

const props = defineProps({
  ratingAvg: {
    type: Number,
    default: 0,
  },
  ratingCount: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Array,
    default: () => [],
  },
  breakdown: {
    type: Object,
    default: null,
  },
});

const calculatedBreakdown = computed(() => {
  if (props.breakdown) {
    return props.breakdown;
  }
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (!props.reviews || props.reviews.length === 0) return dist;

  props.reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
    dist[star] = (dist[star] || 0) + 1;
  });
  return dist;
});

const totalReviews = computed(() => {
  if (props.ratingCount > 0) return props.ratingCount;
  return Object.values(calculatedBreakdown.value).reduce((sum, count) => sum + count, 0);
});

function getPercentage(star) {
  if (!totalReviews.value) return 0;
  const count = calculatedBreakdown.value[star] || 0;
  return Math.round((count / totalReviews.value) * 100);
}
</script>

<template>
  <div class="rating-summary-card card border-0 shadow-sm p-4 mb-4">
    <div class="row align-items-center g-4">
      <!-- Cột điểm trung bình -->
      <div class="col-12 col-md-4 text-center border-md-end">
        <div class="rating-number">
          {{ Number(props.ratingAvg || 0).toFixed(1) }}
        </div>
        <div class="d-flex justify-content-center my-2">
          <RatingStars
            :rating="props.ratingAvg || 0"
            :show-value="false"
          />
        </div>
        <div class="text-secondary small">
          <template v-if="totalReviews > 0">
            Dựa trên <strong>{{ totalReviews }}</strong> đánh giá
          </template>
          <template v-else>
            Chưa có đánh giá nào
          </template>
        </div>
      </div>

      <!-- Cột thanh phân bố sao -->
      <div class="col-12 col-md-8">
        <div class="rating-bars d-flex flex-column gap-2">
          <div
            v-for="star in [5, 4, 3, 2, 1]"
            :key="star"
            class="rating-bar-row d-flex align-items-center gap-2"
          >
            <span class="star-label text-nowrap d-flex align-items-center gap-1">
              <span>{{ star }}</span>
              <i
                class="bi bi-star-fill text-warning small"
                aria-hidden="true"
              />
            </span>

            <div class="progress flex-grow-1">
              <div
                class="progress-bar bg-warning"
                role="progressbar"
                :style="{ width: `${getPercentage(star)}%` }"
                :aria-valuenow="getPercentage(star)"
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>

            <span class="star-count text-secondary small text-end text-nowrap">
              {{ calculatedBreakdown[star] || 0 }} ({{ getPercentage(star) }}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rating-summary-card {
  background-color: #ffffff;
  border-radius: 0.75rem;
}

.rating-number {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  color: #1e293b;
}

@media (min-width: 768px) {
  .border-md-end {
    border-right: 1px solid #e2e8f0;
  }
}

.rating-bar-row {
  .star-label {
    min-width: 48px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
  }

  .progress {
    height: 8px;
    background-color: #f1f5f9;
    border-radius: 9999px;
    overflow: hidden;
  }

  .star-count {
    min-width: 70px;
    font-size: 0.8125rem;
  }
}
</style>

