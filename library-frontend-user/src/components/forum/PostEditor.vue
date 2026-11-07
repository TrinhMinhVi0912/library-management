<template>
  <div class="post-editor card border rounded-3 bg-white shadow-sm overflow-hidden">
    <!-- Header của Editor: Thanh công cụ hoặc trạng thái đang phản hồi -->
    <div
      v-if="replyingTo"
      class="bg-primary-subtle bg-opacity-25 px-3 py-2 border-bottom d-flex align-items-center justify-content-between"
    >
      <div class="d-flex align-items-center gap-2 small text-truncate">
        <i
          class="bi bi-reply-fill text-primary"
          aria-hidden="true"
        />
        <span class="text-secondary">Đang trả lời:</span>
        <strong class="text-dark">{{ formatAuthorName(replyingTo.author) }}</strong>
        <span
          class="text-muted text-truncate d-none d-md-inline"
          style="max-width: 320px;"
        >
          "{{ replyingTo.content }}"
        </span>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-link text-decoration-none text-danger p-0 ms-2"
        title="Hủy trả lời riêng"
        :disabled="submitting"
        @click="$emit('cancel-reply')"
      >
        <i
          class="bi bi-x-circle me-1"
          aria-hidden="true"
        />
        <span>Hủy</span>
      </button>
    </div>

    <!-- Thanh tab & công cụ Markdown -->
    <div class="px-3 pt-2.5 pb-2 border-bottom bg-light d-flex flex-wrap align-items-center justify-content-between gap-2">
      <!-- Tabs: Viết / Xem trước -->
      <div
        class="btn-group btn-group-sm"
        role="group"
        aria-label="Chế độ soạn thảo"
      >
        <button
          type="button"
          class="btn px-3"
          :class="mode === 'write' ? 'btn-white bg-white fw-bold shadow-xs' : 'btn-light text-secondary'"
          :disabled="disabled || submitting"
          @click="mode = 'write'"
        >
          <i
            class="bi bi-pencil-square me-1"
            aria-hidden="true"
          />
          Viết phản hồi
        </button>
        <button
          type="button"
          class="btn px-3"
          :class="mode === 'preview' ? 'btn-white bg-white fw-bold shadow-xs' : 'btn-light text-secondary'"
          :disabled="disabled || submitting"
          @click="mode = 'preview'"
        >
          <i
            class="bi bi-eye me-1"
            aria-hidden="true"
          />
          Xem trước
        </button>
      </div>

      <!-- Quick markdown actions -->
      <div
        v-if="mode === 'write' && !disabled"
        class="d-flex align-items-center gap-1"
      >
        <button
          type="button"
          class="btn btn-sm btn-light border-0 text-secondary p-1 px-2 rounded"
          title="In đậm (Ctrl+B)"
          :disabled="submitting"
          @click="insertFormat('**', '**', 'nội dung in đậm')"
        >
          <i
            class="bi bi-type-bold"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-light border-0 text-secondary p-1 px-2 rounded"
          title="In nghiêng (Ctrl+I)"
          :disabled="submitting"
          @click="insertFormat('*', '*', 'nội dung in nghiêng')"
        >
          <i
            class="bi bi-type-italic"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-light border-0 text-secondary p-1 px-2 rounded"
          title="Trích dẫn"
          :disabled="submitting"
          @click="insertPrefix('> ')"
        >
          <i
            class="bi bi-quote"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-light border-0 text-secondary p-1 px-2 rounded"
          title="Đoạn mã code"
          :disabled="submitting"
          @click="insertFormat('`', '`', 'code')"
        >
          <i
            class="bi bi-code-slash"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-light border-0 text-secondary p-1 px-2 rounded"
          title="Chèn liên kết"
          :disabled="submitting"
          @click="insertLink"
        >
          <i
            class="bi bi-link-45deg"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <!-- Khu vực nhập nội dung hoặc xem trước -->
    <div class="p-3">
      <!-- Cảnh báo nếu editor bị disable (chủ đề bị khóa) -->
      <div
        v-if="disabled"
        class="alert alert-warning d-flex align-items-center gap-2 mb-0 py-2.5 small"
      >
        <i
          class="bi bi-lock-fill fs-5"
          aria-hidden="true"
        />
        <div>{{ disabledMessage || 'Khu vực bình luận này hiện không nhận phản hồi mới.' }}</div>
      </div>

      <!-- Khung soạn thảo -->
      <div v-else>
        <div v-show="mode === 'write'">
          <textarea
            ref="textareaRef"
            v-model="content"
            class="form-control border-0 shadow-none p-1 fs-6"
            :rows="rows"
            maxlength="5000"
            :placeholder="placeholder"
            :disabled="submitting"
            @keydown.ctrl.enter.prevent="handleCtrlEnter"
          />
        </div>

        <!-- Khung xem trước -->
        <div
          v-show="mode === 'preview'"
          class="markdown-preview p-2 rounded bg-light min-h-preview overflow-auto"
        >
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="content.trim()"
            class="preview-content fs-6"
            v-html="renderedContent"
          />
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="text-muted small fst-italic py-3 text-center"
          >
            Chưa có nội dung để xem trước...
          </div>
        </div>
      </div>
    </div>

    <!-- Footer: Đếm ký tự + Nút gửi -->
    <div
      v-if="!disabled"
      class="px-3 py-2.5 bg-light border-top d-flex align-items-center justify-content-between"
    >
      <div class="small text-muted d-flex align-items-center gap-2">
        <span>{{ content.trim().length }}/5000 ký tự</span>
        <span class="d-none d-sm-inline opacity-50">· Hỗ trợ định dạng Markdown</span>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button
          v-if="replyingTo"
          type="button"
          class="btn btn-sm btn-outline-secondary rounded-pill px-3"
          :disabled="submitting"
          @click="$emit('cancel-reply')"
        >
          Hủy
        </button>
        <button
          type="button"
          class="btn btn-sm btn-primary rounded-pill px-4 fw-semibold d-inline-flex align-items-center gap-2"
          :disabled="submitting || !isValid"
          @click="handleSubmit"
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
          <span>{{ replyingTo ? 'Trả lời' : 'Gửi phản hồi' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps({
  replyingTo: {
    type: Object,
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: 'Chia sẻ ý kiến, câu hỏi hoặc suy nghĩ của bạn về chủ đề này...',
  },
  rows: {
    type: Number,
    default: 4,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  disabledMessage: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['submit', 'cancel-reply']);

const mode = ref('write'); // 'write' | 'preview'
const content = ref('');
const textareaRef = ref(null);

const isValid = computed(() => {
  return content.value.trim().length >= 1 && content.value.trim().length <= 5000;
});

const renderedContent = computed(() => {
  return renderMarkdown(content.value);
});

function formatAuthorName(author) {
  if (!author) return 'Thành viên';
  const fullName = [author.lastName, author.firstName].filter(Boolean).join(' ');
  return fullName || 'Thành viên';
}

function insertFormat(prefix, suffix, defaultText = '') {
  const el = textareaRef.value;
  if (!el) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = content.value.substring(start, end) || defaultText;

  content.value = content.value.substring(0, start) + prefix + selected + suffix + content.value.substring(end);

  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  });
}

function insertPrefix(prefix) {
  const el = textareaRef.value;
  if (!el) return;

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = content.value.substring(start, end);

  content.value = content.value.substring(0, start) + prefix + selected + content.value.substring(end);

  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  });
}

function insertLink() {
  insertFormat('[', '](https://)', 'Tên liên kết');
}

function handleCtrlEnter() {
  if (isValid.value && !props.submitting) {
    handleSubmit();
  }
}

function handleSubmit() {
  if (!isValid.value || props.submitting) return;
  emit('submit', { content: content.value.trim() });
}

function clear() {
  content.value = '';
  mode.value = 'write';
}

defineExpose({
  clear,
  focus: () => {
    nextTick(() => {
      textareaRef.value?.focus();
    });
  },
});
</script>

<style scoped>
.min-h-preview {
  min-height: 96px;
  max-height: 350px;
}

.shadow-xs {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn-white {
  background-color: #ffffff;
  color: #1f2937;
  border-color: #e5e7eb;
}

textarea:focus {
  outline: none;
  box-shadow: none;
}
</style>
