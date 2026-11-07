<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import reviewService from '@/services/review.service';

const props = defineProps({
  bookId: {
    type: String,
    required: true,
  },
  bookTitle: {
    type: String,
    default: '',
  },
  existingReview: {
    type: Object,
    default: null,
  },
  canReviewProp: {
    type: Boolean,
    default: null,
  },
});

const emit = defineEmits(['submitted', 'cancelled']);

const auth = useAuthStore();
const toast = useToast();

const rating = ref(props.existingReview?.rating || 5);
const hoverRating = ref(0);
const comment = ref(props.existingReview?.comment || '');
const isSubmitting = ref(false);
const checkingCanReview = ref(false);
const internalCanReview = ref(false);
const errorMessage = ref('');

const ratingLabels = {
  1: 'Rất tệ',
  2: 'Chưa tốt',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất xuất sắc',
};

const activeRating = computed(() => hoverRating.value || rating.value);
const activeLabel = computed(() => ratingLabels[activeRating.value] || 'Chọn mức đánh giá');

const canReview = computed(() => {
  if (props.canReviewProp !== null) {
    return props.canReviewProp;
  }
  return internalCanReview.value;
});

async function checkPermission() {
  if (!auth.isAuthenticated || auth.role !== 'reader' || !props.bookId) {
    internalCanReview.value = false;
    return;
  }
  if (props.canReviewProp !== null) return;

  checkingCanReview.value = true;
  try {
    internalCanReview.value = await reviewService.canReview(props.bookId);
  } catch {
    internalCanReview.value = false;
  } finally {
    checkingCanReview.value = false;
  }
}

watch(
  () => props.existingReview,
  (newVal) => {
    if (newVal) {
      rating.value = Number(newVal.rating) || 5;
      comment.value = newVal.comment || '';
    }
  },
  { immediate: true }
);

watch(
  () => [props.bookId, auth.isAuthenticated],
  () => {
    checkPermission();
  }
);

onMounted(() => {
  checkPermission();
});

function setRating(val) {
  rating.value = val;
  errorMessage.value = '';
}

function setHover(val) {
  hoverRating.value = val;
}

function clearHover() {
  hoverRating.value = 0;
}

