<template>
  <div
    :id="`post-${post._id}`"
    class="post-item transition-all"
    :class="[
      isNested ? 'post-item-nested ms-3 ms-md-5 ps-3 pt-3 mt-2 border-start border-2 border-primary-subtle bg-light-subtle rounded-end-3' : 'pt-3 pb-3 border-bottom'
    ]"
  >
    <!-- Header thông tin tác giả -->
    <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
      <div class="d-flex align-items-center gap-2.5">
        <!-- Avatar tác giả -->
        <div class="author-avatar position-relative flex-shrink-0">
          <img
            v-if="authorAvatarUrl"
            :src="authorAvatarUrl"
            :alt="authorName"
            class="rounded-circle object-fit-cover border"
            :class="isNested ? 'avatar-sm' : 'avatar-md'"
            @error="handleAvatarError"
          >
          <div
            v-else
            class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
            :class="[
              isNested ? 'avatar-sm fs-7' : 'avatar-md fs-6',
              authorRole === 'admin' ? 'bg-danger' : (authorRole === 'staff' ? 'bg-primary' : 'bg-secondary')
            ]"
          >
            {{ authorInitial }}
          </div>
        </div>

        <!-- Tên tác giả & Nhãn vai trò & Thời gian -->
        <div class="d-flex flex-column">
          <div class="d-flex align-items-center gap-1.5 flex-wrap">
            <span class="fw-bold text-dark fs-6">{{ authorName }}</span>
            <span
              v-if="authorRole === 'admin'"
              class="badge bg-danger-subtle text-danger border border-danger-subtle fs-8 py-0.5 px-1.5"
            >
              Quản trị viên
            </span>
            <span
              v-else-if="authorRole === 'staff'"
              class="badge bg-primary-subtle text-primary border border-primary-subtle fs-8 py-0.5 px-1.5"
            >
              Thủ thư
            </span>
          </div>
          <span class="text-muted fs-8">
            {{ relativeTime }}
          </span>
        </div>
      </div>

      <!-- Menu thao tác phụ: Báo cáo / Xóa -->
      <div class="dropdown">
        <button
          class="btn btn-sm btn-link text-muted p-1 rounded-circle"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          title="Tùy chọn"
        >
          <i
            class="bi bi-three-dots-vertical"
            aria-hidden="true"
          />
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3 fs-7">
          <li v-if="isOwner">
            <button
              class="dropdown-item text-danger d-flex align-items-center gap-2"
              type="button"
              @click="$emit('delete', post)"
            >
              <i
                class="bi bi-trash"
                aria-hidden="true"
              />
              <span>Xóa bài phản hồi</span>
            </button>
          </li>
          <li>
            <button
              class="dropdown-item text-secondary d-flex align-items-center gap-2"
              type="button"
              @click="$emit('report', post)"
            >
              <i
                class="bi bi-flag"
                aria-hidden="true"
              />
              <span>Báo cáo vi phạm</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Nội dung bài viết (Markdown an toàn XSS) -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="post-content text-dark mb-2.5 lh-base fs-6"
      v-html="renderedContent"
    />
    <!-- eslint-enable vue/no-v-html -->

    <!-- Thanh tương tác: Nút thích, Nút trả lời -->
    <div class="d-flex align-items-center gap-2 pt-1 pb-1">
      <!-- Nút Thích -->
      <LikeButton
        :liked="isLiked"
        :count="likeCount"
        :loading="likeLoading"
        size="sm"
        @toggle="$emit('like', post)"
      />

      <!-- Nút Trả lời (chỉ khả dụng cho bài viết cấp 1 và khi chưa khóa) -->
      <button
        v-if="canReply && !isThreadLocked"
        type="button"
        class="btn btn-sm btn-light border-0 text-secondary rounded-pill px-2.5 py-1 fs-7 d-inline-flex align-items-center gap-1 hover-primary"
        @click="$emit('reply', post)"
      >
        <i
          class="bi bi-reply-fill"
          aria-hidden="true"
        />
        <span class="fw-medium">Trả lời</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import LikeButton from './LikeButton.vue';
import { renderMarkdown } from '@/utils/markdown';
import { formatRelativeTime } from '@/utils/format';
import { cloudinaryThumb } from '@/utils/image';

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
  currentUserId: {
    type: String,
    default: null,
  },
  isThreadLocked: {
    type: Boolean,
    default: false,
  },
  isNested: {
    type: Boolean,
    default: false,
  },
  canReply: {
    type: Boolean,
    default: true,
  },
  likeLoading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['reply', 'like', 'report', 'delete']);

const avatarError = ref(false);

const authorName = computed(() => {
  const a = props.post.author;
  if (!a) return 'Thành viên';
  const name = [a.lastName, a.firstName].filter(Boolean).join(' ');
  return name || 'Thành viên';
});

const authorInitial = computed(() => {
  return (authorName.value.charAt(0) || 'U').toUpperCase();
});

const authorRole = computed(() => {
  return props.post.author?.role || 'reader';
});

const authorAvatarUrl = computed(() => {
  if (avatarError.value) return null;
  const raw = props.post.author?.avatar?.url || props.post.author?.avatar;
  if (!raw || typeof raw !== 'string') return null;
  return cloudinaryThumb(raw, 80);
});

function handleAvatarError() {
  avatarError.value = true;
}

const relativeTime = computed(() => {
  return formatRelativeTime(props.post.createdAt);
});

const renderedContent = computed(() => {
  return renderMarkdown(props.post.content);
});

const isLiked = computed(() => {
  if (!props.currentUserId || !props.post.likes) return false;
  return props.post.likes.some((id) => String(id) === String(props.currentUserId));
});

const likeCount = computed(() => {
  return Number(props.post.likeCount || props.post.likes?.length || 0);
});

const isOwner = computed(() => {
  if (!props.currentUserId || !props.post.author) return false;
  const authorId = props.post.author._id || props.post.author;
  return String(authorId) === String(props.currentUserId);
});
</script>

<style scoped>
.avatar-md {
  width: 40px;
  height: 40px;
}

.avatar-sm {
  width: 32px;
  height: 32px;
}

.fs-7 {
  font-size: 0.8125rem;
}

.fs-8 {
  font-size: 0.75rem;
}

.hover-primary:hover {
  color: #2563eb !important;
  background-color: #eff6ff !important;
}

.post-item-nested {
  background-color: #f8fafc;
}

.post-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
