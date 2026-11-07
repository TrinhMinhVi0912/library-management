<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import reviewService from '@/services/review.service';
import ReviewItem from '@/components/book/ReviewItem.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import Pagination from '@/components/common/Pagination.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const reviews = ref([]);
const meta = ref({ total: 0, page: 1, limit: 10, totalPages: 1 });
const loading = ref(true);
const currentPage = ref(Number(route.query.page || 1));

// Trạng thái sửa tại chỗ (inline editing)
const editingId = ref(null);
const editRating = ref(5);
const editComment = ref('');
const isSaving = ref(false);
const hoverRating = ref(0);

// Trạng thái xóa đánh giá
const deleteModalOpen = ref(false);
const reviewToDelete = ref(null);
const isDeleting = ref(false);

const ratingLabels = {
  1: 'Rất tệ',
  2: 'Chưa tốt',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất xuất sắc',
};

async function fetchMyReviews() {
  loading.value = true;
  try {
    const result = await reviewService.getMyReviews({
      page: currentPage.value,
      limit: 10,
    });
    reviews.value = result.reviews || [];
    meta.value = result.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };
  } catch {
    reviews.value = [];
    meta.value = { total: 0, page: 1, limit: 10, totalPages: 1 };
  } finally {
    loading.value = false;
  }
}

