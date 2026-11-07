<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import reservationService from '@/services/reservation.service';

const props = defineProps({
  bookId: { type: String, required: true },
  bookTitle: { type: String, default: 'sách này' },
});
const emit = defineEmits(['reserved']);
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const loading = ref(false);

async function reserve() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
    return;
  }
  if (auth.role !== 'reader') {
    toast.warning('Chỉ tài khoản độc giả mới có thể đặt trước sách.');
    return;
  }

  loading.value = true;
  try {
    await reservationService.createReservation(props.bookId);
    toast.success(`Đã thêm “${props.bookTitle}” vào hàng chờ đặt trước.`);
    emit('reserved');
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message
      || (status === 409
        ? 'Sách đã có bản có thể mượn hoặc bạn đã có lượt đặt trước đang hoạt động.'
        : 'Không thể đặt trước sách. Vui lòng thử lại.');
    toast.error(message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button
    class="btn btn-primary w-100"
    type="button"
    :disabled="loading"
    @click="reserve"
  >
    <span
      v-if="loading"
      class="spinner-border spinner-border-sm me-2"
      aria-hidden="true"
    />
    <i
      v-else
      class="bi bi-clock-history me-2"
      aria-hidden="true"
    />
    Đặt trước sách
  </button>
</template>
