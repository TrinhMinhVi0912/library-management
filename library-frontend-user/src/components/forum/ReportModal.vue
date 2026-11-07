<template>
  <div
    v-if="modelValue"
    class="modal-backdrop fade show"
    @click="close"
  />

  <div
    v-if="modelValue"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-labelledby="reportModalLabel"
    aria-modal="true"
    @keydown.esc="close"
  >
    <div
      class="modal-dialog modal-dialog-centered"
      @click.stop
    >
      <div class="modal-content border-0 shadow rounded-4">
        <div class="modal-header border-bottom pb-3">
          <div class="d-flex align-items-center gap-2">
            <div
              class="rounded-circle bg-danger-subtle text-danger p-2 d-flex align-items-center justify-content-center"
              style="width: 36px; height: 36px;"
            >
              <i
                class="bi bi-flag-fill fs-6"
                aria-hidden="true"
              />
            </div>
            <div>
              <h5
                id="reportModalLabel"
                class="modal-title fw-bold fs-6 mb-0 text-dark"
              >
                Báo cáo {{ targetType === 'thread' ? 'chủ đề' : 'bài viết' }} vi phạm
              </h5>
              <p
                v-if="targetTitle"
                class="small text-muted mb-0 text-truncate"
                style="max-width: 340px;"
              >
                {{ targetTitle }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="btn-close"
            aria-label="Đóng"
            :disabled="submitting"
            @click="close"
          />
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="modal-body py-3">
            <p class="small text-muted mb-3">
              Vui lòng chọn lý do bạn cho rằng nội dung này vi phạm tiêu chuẩn cộng đồng hoặc nội quy thư viện:
            </p>

            <div class="d-flex flex-column gap-2 mb-3">
              <label
                v-for="opt in reasonOptions"
                :key="opt.value"
                class="form-check p-2.5 rounded-3 border cursor-pointer transition-all"
                :class="selectedReason === opt.value ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-light-subtle bg-white hover-bg-light'"
              >
                <input
                  v-model="selectedReason"
                  class="form-check-input ms-1 me-2"
                  type="radio"
                  name="reportReason"
                  :value="opt.value"
                  :disabled="submitting"
                >
                <span class="form-check-label fw-medium text-dark small">{{ opt.label }}</span>
              </label>
            </div>

            <div class="mb-2">
              <label
                for="reportCustomDetails"
                class="form-label small fw-semibold text-secondary"
              >
                Chi tiết bổ sung <span
                  v-if="selectedReason === 'Khác'"
                  class="text-danger"
                >*</span>
              </label>
              <textarea
                id="reportCustomDetails"
                v-model="customDetails"
                class="form-control form-control-sm"
                rows="3"
                maxlength="500"
                :placeholder="selectedReason === 'Khác' ? 'Vui lòng mô tả cụ thể vi phạm để ban quản trị xử lý...' : 'Cung cấp thêm ngữ cảnh nếu cần (tối đa 500 ký tự)...'"
                :disabled="submitting"
              />
              <div class="text-end small text-muted mt-1">
                {{ customDetails.length }}/500
              </div>
            </div>

            <div
              v-if="errorMessage"
              class="alert alert-danger py-2 small mb-0 d-flex align-items-center gap-2"
            >
              <i
                class="bi bi-exclamation-triangle-fill"
                aria-hidden="true"
              />
              <span>{{ errorMessage }}</span>
            </div>
          </div>

          <div class="modal-footer border-top pt-2 pb-3">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary px-3 rounded-pill"
              :disabled="submitting"
              @click="close"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              class="btn btn-sm btn-danger px-4 rounded-pill fw-semibold d-inline-flex align-items-center gap-2"
              :disabled="submitting || !isValid"
            >
              <span
                v-if="submitting"
                class="spinner-border spinner-border-sm"
                aria-hidden="true"
              />
              <i
                v-else
                class="bi bi-send-fill"
                aria-hidden="true"
              />
              <span>Gửi báo cáo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import forumService from '@/services/forum.service';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  targetType: {
    type: String,
    required: true,
    validator: (v) => ['thread', 'post'].includes(v),
  },
  targetId: {
    type: String,
    required: true,
  },
  targetTitle: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue', 'submitted']);

const toast = useToast();

const reasonOptions = [
  { value: 'Nội dung phản cảm, khiêu dâm hoặc thù hận', label: 'Nội dung phản cảm, khiêu dâm hoặc kích động thù hận' },
  { value: 'Spam, quảng cáo trái phép hoặc lừa đảo', label: 'Spam, quảng cáo thương mại hoặc lừa đảo' },
  { value: 'Xúc phạm, quấy rối hoặc công kích cá nhân', label: 'Xúc phạm, quấy rối danh dự người khác' },
  { value: 'Vi phạm bản quyền sách hoặc thông tin sai lệch', label: 'Vi phạm bản quyền sách hoặc thông tin sai lệch' },
  { value: 'Khác', label: 'Lý do khác (vui lòng điền chi tiết bên dưới)' },
];

const selectedReason = ref(reasonOptions[0].value);
const customDetails = ref('');
const submitting = ref(false);
const errorMessage = ref('');

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      selectedReason.value = reasonOptions[0].value;
      customDetails.value = '';
      errorMessage.value = '';
    }
  }
);

const isValid = computed(() => {
  if (selectedReason.value === 'Khác') {
    return customDetails.value.trim().length >= 5;
  }
  return Boolean(selectedReason.value);
});

function close() {
  if (submitting.value) return;
  emit('update:modelValue', false);
}

async function handleSubmit() {
  if (!isValid.value || submitting.value) return;

  submitting.value = true;
  errorMessage.value = '';

  const finalReason = selectedReason.value === 'Khác'
    ? customDetails.value.trim()
    : (customDetails.value.trim() ? `${selectedReason.value} - Chi tiết: ${customDetails.value.trim()}` : selectedReason.value);

  try {
    await forumService.createReport({
      targetType: props.targetType,
      targetId: props.targetId,
      reason: finalReason,
    });

    toast.success('Báo cáo của bạn đã được gửi. Thủ thư sẽ sớm kiểm duyệt nội dung này.');
    emit('submitted');
    close();
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || err?.message || 'Không thể gửi báo cáo vi phạm. Vui lòng thử lại sau.';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-backdrop {
  z-index: 1050;
  background-color: rgba(17, 24, 39, 0.6);
}

.modal {
  z-index: 1055;
}

.cursor-pointer {
  cursor: pointer;
}

.hover-bg-light:hover {
  background-color: #f8f9fa !important;
}

.transition-all {
  transition: all 0.15s ease-in-out;
}
</style>
