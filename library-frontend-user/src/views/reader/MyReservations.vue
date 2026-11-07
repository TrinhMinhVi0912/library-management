<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { dayjs, TIMEZONE, formatDate } from '@/utils/format';
import reservationService from '@/services/reservation.service';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import Pagination from '@/components/common/Pagination.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const reservations = ref([]);
const meta = ref({ page: 1, total: 0, totalPages: 1 });
const page = ref(Math.max(1, Number(route.query.page) || 1));
const loading = ref(true);
const error = ref('');
const now = ref(Date.now());
const reservationToCancel = ref(null);
const cancelling = ref(false);
const showCancelConfirmation = ref(false);
const LIMIT = 10;
let clockInterval;

const confirmTitle = computed(() => `Hủy lượt đặt trước “${reservationToCancel.value?.book?.title || 'sách'}”?`);

async function loadReservations() {
  loading.value = true;
  error.value = '';
  try {
    const result = await reservationService.getMyReservations({ page: page.value, limit: LIMIT });
    reservations.value = result.reservations;
    meta.value = result.meta;
  } catch (requestError) {
    reservations.value = [];
    error.value = requestError.response?.data?.message || 'Không tải được danh sách đặt trước.';
  } finally {
    loading.value = false;
  }
}

function countdown(holdUntil) {
  if (!holdUntil) return '';
  const milliseconds = dayjs(holdUntil).tz(TIMEZONE).valueOf() - now.value;
  if (milliseconds <= 0) return 'Đã hết hạn giữ; hệ thống đang cập nhật hàng chờ.';
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return days > 0
    ? `Còn ${days} ngày ${remainingHours} giờ ${minutes} phút`
    : `Còn ${hours} giờ ${minutes} phút ${seconds} giây`;
}

function openBook(reservation) {
  const bookId = reservation.book?.slug || reservation.book?._id;
  if (bookId) router.push({ name: 'book-detail', params: { slug: bookId } });
}

async function cancelReservation() {
  if (!reservationToCancel.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await reservationService.cancelReservation(reservationToCancel.value._id);
    toast.success('Đã hủy lượt đặt trước. Nếu đang giữ sách, hệ thống sẽ chuyển lượt cho người kế tiếp.');
    reservationToCancel.value = null;
    showCancelConfirmation.value = false;
    await loadReservations();
  } catch (requestError) {
    toast.error(requestError.response?.data?.message || 'Không thể hủy lượt đặt trước. Vui lòng thử lại.');
  } finally {
    cancelling.value = false;
  }
}

watch(page, (value) => {
  router.replace({ query: { ...route.query, ...(value > 1 ? { page: String(value) } : { page: undefined }) } });
  loadReservations();
});

watch(() => route.query.page, (value) => {
  const nextPage = Math.max(1, Number(value) || 1);
  if (nextPage !== page.value) page.value = nextPage;
});

onMounted(() => {
  loadReservations();
  clockInterval = window.setInterval(() => { now.value = Date.now(); }, 1000);
});

onBeforeUnmount(() => window.clearInterval(clockInterval));
</script>