async function handleSubmit() {
  if (!rating.value || rating.value < 1 || rating.value > 5) {
    errorMessage.value = 'Vui lòng chọn số sao đánh giá (từ 1 đến 5).';
    return;
  }
  if (comment.value && comment.value.length > 2000) {
    errorMessage.value = 'Nội dung nhận xét tối đa 2000 ký tự.';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const payload = {
      rating: Number(rating.value),
      comment: comment.value.trim(),
    };
    const result = await reviewService.createOrUpdateReview(props.bookId, payload);
    toast.success(props.existingReview ? 'Đã cập nhật đánh giá của bạn!' : 'Cảm ơn bạn đã gửi đánh giá!');
    emit('submitted', result);
  } catch (error) {
    if (error.response?.status === 403) {
      errorMessage.value = 'Bạn cần mượn sách này trước khi đánh giá.';
      internalCanReview.value = false;
    } else {
      errorMessage.value = error.response?.data?.message || 'Không thể lưu đánh giá. Vui lòng thử lại sau.';
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="review-form-container card border-0 shadow-sm p-4 mb-4">
    <!-- Trường hợp đang kiểm tra quyền -->
    <div
      v-if="checkingCanReview"
      class="text-center py-3 text-secondary"
    >
      <span
        class="spinner-border spinner-border-sm me-2"
        role="status"
      />
      Đang kiểm tra quyền đánh giá...
    </div>

    <!-- Trường hợp ĐƯỢC PHÉP đánh giá (canReview = true) -->
    <div v-else-if="canReview">
      <h3 class="h5 fw-bold text-dark mb-3">
        {{ existingReview ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá của bạn' }}
      </h3>

      <div
        v-if="errorMessage"
        class="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3"
      >
        <i
          class="bi bi-exclamation-triangle-fill"
          aria-hidden="true"
        />
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleSubmit">
        <!-- Bộ chọn số sao tương tác -->
        <div class="mb-3">
          <label class="form-label fw-semibold text-secondary small d-block mb-1">
            Đánh giá của bạn <span class="text-danger">*</span>
          </label>
          <div class="d-flex align-items-center gap-3">
            <div
              class="star-picker d-inline-flex gap-1"
              role="radiogroup"
              aria-label="Chọn số sao đánh giá"
              @mouseleave="clearHover"
            >
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                class="star-btn"
                :class="{
                  'is-active': star <= activeRating,
                  'is-hover': star <= hoverRating,
                }"
                :aria-label="`${star} sao - ${ratingLabels[star]}`"
                @mouseenter="setHover(star)"
                @click="setRating(star)"
              >
                <i
                  class="bi"
                  :class="star <= activeRating ? 'bi-star-fill' : 'bi-star'"
                />
              </button>
            </div>

            <span class="active-rating-label badge bg-light text-primary border px-2 py-1">
              {{ activeRating }} sao – {{ activeLabel }}
            </span>
          </div>
        </div>

        <!-- Nhận xét văn bản -->
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label
              for="review-comment-input"
              class="form-label fw-semibold text-secondary small mb-0"
            >
              Nhận xét chi tiết (tùy chọn)
            </label>
            <span
              class="char-count small"
              :class="{ 'text-danger': comment.length > 2000, 'text-secondary': comment.length <= 2000 }"
            >
              {{ comment.length }}/2000
            </span>
          </div>
          <textarea
            id="review-comment-input"
            v-model="comment"
            class="form-control"
            rows="3"
            maxlength="2000"
            placeholder="Chia sẻ cảm nhận, đánh giá về nội dung, chất lượng bản in hoặc thông điệp cuốn sách..."
            :disabled="isSubmitting"
          />
        </div>

        <!-- Nút gửi -->
        <div class="d-flex align-items-center gap-2 justify-content-end">
          <button
            v-if="existingReview"
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="isSubmitting"
            @click="emit('cancelled')"
          >
            Hủy
          </button>
          <button
            type="submit"
            class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
            :disabled="isSubmitting || (comment && comment.length > 2000)"
          >
            <span
              v-if="isSubmitting"
              class="spinner-border spinner-border-sm"
              role="status"
            />
            <i
              v-else
              class="bi bi-send"
              aria-hidden="true"
            />
            <span>{{ existingReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá' }}</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Trường hợp KHÔNG ĐƯỢC PHÉP đánh giá (chưa mượn hoặc chưa đăng nhập) -->
    <div
      v-else
      class="review-prompt-card text-center py-3"
    >
      <div class="prompt-icon mb-2">
        <i
          class="bi bi-journal-bookmark text-primary"
          aria-hidden="true"
        />
      </div>
      <h4 class="h6 fw-bold text-dark mb-1">
        Mượn sách để đánh giá
      </h4>
      <p class="text-secondary small mb-3 max-w-md mx-auto">
        Chỉ những độc giả đã mượn và trải nghiệm tác phẩm này mới có thể viết nhận xét và chấm điểm.
      </p>

      <div
        v-if="!auth.isAuthenticated"
        class="d-flex justify-content-center gap-2"
      >
        <RouterLink
          :to="{ name: 'login' }"
          class="btn btn-sm btn-outline-primary"
        >
          Đăng nhập để xem quyền
        </RouterLink>
      </div>
      <div
        v-else-if="auth.role === 'reader'"
        class="text-muted small fst-italic"
      >
        <i
          class="bi bi-info-circle me-1"
          aria-hidden="true"
        />
        Bạn chưa từng mượn cuốn sách này. Hãy mượn sách để trải nghiệm nhé!
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.review-form-container {
  border-radius: 0.75rem;
  background-color: #ffffff;
}

.star-picker {
  .star-btn {
    border: none;
    background: transparent;
    padding: 0.25rem;
    font-size: 1.5rem;
    color: #cbd5e1;
    cursor: pointer;
    line-height: 1;
    transition: transform 0.1s ease, color 0.15s ease;

    &:hover {
      transform: scale(1.15);
    }

    &.is-active,
    &.is-hover {
      color: #eab308;
    }
  }
}

.active-rating-label {
  font-size: 0.8125rem;
}

.prompt-icon i {
  font-size: 2rem;
}

.max-w-md {
  max-width: 480px;
}
</style>

