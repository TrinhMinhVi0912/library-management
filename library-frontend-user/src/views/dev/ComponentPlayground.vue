<script setup>
import { ref } from 'vue';
import { useToast } from 'vue-toastification';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import FormModal from '@/components/common/FormModal.vue';
import Pagination from '@/components/common/Pagination.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';

const toast = useToast();
const search = ref('');
const lastSearch = ref('');
const page = ref(2);
const confirmOpen = ref(false);
const formOpen = ref(false);
const demoName = ref('');
const demoImage = ref(null);

const statusGroups = [
  { type: 'loan', label: 'Phiếu mượn', statuses: ['pending', 'approved', 'borrowing', 'overdue', 'returned', 'rejected', 'cancelled', 'expired'] },
  { type: 'item', label: 'Quyển sách trong phiếu', statuses: ['pending', 'borrowing', 'returned', 'lost'] },
  { type: 'fine', label: 'Khoản phạt', statuses: ['unpaid', 'paid', 'waived'] },
  { type: 'renewal', label: 'Yêu cầu gia hạn', statuses: ['pending', 'approved', 'rejected', 'cancelled'] },
  { type: 'reservation', label: 'Đặt trước', statuses: ['waiting', 'available', 'fulfilled', 'expired', 'cancelled'] },
  { type: 'book', label: 'Sách', statuses: ['active', 'hidden', 'available', 'unavailable'] },
];

function confirmAction() {
  confirmOpen.value = false;
  toast.success('Đã xác nhận thao tác thử.');
}

function submitForm() {
  formOpen.value = false;
  toast.success(`Đã lưu${demoName.value ? `: ${demoName.value}` : ''}.`);
}
</script>

<template>
  <main class="container py-4 component-playground">
    <header class="page-heading mb-4">
      <h1>Thử component dùng chung</h1>
      <p class="text-secondary mb-0">
        Trang chỉ có trong môi trường phát triển.
      </p>
    </header>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="badge-heading"
    >
      <h2
        id="badge-heading"
        class="h5"
      >
        Trạng thái
      </h2>
      <div
        v-for="group in statusGroups"
        :key="group.type"
        class="status-group"
      >
        <h3 class="h6">
          {{ group.label }}
        </h3>
        <div class="d-flex flex-wrap gap-2">
          <StatusBadge
            v-for="status in group.statuses"
            :key="`${group.type}-${status}`"
            :type="group.type"
            :status="status"
          />
        </div>
      </div>
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="search-heading"
    >
      <h2
        id="search-heading"
        class="h5"
      >
        Tìm kiếm
      </h2>
      <SearchBar
        v-model="search"
        placeholder="Tìm sách..."
        @search="lastSearch = $event"
      />
      <p class="text-secondary mt-2 mb-0">
        Đã gửi tìm kiếm: {{ lastSearch || 'Chưa có' }}
      </p>
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="pagination-heading"
    >
      <h2
        id="pagination-heading"
        class="h5"
      >
        Phân trang
      </h2>
      <Pagination
        v-model:page="page"
        :total-pages="8"
        :total="72"
      />
      <p class="text-secondary mb-0">
        Trang đang chọn: {{ page }}
      </p>
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="empty-heading"
    >
      <h2
        id="empty-heading"
        class="h5"
      >
        Trạng thái rỗng
      </h2>
      <EmptyState
        title="Chưa có sách trong danh sách"
        description="Thử tìm một đầu sách để bắt đầu."
        action-label="Thử thông báo thành công"
        @action="toast.success('Thông báo thành công đang hoạt động.')"
      />
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="skeleton-heading"
    >
      <h2
        id="skeleton-heading"
        class="h5"
      >
        Đang tải
      </h2>
      <div class="row g-3">
        <div class="col-12 col-sm-6 col-lg-4">
          <SkeletonCard />
        </div>
        <div class="col-12 col-sm-6 col-lg-4">
          <SkeletonCard
            :show-image="false"
            :lines="2"
          />
        </div>
      </div>
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="modal-heading"
    >
      <h2
        id="modal-heading"
        class="h5"
      >
        Hộp thoại
      </h2>
      <div class="d-flex flex-wrap gap-2">
        <button
          class="btn btn-outline-danger"
          type="button"
          @click="confirmOpen = true"
        >
          Mở xác nhận
        </button>
        <button
          class="btn btn-primary"
          type="button"
          @click="formOpen = true"
        >
          Mở biểu mẫu
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          @click="toast.error('Thông báo lỗi đang hoạt động.')"
        >
          Thử thông báo lỗi
        </button>
      </div>
    </section>

    <section
      class="surface-card p-3 mb-3"
      aria-labelledby="heading-uploader"
    >
      <h2
        id="heading-uploader"
        class="h5 mb-3"
      >
        ImageUploader (dùng chung)
      </h2>
      <div class="d-flex flex-wrap gap-4 align-items-center">
        <div>
          <div class="small text-muted mb-2 text-center">
            Tròn (Avatar)
          </div>
          <ImageUploader
            v-model="demoImage"
            shape="circle"
            size="110px"
            :auto-upload="false"
            button-text="Chọn ảnh"
          />
        </div>
        <div>
          <div class="small text-muted mb-2 text-center">
            Bo góc (Sách / Thẻ)
          </div>
          <ImageUploader
            shape="rounded"
            size="110px"
            :auto-upload="false"
            button-text="Chọn ảnh"
          />
        </div>
      </div>
    </section>

    <ConfirmModal
      v-model="confirmOpen"
      title="Xác nhận thao tác thử"
      message="Hộp thoại có thể đóng bằng Escape hoặc nút Hủy."
      confirm-text="Tiếp tục"
      variant="danger"
      @confirm="confirmAction"
    />
    <FormModal
      v-model="formOpen"
      title="Biểu mẫu thử"
      @submit="submitForm"
    >
      <label
        class="form-label"
        for="demo-name"
      >Tên hiển thị</label>
      <input
        id="demo-name"
        v-model.trim="demoName"
        class="form-control"
        maxlength="100"
      >
    </FormModal>
  </main>
</template>

<style scoped>
.surface-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
}

.status-group + .status-group {
  margin-top: 1rem;
}

.status-group h3 {
  color: #6b7280;
}
</style>
