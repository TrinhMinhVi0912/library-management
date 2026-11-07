<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import api from '@/services/api.service';

const props = defineProps({
  modelValue: {
    type: [String, Object],
    default: null,
  },
  shape: {
    type: String,
    default: 'circle', // 'circle' | 'square' | 'rounded'
    validator: (v) => ['circle', 'square', 'rounded'].includes(v),
  },
  size: {
    type: String,
    default: '128px',
  },
  maxSize: {
    type: Number,
    default: 2 * 1024 * 1024, // 2MB
  },
  acceptedTypes: {
    type: Array,
    default: () => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  uploadUrl: {
    type: String,
    default: '/me/avatar',
  },
  uploadFn: {
    type: Function,
    default: null,
  },
  autoUpload: {
    type: Boolean,
    default: true,
  },
  alt: {
    type: String,
    default: 'Ảnh đại diện',
  },
  placeholderIcon: {
    type: String,
    default: 'bi-person-fill',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  buttonText: {
    type: String,
    default: 'Chọn ảnh mới',
  },
});

const emit = defineEmits(['update:modelValue', 'success', 'error', 'file-selected']);

const fileInput = ref(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const localError = ref('');
const previewUrl = ref('');

const currentImageUrl = computed(() => {
  if (previewUrl.value) return previewUrl.value;
  if (typeof props.modelValue === 'string') return props.modelValue;
  if (props.modelValue && typeof props.modelValue === 'object') {
    return props.modelValue.url || '';
  }
  return '';
});

const acceptString = computed(() => props.acceptedTypes.join(', '));

watch(
  () => props.modelValue,
  () => {
    // Nếu props thay đổi từ bên ngoài (hoặc sau khi upload hoàn thành), xóa preview tạm nếu đã khớp
    if (previewUrl.value && !isUploading.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = '';
    }
  }
);

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});

function openPicker() {
  if (props.disabled || isUploading.value) return;
  localError.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
}

function validateFile(file) {
  if (!file) {
    return 'Vui lòng chọn một tệp hình ảnh.';
  }

  const isValidType = props.acceptedTypes.includes(file.type) || file.type.startsWith('image/');
  if (!isValidType) {
    return 'Định dạng tệp không hợp lệ. Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.';
  }

  if (file.size > props.maxSize) {
    const maxMb = (props.maxSize / (1024 * 1024)).toFixed(0);
    return `Kích thước tệp không được vượt quá ${maxMb}MB.`;
  }

  return null;
}

async function handleFile(file) {
  const errorMsg = validateFile(file);
  if (errorMsg) {
    localError.value = errorMsg;
    emit('error', errorMsg);
    return;
  }

  localError.value = '';
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = URL.createObjectURL(file);
  emit('file-selected', file);

  if (!props.autoUpload) {
    return;
  }

  await uploadFile(file);
}

async function uploadFile(file) {
  isUploading.value = true;
  uploadProgress.value = 0;
  localError.value = '';

  try {
    let result = null;

    if (props.uploadFn) {
      result = await props.uploadFn(file, (percent) => {
        uploadProgress.value = percent;
      });
    } else {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('file', file);

      const response = await api.post(props.uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            uploadProgress.value = Math.round((evt.loaded * 100) / evt.total);
          }
        },
      });
      result = response.data?.data;
    }

    const payload = {
      url: result?.url || (typeof result === 'string' ? result : ''),
      publicId: result?.publicId || '',
    };

    emit('update:modelValue', payload);
    emit('success', result);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Tải ảnh lên thất bại. Vui lòng thử lại.';
    localError.value = msg;
    emit('error', msg);
    // Hủy preview tạm nếu lỗi tải lên
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = '';
    }
  } finally {
    isUploading.value = false;
  }
}

function onFileChange(event) {
  const file = event.target.files?.[0];
  if (file) {
    handleFile(file);
  }
}

function onDrop(event) {
  if (props.disabled || isUploading.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    handleFile(file);
  }
}
</script>

<template>
  <div
    class="image-uploader"
    :class="{ 'is-disabled': disabled, 'is-uploading': isUploading }"
  >
    <input
      ref="fileInput"
      type="file"
      class="d-none"
      :accept="acceptString"
      :disabled="disabled || isUploading"
      @change="onFileChange"
    >

    <div
      class="image-container"
      :class="[`shape-${shape}`, { 'has-image': Boolean(currentImageUrl) }]"
      :style="{ width: size, height: size }"
      tabindex="0"
      role="button"
      :aria-label="alt"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <img
        v-if="currentImageUrl"
        :src="currentImageUrl"
        :alt="alt"
        class="uploaded-image"
      >
      <div
        v-else
        class="placeholder-box"
      >
        <i
          :class="['bi', placeholderIcon]"
          aria-hidden="true"
        />
      </div>

      <!-- Overlay khi hover hoặc đang upload -->
      <div class="hover-overlay">
        <template v-if="isUploading">
          <div class="spinner-border spinner-border-sm text-light mb-1" />
          <span class="upload-percent">{{ uploadProgress }}%</span>
        </template>
        <template v-else>
          <i
            class="bi bi-camera-fill overlay-icon"
            aria-hidden="true"
          />
          <span class="overlay-text">{{ currentImageUrl ? 'Đổi ảnh' : 'Tải ảnh' }}</span>
        </template>
      </div>

      <!-- Thanh tiến trình dưới đáy preview -->
      <div
        v-if="isUploading"
        class="progress-bar-container"
      >
        <div
          class="progress-bar-fill"
          :style="{ width: `${uploadProgress}%` }"
        />
      </div>
    </div>

    <!-- Nút hành động phụ và thông tin hướng dẫn -->
    <div class="uploader-controls mt-2">
      <button
        type="button"
        class="btn btn-sm btn-outline-primary upload-btn"
        :disabled="disabled || isUploading"
        @click="openPicker"
      >
        <i
          v-if="!isUploading"
          class="bi bi-upload me-1"
          aria-hidden="true"
        />
        <span
          v-if="isUploading"
          class="spinner-border spinner-border-sm me-1"
        />
        <span>{{ isUploading ? `Đang tải (${uploadProgress}%)` : buttonText }}</span>
      </button>
      <div class="helper-text text-muted mt-1">
        JPG, PNG, WebP hoặc GIF (tối đa 2MB)
      </div>
    </div>

    <!-- Thông báo lỗi cục bộ nếu có -->
    <div
      v-if="localError"
      class="text-danger small mt-1 error-message"
    >
      <i
        class="bi bi-exclamation-circle me-1"
        aria-hidden="true"
      />
      {{ localError }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.image-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: #f3f4f6;
  border: 2px dashed #d1d5db;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
  outline: none;

  &:hover,
  &:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);

    .hover-overlay {
      opacity: 1;
    }
  }

  &.shape-circle {
    border-radius: 50%;
  }

  &.shape-square {
    border-radius: 0;
  }

  &.shape-rounded {
    border-radius: 0.75rem;
  }

  &.has-image {
    border-style: solid;
    border-color: #e5e7eb;
  }
}

.uploaded-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #9ca3af;
  font-size: 2.5rem;
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(17, 24, 39, 0.6);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 0.5rem;

  .is-uploading & {
    opacity: 1;
    background: rgba(17, 24, 39, 0.75);
  }
}

.overlay-icon {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.overlay-text,
.upload-percent {
  font-size: 0.75rem;
  font-weight: 600;
}

.progress-bar-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
}

.progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.15s ease-out;
}

.uploader-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.helper-text {
  font-size: 0.75rem;
}

.error-message {
  font-weight: 500;
}
</style>