<template>
  <section class="container py-4 my-reservations-page">
    <nav aria-label="Đường dẫn">
      <ol class="breadcrumb mb-3">
        <li class="breadcrumb-item">
          <RouterLink :to="{ name: 'home' }">
            Trang chủ
          </RouterLink>
        </li>
        <li
          class="breadcrumb-item active"
          aria-current="page"
        >
          Sách đặt trước
        </li>
      </ol>
    </nav>

    <header class="mb-4">
      <h1 class="h3 mb-1">
        Sách đặt trước
      </h1>
      <p class="text-secondary mb-0">
        Theo dõi vị trí trong hàng chờ và thời hạn nhận sách.
      </p>
    </header>

    <div
      v-if="error"
      class="alert alert-danger d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2"
      role="alert"
    >
      <span>{{ error }}</span>
      <button
        class="btn btn-sm btn-outline-danger align-self-start"
        type="button"
        @click="loadReservations"
      >
        Thử lại
      </button>
    </div>

    <div
      v-if="loading"
      class="d-grid gap-3"
      aria-busy="true"
      aria-label="Đang tải lượt đặt trước"
    >
      <SkeletonCard
        v-for="item in 3"
        :key="item"
      />
    </div>

    <EmptyState
      v-else-if="!error && reservations.length === 0"
      title="Bạn chưa đặt trước sách nào"
      description="Khi sách đã hết bản có thể mượn, bạn có thể tham gia hàng chờ từ trang chi tiết sách."
      action-label="Tìm sách"
      @action="router.push({ name: 'books' })"
    />

    <template v-else-if="!error">
      <div class="reservation-list">
        <article
          v-for="reservation in reservations"
          :key="reservation._id"
          class="reservation-card"
        >
          <div
            class="reservation-cover"
            aria-hidden="true"
          >
            <img
              v-if="reservation.book?.cover?.url"
              :src="reservation.book.cover.url"
              :alt="`Bìa ${reservation.book.title}`"
              loading="lazy"
            >
            <i
              v-else
              class="bi bi-book"
            />
          </div>
          <div class="reservation-main">
            <button
              class="reservation-title"
              type="button"
              @click="openBook(reservation)"
            >
              {{ reservation.book?.title || 'Sách không còn trong danh mục' }}
            </button>
            <div class="reservation-meta">
              <StatusBadge
                type="reservation"
                :status="reservation.status"
              />
              <span
                v-if="reservation.status === 'waiting' && reservation.queuePosition"
                class="text-secondary"
              >
                Vị trí hàng chờ: <strong>{{ reservation.queuePosition }}</strong>
              </span>
              <span
                v-else-if="reservation.status === 'available'"
                class="text-success fw-semibold"
              >
                Sách đã sẵn sàng cho bạn
              </span>
            </div>
            <p
              v-if="reservation.status === 'available' && reservation.holdUntil"
              class="reservation-hold mb-1"
              :class="{ 'text-danger': dayjs(reservation.holdUntil).valueOf() <= now }"
              aria-live="polite"
            >
              {{ countdown(reservation.holdUntil) }}
            </p>
            <p
              v-if="reservation.holdUntil"
              class="small text-secondary mb-0"
            >
              Hạn giữ: {{ formatDate(reservation.holdUntil) }}
            </p>
            <p
              v-if="reservation.status === 'waiting'"
              class="small text-secondary mb-0"
            >
              Đặt lúc {{ formatDate(reservation.createdAt) }}
            </p>
          </div>
          <div class="reservation-actions">
            <button
              v-if="reservation.status === 'available'"
              class="btn btn-sm btn-primary"
              type="button"
              @click="openBook(reservation)"
            >
              <i
                class="bi bi-bag-plus me-1"
                aria-hidden="true"
              />Thêm vào giỏ
            </button>
            <button
              v-if="['waiting', 'available'].includes(reservation.status)"
              class="btn btn-sm btn-outline-danger"
              type="button"
              @click="reservationToCancel = reservation; showCancelConfirmation = true"
            >
              Hủy lượt
            </button>
            <button
              v-else
              class="btn btn-sm btn-outline-secondary"
              type="button"
              @click="openBook(reservation)"
            >
              Xem sách
            </button>
          </div>
        </article>
      </div>

      <Pagination
        :page="page"
        :total-pages="meta.totalPages"
        :total="meta.total"
        @update:page="page = $event"
      />
    </template>

    <ConfirmModal
      v-model="showCancelConfirmation"
      :title="confirmTitle"
      message="Nếu sách đang được giữ cho bạn, lượt giữ sẽ được chuyển cho người tiếp theo trong hàng chờ."
      confirm-text="Hủy lượt đặt trước"
      variant="danger"
      :loading="cancelling"
      @confirm="cancelReservation"
    />
  </section>
</template>

<style scoped>
.reservation-list {
  display: grid;
  gap: 1rem;
}

.reservation-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 1rem;
}

.reservation-cover {
  display: grid;
  flex: 0 0 4rem;
  aspect-ratio: 3 / 4;
  place-items: center;
  overflow: hidden;
  border-radius: 0.35rem;
  background: #f8f9fa;
  color: #6b7280;
  font-size: 1.5rem;
}

.reservation-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reservation-main {
  flex: 1;
  min-width: 0;
}

.reservation-title {
  margin-bottom: 0.5rem;
  border: 0;
  background: none;
  color: #111827;
  font-weight: 600;
  text-align: left;
}

.reservation-title:hover {
  color: #2563eb;
  text-decoration: underline;
}

.reservation-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 0.5rem;
}

.reservation-hold {
  color: #166534;
  font-weight: 600;
}

.reservation-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .reservation-card {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .reservation-main {
    flex: 1 1 calc(100% - 5rem);
  }

  .reservation-actions {
    flex-direction: row;
    width: 100%;
    padding-left: 5rem;
  }
}
</style>
