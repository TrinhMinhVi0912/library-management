<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth.store';
import forumService from '@/services/forum.service';
import { formatDate, formatRelativeTime } from '@/utils/format';
import { cloudinaryThumb } from '@/utils/image';

const props = defineProps({
  thread: {
    type: Object,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  showCategory: {
    type: Boolean,
    default: true,
  },
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();

const isLiking = ref(false);
const isLiked = ref(
  Boolean(
    authStore.user?._id
    && Array.isArray(props.thread.likes)
    && props.thread.likes.some((id) => String(id) === String(authStore.user._id))
  )
);
const likeCount = ref(props.thread.likeCount || 0);

watch(
  () => props.thread.likeCount,
  (newVal) => {
    likeCount.value = newVal || 0;
  }
);

watch(
  () => props.thread.likes,
  (newLikes) => {
    if (authStore.user?._id && Array.isArray(newLikes)) {
      isLiked.value = newLikes.some((id) => String(id) === String(authStore.user._id));
    }
  }
);

const authorName = computed(() => {
  const author = props.thread.author;
  if (!author) return 'Thành viên ẩn danh';
  return [author.firstName, author.lastName].filter(Boolean).join(' ') || 'Độc giả';
});

const authorAvatar = computed(() => props.thread.author?.avatar?.url || null);

const authorInitials = computed(() => {
  const parts = authorName.value.split(/\s+/).filter(Boolean);
  return parts.slice(-2).map((p) => p[0]).join('').toLocaleUpperCase('vi-VN') || 'DG';
});

const isStaffOrAdmin = computed(() => {
  return ['staff', 'admin'].includes(props.thread.author?.role);
});

const roleLabel = computed(() => {
  if (props.thread.author?.role === 'admin') return 'Quản trị viên';
  if (props.thread.author?.role === 'staff') return 'Thủ thư';
  return null;
});

const bookCover = computed(() => {
  if (!props.thread.book?.cover) return null;
  return cloudinaryThumb(props.thread.book.cover?.url || props.thread.book.cover, 120);
});

const contentPreview = computed(() => (props.thread.content || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[#*_`~>()!]/g, ' ')
  .replaceAll('[', ' ')
  .replaceAll(']', ' ')
  .replace(/\s+/g, ' ')
  .trim());

async function handleToggleLike() {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để thích bài viết.');
    router.push({
      name: 'login',
      query: { redirect: route.fullPath },
    });
    return;
  }

  if (isLiking.value) return;
  isLiking.value = true;
  try {
    const res = await forumService.toggleThreadLike(props.thread._id);
    if (res) {
      isLiked.value = res.liked;
      likeCount.value = res.likeCount;
      if (res.liked) {
        toast.success('Đã thích chủ đề!');
      }
    }
  } catch (err) {
    const message = err.response?.data?.message || 'Không thể cập nhật lượt thích.';
    toast.error(message);
  } finally {
    isLiking.value = false;
  }
}
</script>

<template>
  <article
    class="thread-item p-3 p-md-3.5 rounded-3 border bg-white transition shadow-sm mb-3"
    :class="{ 'is-pinned': thread.pinned, 'is-compact': compact }"
  >
    <div class="thread-item-layout d-flex flex-column flex-sm-row align-items-start gap-3">
      <!-- Author Avatar -->
      <div class="author-avatar-wrap flex-shrink-0 d-none d-sm-block">
        <img
          v-if="authorAvatar"
          :src="authorAvatar"
          :alt="authorName"
          class="rounded-circle avatar-img shadow-xs"
          loading="lazy"
        >
        <div
          v-else
          class="rounded-circle avatar-fallback bg-light text-primary fw-bold border"
        >
          {{ authorInitials }}
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="thread-main flex-grow-1 overflow-hidden">
        <!-- Badges & Category Header -->
        <div class="d-flex flex-wrap align-items-center gap-1.5 mb-1.5">
          <span
            v-if="thread.pinned"
            class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fs-xs d-inline-flex align-items-center gap-1 px-2 py-1"
          >
            <i
              class="bi bi-pin-angle-fill"
              aria-hidden="true"
            />
            <span>Đã ghim</span>
          </span>

          <span
            v-if="thread.locked"
            class="badge bg-secondary-subtle text-secondary border fs-xs d-inline-flex align-items-center gap-1 px-2 py-1"
          >
            <i
              class="bi bi-lock-fill"
              aria-hidden="true"
            />
            <span>Đã khóa</span>
          </span>

          <RouterLink
            v-if="showCategory && thread.category"
            :to="{ name: 'forum-category', params: { slug: thread.category.slug || thread.category._id } }"
            class="badge bg-light text-dark text-decoration-none border fs-xs category-badge hover-primary px-2 py-1"
          >
            {{ thread.category.name }}
          </RouterLink>

          <!-- Tags -->
          <span
            v-for="tag in thread.tags"
            :key="tag"
            class="badge bg-light text-muted border-0 fs-xs"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- Thread Title -->
        <h3 class="thread-title mb-2 fs-base fw-bold">
          <RouterLink
            :to="{ name: 'forum-thread', params: { slug: thread.slug || thread._id } }"
            class="text-dark text-decoration-none thread-link"
          >
            {{ thread.title }}
          </RouterLink>
        </h3>

        <p
          v-if="compact && contentPreview"
          class="thread-preview text-secondary mb-2"
        >
          {{ contentPreview }}
        </p>

        <!-- Associated Book Snippet (if any) -->
        <div
          v-if="thread.book && !compact"
          class="associated-book-pill d-inline-flex align-items-center gap-2 p-1.5 pe-3 rounded-3 bg-light border mb-2 text-decoration-none"
        >
          <img
            v-if="bookCover"
            :src="bookCover"
            :alt="thread.book.title"
            class="book-thumb rounded"
            loading="lazy"
          >
          <i
            v-else
            class="bi bi-book text-muted ms-1"
            aria-hidden="true"
          />
          <RouterLink
            :to="{ name: 'book-detail', params: { slug: thread.book.slug || thread.book._id } }"
            class="fs-xs text-secondary text-truncate text-decoration-none hover-primary fw-medium"
            :title="`Xem sách: ${thread.book.title}`"
          >
            Sách liên quan: <strong>{{ thread.book.title }}</strong>
          </RouterLink>
        </div>

        <!-- Author Name, Role & Relative Time -->
        <div class="d-flex flex-wrap align-items-center gap-2 fs-xs thread-meta mt-1">
          <span class="fw-medium d-inline-flex align-items-center gap-1.5 thread-author-name">
            <span>{{ authorName }}</span>
            <span
              v-if="isStaffOrAdmin"
              class="badge bg-primary-subtle text-primary border border-primary-subtle fs-2xs"
            >
              {{ roleLabel }}
            </span>
          </span>
          <span class="text-muted">•</span>
          <span :title="formatDate(thread.createdAt)">{{ formatRelativeTime(thread.createdAt) }}</span>
          <template v-if="thread.lastReplyAt && thread.replyCount > 0 && !compact">
            <span class="text-muted d-none d-md-inline">•</span>
            <span
              class="d-none d-md-inline text-muted"
              :title="formatDate(thread.lastReplyAt)"
            >
              Phản hồi gần nhất {{ formatRelativeTime(thread.lastReplyAt) }}
            </span>
          </template>
        </div>
      </div>

      <!-- Thread Statistics / Interactive Action Controls (To rõ ràng & Hiện đại) -->
      <div class="thread-interactions">
        <!-- Nút phản hồi (Reply button) -->
        <RouterLink
          :to="{ name: 'forum-thread', params: { slug: thread.slug || thread._id } }"
          class="interaction-btn reply-btn text-decoration-none"
          title="Xem thảo luận và gửi phản hồi"
          :aria-label="`${thread.replyCount || 0} phản hồi`"
        >
          <i
            class="bi bi-chat-text-fill icon-stat"
            aria-hidden="true"
          />
          <span class="count-stat">{{ thread.replyCount || 0 }}</span>
        </RouterLink>

        <!-- Nút thích (Like button) -->
        <button
          type="button"
          class="btn interaction-btn like-btn border-0"
          :class="{ 'is-liked': isLiked }"
          :disabled="isLiking"
          :title="isLiked ? 'Đã thích chủ đề này' : 'Bấm để thích chủ đề'"
          :aria-label="`${likeCount} lượt thích`"
          @click.stop="handleToggleLike"
        >
          <i
            :class="[isLiked ? 'bi bi-heart-fill' : 'bi bi-heart', 'icon-stat']"
            aria-hidden="true"
          />
          <span class="count-stat">{{ likeCount }}</span>
        </button>

        <!-- Huy hiệu lượt xem (View count badge) -->
        <div
          class="interaction-badge view-badge"
          title="Lượt xem chủ đề"
          :aria-label="`${thread.viewCount || 0} lượt xem`"
        >
          <i
            class="bi bi-eye-fill icon-stat"
            aria-hidden="true"
          />
          <span class="count-stat">{{ thread.viewCount || 0 }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.thread-item {
  transition: border-color 140ms ease;
  border-color: #e5e7eb;
  color: #111827;
}

.thread-item-layout {
  width: 100%;
  min-width: 0;
}

.thread-main {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}

.thread-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.thread-item:hover {
  border-color: #2563eb;
}

.thread-item.is-pinned {
  border-left: 4px solid #f59e0b;
  background-color: #ffffff;
}

.avatar-img,
.avatar-fallback {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
}

.avatar-fallback {
  display: grid;
  place-items: center;
  font-size: 0.95rem;
}

.thread-title {
  font-size: 1.0625rem;
  line-height: 1.45;
  color: #111827;
}

.thread-link {
  transition: color 140ms ease;
  color: #111827;
}

.thread-link:hover {
  color: #2563eb !important;
}

.category-badge {
  transition: background-color 140ms ease, color 140ms ease;
}

.category-badge:hover {
  background-color: #eff6ff;
  color: #2563eb !important;
}

.book-thumb {
  width: 1.625rem;
  height: 2.25rem;
  object-fit: cover;
}

.associated-book-pill {
  max-width: 100%;
}

.fs-2xs {
  font-size: 0.6875rem;
}

.fs-xs {
  font-size: 0.75rem;
}

.fs-base {
  font-size: 1.0625rem;
}

.hover-primary:hover {
  color: #2563eb !important;
}

.thread-meta {
  color: #6b7280;
}

.thread-author-name {
  color: #111827;
}

/* Các nút và badge tương tác to rõ, bắt mắt */
.thread-interactions {
  display: flex;
  flex: 0 0 auto;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  gap: 0.5rem;
  border-top: 1px solid #e5e7eb;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}

.interaction-btn,
.interaction-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 4.5rem;
  height: 2.375rem;
  padding: 0.35rem 0.75rem;
  border-radius: 0.625rem;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1;
  transition: all 160ms cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
}

.icon-stat {
  font-size: 1.15rem;
  line-height: 1;
}

.count-stat {
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* Nút phản hồi (Reply) */
.reply-btn {
  background-color: #f0f7ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
}

.reply-btn:hover {
  background-color: #2563eb;
  border-color: #2563eb;
  color: #ffffff !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgb(37 99 235 / 20%);
}

/* Nút Thích (Like) */
.like-btn {
  background-color: #fef2f2;
  border: 1px solid #fecaca !important;
  color: #dc2626;
}

.like-btn:hover {
  background-color: #ef4444;
  border-color: #ef4444 !important;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgb(239 68 68 / 20%);
}

.like-btn.is-liked {
  background-color: #dc2626;
  border-color: #dc2626 !important;
  color: #ffffff;
  box-shadow: 0 2px 6px rgb(220 38 38 / 30%);
}

.like-btn.is-liked:hover {
  background-color: #b91c1c;
  border-color: #b91c1c !important;
}

/* Badge Lượt xem (View) */
.view-badge {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  cursor: default;
}

@media (min-width: 576px) {
  .border-top-sm-0 {
    border-top: 0 !important;
  }

  .thread-interactions {
    flex: 0 0 5rem;
    flex-direction: column;
    width: 5rem;
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
  }

  .interaction-btn,
  .interaction-badge {
    width: 5rem;
    justify-content: flex-start;
    padding-left: 0.85rem;
  }
}

@media (max-width: 575.98px) {
  .thread-main {
    width: 100%;
  }

  .thread-interactions {
    flex-direction: row;
    width: 100%;
    flex: 0 0 auto;
    justify-content: flex-start;
    border-top: 1px solid #e5e7eb;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
  }

  .interaction-btn,
  .interaction-badge {
    flex: 1;
    min-width: 0;
  }
}
</style>