function handlePageChange(newPage) {
  currentPage.value = newPage;
  router.replace({ query: { ...route.query, page: String(newPage) } });
  fetchMyReviews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bắt đầu sửa tại chỗ
function startEdit(review) {
  editingId.value = review._id;
  editRating.value = Number(review.rating) || 5;
  editComment.value = review.comment || '';
  hoverRating.value = 0;
}

// Hủy sửa tại chỗ
function cancelEdit() {
  editingId.value = null;
  editRating.value = 5;
  editComment.value = '';
}

// Lưu sửa tại chỗ
async function saveEdit(review) {
  if (editRating.value < 1 || editRating.value > 5) {
    toast.error('Vui lòng chọn số sao từ 1 đến 5');
    return;
  }
  if (editComment.value && editComment.value.length > 2000) {
    toast.error('Nội dung nhận xét tối đa 2000 ký tự');
    return;
  }

  isSaving.value = true;
  try {
    const updated = await reviewService.updateOwnReview(review._id, {
      rating: Number(editRating.value),
      comment: editComment.value.trim(),
    });

    // Cập nhật lại trong danh sách
    const idx = reviews.value.findIndex((r) => r._id === review._id);
    if (idx >= 0) {
      reviews.value[idx] = {
        ...reviews.value[idx],
        ...updated,
        book: review.book, // Giữ lại thông tin sách đã populate
      };
    }

    toast.success('Đã cập nhật đánh giá thành công!');
    cancelEdit();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể cập nhật đánh giá.');
  } finally {
    isSaving.value = false;
  }
}

// Mở modal xác nhận xóa
function promptDelete(review) {
  reviewToDelete.value = review;
  deleteModalOpen.value = true;
}

// Thực hiện xóa
async function confirmDelete() {
  if (!reviewToDelete.value) return;
  isDeleting.value = true;
  try {
    await reviewService.deleteOwnReview(reviewToDelete.value._id);
    toast.success('Đã xóa đánh giá thành công!');
    deleteModalOpen.value = false;
    reviewToDelete.value = null;
    await fetchMyReviews();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể xóa đánh giá.');
  } finally {
    isDeleting.value = false;
  }
}

watch(
  () => route.query.page,
  (newPage) => {
    const pageNum = Number(newPage || 1);
    if (pageNum !== currentPage.value) {
      currentPage.value = pageNum;
      fetchMyReviews();
    }
  }
);

onMounted(() => {
  fetchMyReviews();
});
</script>

<template>
  <div class="my-reviews-page container-xl py-4">
    <!-- Header -->
    <div class="page-header mb-4">
      <h1 class="page-title mb-1">
        Đánh giá của tôi
      </h1>
      <p class="text-secondary mb-0">
        Xem lại và quản lý những nhận xét, chia sẻ cảm nhận bạn đã gửi cho các tác phẩm
      </p>
    </div>

    <!-- Đang tải -->
    <div
      v-if="loading"
      class="d-flex flex-column gap-3"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="card border-0 shadow-sm p-4 rounded-3 skeleton-card"
      >
        <div class="d-flex gap-3 align-items-center mb-3">
          <div class="skeleton-thumb" />
          <div class="flex-grow-1">
            <div class="skeleton-line w-50 mb-2" />
            <div class="skeleton-line w-25" />
          </div>
        </div>
        <div class="skeleton-line w-75 mb-2" />
        <div class="skeleton-line w-100" />
      </div>
    </div>

    <!-- Chưa có đánh giá nào -->
    <div
      v-else-if="reviews.length === 0"
      class="card border-0 shadow-sm py-5"
    >
      <EmptyState
        icon="bi bi-star"
        title="Bạn chưa có đánh giá nào"
        description="Hãy mượn những cuốn sách bạn yêu thích và chia sẻ cảm nhận cùng mọi người nhé!"
      >
        <template #actions>
          <RouterLink
            :to="{ name: 'books' }"
            class="btn btn-primary btn-sm"
          >
            Khám phá danh mục sách
          </RouterLink>
        </template>
      </EmptyState>
    </div>

    <!-- Danh sách đánh giá -->
    <div
      v-else
      class="reviews-wrapper d-flex flex-column"
    >
      <div class="d-flex justify-content-between align-items-center mb-3 text-secondary small">
        <span>Tổng cộng <strong>{{ meta.total }}</strong> đánh giá</span>
      </div>

      <div
        v-for="rev in reviews"
        :key="rev._id"
        class="review-container mb-3"
      >
        <!-- Chế độ sửa tại chỗ -->
        <div
          v-if="editingId === rev._id"
          class="inline-edit-card card border-primary border-2 shadow-sm p-4 rounded-3"
        >
          <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
            <h3 class="h6 fw-bold text-dark mb-0">
              Chỉnh sửa đánh giá: <em>{{ rev.book?.title }}</em>
            </h3>
            <button
              type="button"
              class="btn-close"
              aria-label="Đóng"
              @click="cancelEdit"
            />
          </div>

          <!-- Bộ chọn sao -->
          <div class="mb-3">
            <label class="form-label fw-semibold small text-secondary d-block mb-1">
              Đánh giá của bạn <span class="text-danger">*</span>
            </label>
            <div class="d-flex align-items-center gap-2">
              <div
                class="star-picker d-inline-flex gap-1"
                @mouseleave="hoverRating = 0"
              >
                <button
                  v-for="star in 5"
                  :key="star"
                  type="button"
                  class="star-btn"
                  :class="{
                    'is-active': star <= (hoverRating || editRating),
                  }"
                  :aria-label="`${star} sao`"
                  @mouseenter="hoverRating = star"
                  @click="editRating = star"
                >
                  <i
                    class="bi"
                    :class="star <= (hoverRating || editRating) ? 'bi-star-fill' : 'bi-star'"
                  />
                </button>
              </div>
              <span class="badge bg-light text-primary border px-2 py-1 small">
                {{ hoverRating || editRating }} sao – {{ ratingLabels[hoverRating || editRating] }}
              </span>
            </div>
          </div>

          <!-- Nội dung nhận xét -->
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label
                for="edit-comment-textarea"
                class="form-label fw-semibold small text-secondary mb-0"
              >
                Nhận xét chi tiết
              </label>
              <span
                class="small"
                :class="{ 'text-danger': editComment.length > 2000, 'text-secondary': editComment.length <= 2000 }"
              >
                {{ editComment.length }}/2000
              </span>
            </div>
            <textarea
              id="edit-comment-textarea"
              v-model="editComment"
              class="form-control"
              rows="3"
              maxlength="2000"
              placeholder="Chia sẻ cảm nhận của bạn về cuốn sách..."
              :disabled="isSaving"
            />
          </div>

          <!-- Nút thao tác -->
          <div class="d-flex justify-content-end gap-2">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              :disabled="isSaving"
              @click="cancelEdit"
            >
              Hủy
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
              :disabled="isSaving || (editComment && editComment.length > 2000)"
              @click="saveEdit(rev)"
            >
              <span
                v-if="isSaving"
                class="spinner-border spinner-border-sm"
                role="status"
              />
              <i
                v-else
                class="bi bi-check-lg"
                aria-hidden="true"
              />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>

        <!-- Chế độ xem bình thường -->
        <ReviewItem
          v-else
          :review="rev"
          :show-book="true"
          :allow-actions="true"
          @edit="startEdit"
          @delete="promptDelete"
        />
      </div>

      <!-- Phân trang -->
      <div
        v-if="meta.totalPages > 1"
        class="d-flex justify-content-center mt-4"
      >
        <Pagination
          :page="currentPage"
          :total-pages="meta.totalPages"
          :total="meta.total"
          @update:page="handlePageChange"
        />
      </div>
    </div>

    <!-- Modal xác nhận xóa đánh giá -->
    <ConfirmModal
      v-model="deleteModalOpen"
      title="Xác nhận xóa đánh giá"
      :message="`Bạn có chắc chắn muốn xóa đánh giá của cuốn sách &quot;${reviewToDelete?.book?.title || 'này'}&quot;? Điểm đánh giá trung bình của sách sẽ được tính toán lại.`"
      confirm-text="Xóa đánh giá"
      cancel-text="Hủy"
      variant="danger"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="reviewToDelete = null"
    />
  </div>
</template>

<style scoped lang="scss">
.my-reviews-page {
  max-width: 900px;
}

.page-title {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
}

.inline-edit-card {
  background-color: #ffffff;
}

.star-picker {
  .star-btn {
    border: none;
    background: transparent;
    padding: 0.125rem;
    font-size: 1.375rem;
    color: #cbd5e1;
    cursor: pointer;
    line-height: 1;
    transition: transform 0.1s ease, color 0.15s ease;

    &:hover {
      transform: scale(1.15);
    }

    &.is-active {
      color: #eab308;
    }
  }
}

.skeleton-card {
  background-color: #ffffff;

  .skeleton-thumb {
    width: 48px;
    height: 64px;
    background-color: #f1f5f9;
    border-radius: 0.375rem;
    animation: skeleton-pulse 1.5s infinite;
  }

  .skeleton-line {
    height: 0.875rem;
    background-color: #f1f5f9;
    border-radius: 0.25rem;
    animation: skeleton-pulse 1.5s infinite;
  }
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

