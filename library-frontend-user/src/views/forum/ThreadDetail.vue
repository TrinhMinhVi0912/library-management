<template>
  <div class="thread-detail-page py-4 bg-light min-vh-100">
    <div class="container">
      <!-- Loading Skeleton -->
      <div
        v-if="loading"
        class="py-4"
      >
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
          <div class="placeholder-glow">
            <div class="placeholder col-3 mb-3" />
            <div class="placeholder col-8 mb-4 h3" />
            <div class="d-flex align-items-center gap-3 mb-4">
              <div
                class="placeholder rounded-circle"
                style="width: 44px; height: 44px;"
              />
              <div class="col-4">
                <div class="placeholder col-6 mb-1" />
                <div class="placeholder col-4" />
              </div>
            </div>
            <div class="placeholder col-12 mb-2" />
            <div class="placeholder col-10 mb-2" />
            <div class="placeholder col-7 mb-4" />
          </div>
        </div>
      </div>

      <!-- Lỗi không tìm thấy chủ đề hoặc lỗi mạng -->
      <div
        v-else-if="error"
        class="py-5 text-center"
      >
        <div
          class="card border-0 shadow-sm rounded-4 p-5 mx-auto"
          style="max-width: 500px;"
        >
          <div class="display-1 text-muted mb-3">
            <i
              class="bi bi-chat-square-quote"
              aria-hidden="true"
            />
          </div>
          <h2 class="h4 fw-bold text-dark mb-2">
            Không tìm thấy chủ đề
          </h2>
          <p class="text-secondary mb-4">
            {{ error || 'Chủ đề này không tồn tại hoặc đã bị ẩn bởi ban quản trị.' }}
          </p>
          <div class="d-flex justify-content-center gap-2">
            <RouterLink
              to="/forum"
              class="btn btn-primary rounded-pill px-4"
            >
              <i
                class="bi bi-arrow-left me-1"
                aria-hidden="true"
              />
              Về diễn đàn
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Nội dung chi tiết chủ đề -->
      <div
        v-else-if="thread"
        class="row g-4"
      >
        <!-- Cột chính: Nội dung bài viết gốc & danh sách bình luận -->
        <div class="col-lg-8">
          <!-- Breadcrumb điều hướng -->
          <nav
            aria-label="breadcrumb"
            class="mb-3"
          >
            <ol class="breadcrumb mb-0 small">
              <li class="breadcrumb-item">
                <RouterLink
                  to="/"
                  class="text-decoration-none text-secondary"
                >
                  Trang chủ
                </RouterLink>
              </li>
              <li class="breadcrumb-item">
                <RouterLink
                  to="/forum"
                  class="text-decoration-none text-secondary"
                >
                  Diễn đàn
                </RouterLink>
              </li>
              <li
                v-if="thread.category"
                class="breadcrumb-item"
              >
                <RouterLink
                  :to="`/forum/c/${thread.category.slug}`"
                  class="text-decoration-none text-secondary"
                >
                  {{ thread.category.name }}
                </RouterLink>
              </li>
              <li
                class="breadcrumb-item active text-truncate text-dark fw-medium"
                style="max-width: 250px;"
                aria-current="page"
              >
                {{ thread.title }}
              </li>
            </ol>
          </nav>

          <!-- Thẻ Bài viết gốc (Original Post) -->
          <article class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
            <div class="card-body p-4">
              <!-- Nhãn chuyên mục, ghim, khóa -->
              <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                <RouterLink
                  v-if="thread.category"
                  :to="`/forum/c/${thread.category.slug}`"
                  class="badge bg-primary-subtle text-primary text-decoration-none px-2.5 py-1.5 rounded-pill fw-medium"
                >
                  <i
                    class="bi bi-folder2-open me-1"
                    aria-hidden="true"
                  />
                  {{ thread.category.name }}
                </RouterLink>
                <span
                  v-if="thread.pinned"
                  class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1.5 rounded-pill fw-medium"
                >
                  <i
                    class="bi bi-pin-angle-fill me-1"
                    aria-hidden="true"
                  />
                  Đã ghim
                </span>
                <span
                  v-if="thread.locked"
                  class="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1.5 rounded-pill fw-medium"
                >
                  <i
                    class="bi bi-lock-fill me-1"
                    aria-hidden="true"
                  />
                  Đã khóa bình luận
                </span>
              </div>

              <!-- Tiêu đề chủ đề -->
              <h1 class="h3 fw-bold text-dark lh-sm mb-3">
                {{ thread.title }}
              </h1>

              <!-- Thông tin tác giả & Thống kê lượt xem -->
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
                <div class="d-flex align-items-center gap-2.5">
                  <!-- Avatar tác giả -->
                  <div class="flex-shrink-0">
                    <img
                      v-if="authorAvatarUrl"
                      :src="authorAvatarUrl"
                      :alt="authorName"
                      class="rounded-circle object-fit-cover border"
                      style="width: 44px; height: 44px;"
                      @error="authorAvatarFailed = true"
                    >
                    <div
                      v-else
                      class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
                      :class="authorRole === 'admin' ? 'bg-danger' : (authorRole === 'staff' ? 'bg-primary' : 'bg-secondary')"
                      style="width: 44px; height: 44px; font-size: 1.1rem;"
                    >
                      {{ authorInitial }}
                    </div>
                  </div>

                  <!-- Tên và ngày đăng -->
                  <div class="d-flex flex-column">
                    <div class="d-flex align-items-center gap-2">
                      <span class="fw-bold text-dark">{{ authorName }}</span>
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
                    <span class="text-muted small">
                      Đăng {{ formatDate(thread.createdAt) }}
                    </span>
                  </div>
                </div>

                <!-- Thống kê tương tác -->
                <div class="d-flex align-items-center gap-3 text-secondary small">
                  <span
                    title="Lượt xem"
                    class="d-flex align-items-center gap-1"
                  >
                    <i
                      class="bi bi-eye"
                      aria-hidden="true"
                    />
                    <span>{{ thread.viewCount || 0 }}</span>
                  </span>
                  <span
                    title="Lượt phản hồi"
                    class="d-flex align-items-center gap-1"
                  >
                    <i
                      class="bi bi-chat-dots"
                      aria-hidden="true"
                    />
                    <span>{{ thread.replyCount || 0 }}</span>
                  </span>
                </div>
              </div>

              <!-- Nội dung bài viết gốc (Render an toàn, chống XSS) -->
              <!-- eslint-disable vue/no-v-html -->
              <div
                class="thread-body fs-6 text-dark lh-base mb-4"
                v-html="renderedThreadContent"
              />
              <!-- eslint-enable vue/no-v-html -->

              <!-- Thẻ sách liên quan (nếu có) -->
              <div
                v-if="thread.book"
                class="card border bg-light-subtle rounded-3 p-3 mb-4"
              >
                <div class="d-flex align-items-center gap-3">
                  <RouterLink
                    :to="`/books/${thread.book.slug || thread.book._id}`"
                    class="flex-shrink-0"
                  >
                    <img
                      :src="bookCoverUrl"
                      :alt="thread.book.title"
                      class="rounded shadow-xs object-fit-cover border"
                      style="width: 52px; height: 74px;"
                    >
                  </RouterLink>
                  <div class="flex-grow-1 min-w-0">
                    <div class="small text-muted mb-0.5">
                      <i
                        class="bi bi-book-half me-1"
                        aria-hidden="true"
                      />
                      Sách được nhắc đến trong chủ đề
                    </div>
                    <RouterLink
                      :to="`/books/${thread.book.slug || thread.book._id}`"
                      class="fw-bold text-dark text-decoration-none d-block text-truncate hover-primary"
                    >
                      {{ thread.book.title }}
                    </RouterLink>
                    <RouterLink
                      :to="`/books/${thread.book.slug || thread.book._id}`"
                      class="btn btn-sm btn-outline-primary py-0.5 px-2.5 rounded-pill fs-8 mt-1.5 d-inline-flex align-items-center gap-1"
                    >
                      <span>Xem sách</span>
                      <i
                        class="bi bi-arrow-right"
                        aria-hidden="true"
                      />
                    </RouterLink>
                  </div>
                </div>
              </div>

              <!-- Thẻ tag hashtags -->
              <div
                v-if="thread.tags && thread.tags.length"
                class="d-flex flex-wrap gap-1.5 mb-4"
              >
                <span
                  v-for="tag in thread.tags"
                  :key="tag"
                  class="badge bg-light text-secondary border fw-normal py-1 px-2 rounded-pill small"
                >
                  #{{ tag }}
                </span>
              </div>

              <!-- Thanh tương tác bài gốc: Thích & Báo cáo -->
              <div class="d-flex align-items-center justify-content-between pt-3 border-top">
                <LikeButton
                  :liked="isThreadLiked"
                  :count="threadLikeCount"
                  :loading="likeThreadLoading"
                  @toggle="handleToggleThreadLike"
                />

                <div class="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary rounded-pill px-3 d-inline-flex align-items-center gap-1.5"
                    @click="openReportModal('thread', thread._id, thread.title)"
                  >
                    <i
                      class="bi bi-flag"
                      aria-hidden="true"
                    />
                    <span>Báo cáo</span>
                  </button>
                </div>
              </div>
            </div>
          </article>

          <!-- Banner thông báo khi chủ đề bị khóa -->
          <div
            v-if="thread.locked"
            class="alert alert-warning border-warning-subtle d-flex align-items-center gap-3 p-3 rounded-4 shadow-sm mb-4"
          >
            <div
              class="rounded-circle bg-warning text-white p-2 d-flex align-items-center justify-content-center"
              style="width: 40px; height: 40px;"
            >
              <i
                class="bi bi-lock-fill fs-5"
                aria-hidden="true"
              />
            </div>
            <div>
              <div class="fw-bold text-dark">
                Chủ đề này đã bị khóa
              </div>
              <div class="small text-secondary">
                Người điều hành đã khóa chủ đề này. Các thành viên không thể gửi thêm phản hồi mới.
              </div>
            </div>
          </div>

          <!-- Danh sách các bài phản hồi -->
          <section class="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
            <div class="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
              <h2 class="h5 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <span>Phản hồi</span>
                <span class="badge bg-secondary-subtle text-secondary rounded-pill fs-7">
                  {{ thread.replyCount || posts.length }}
                </span>
              </h2>
            </div>

            <!-- Trạng thái tải bài phản hồi -->
            <div
              v-if="loadingPosts"
              class="py-4 text-center text-muted"
            >
              <div
                class="spinner-border spinner-border-sm text-primary me-2"
                role="status"
              />
              <span>Đang tải các phản hồi...</span>
            </div>

            <!-- Trạng thái chưa có phản hồi nào -->
            <div
              v-else-if="!posts.length"
              class="py-4 text-center text-muted"
            >
              <i
                class="bi bi-chat-dots display-6 text-black-50 mb-2 d-block"
                aria-hidden="true"
              />
              <p class="mb-1 fw-medium text-dark">
                Chưa có phản hồi nào
              </p>
              <p class="small text-secondary mb-0">
                Hãy là người đầu tiên chia sẻ cảm nhận hoặc trả lời chủ đề này!
              </p>
            </div>

            <!-- Cây phản hồi 1 cấp -->
            <div
              v-else
              class="post-list"
            >
              <div
                v-for="rootPost in rootPosts"
                :key="rootPost._id"
                class="root-post-group"
              >
                <!-- Bài phản hồi gốc (cấp 1) -->
                <PostItem
                  :post="rootPost"
                  :current-user-id="authStore.user?._id"
                  :is-thread-locked="thread.locked"
                  :can-reply="true"
                  :like-loading="postLikeLoadingId === rootPost._id"
                  @reply="handleStartReply"
                  @like="handleTogglePostLike"
                  @report="handleReportPost"
                  @delete="handleDeletePost"
                />

                <!-- Các bài trả lời lồng (cấp 2) -->
                <template v-if="repliesMap[rootPost._id]?.length">
                  <PostItem
                    v-for="replyPost in repliesMap[rootPost._id]"
                    :key="replyPost._id"
                    :post="replyPost"
                    :current-user-id="authStore.user?._id"
                    :is-thread-locked="thread.locked"
                    :is-nested="true"
                    :can-reply="false"
                    :like-loading="postLikeLoadingId === replyPost._id"
                    @like="handleTogglePostLike"
                    @report="handleReportPost"
                    @delete="handleDeletePost"
                  />
                </template>
              </div>
            </div>
          </section>

          <!-- Khung soạn thảo phản hồi mới -->
          <div ref="editorSectionRef">
            <div
              v-if="!authStore.isAuthenticated"
              class="card border-0 shadow-sm rounded-4 p-4 text-center bg-white"
            >
              <div class="mb-2">
                <i
                  class="bi bi-box-arrow-in-right fs-1 text-primary"
                  aria-hidden="true"
                />
              </div>
              <h3 class="h6 fw-bold text-dark mb-1">
                Đăng nhập để tham gia thảo luận
              </h3>
              <p class="small text-muted mb-3">
                Bạn cần có tài khoản độc giả thư viện để gửi bài viết hoặc trả lời thảo luận.
              </p>
              <div>
                <RouterLink
                  :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`"
                  class="btn btn-primary btn-sm rounded-pill px-4 fw-medium"
                >
                  Đăng nhập ngay
                </RouterLink>
              </div>
            </div>

            <PostEditor
              v-else
              ref="postEditorRef"
              :replying-to="replyingTo"
              :submitting="submittingPost"
              :disabled="thread.locked"
              disabled-message="Chủ đề này đã bị khóa. Không thể gửi thêm phản hồi mới."
              @submit="handleSubmitPost"
              @cancel-reply="replyingTo = null"
            />
          </div>
        </div>

        <!-- Cột phụ: Tác giả & Quy tắc diễn đàn -->
        <div class="col-lg-4">
          <!-- Card tác giả chủ đề -->
          <div class="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <h3 class="h6 fw-bold text-dark text-uppercase tracking-wider fs-8 mb-3">
              Về tác giả
            </h3>
            <div class="d-flex align-items-center gap-3">
              <img
                v-if="authorAvatarUrl"
                :src="authorAvatarUrl"
                :alt="authorName"
                class="rounded-circle object-fit-cover border"
                style="width: 52px; height: 52px;"
                @error="authorAvatarFailed = true"
              >
              <div
                v-else
                class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
                :class="authorRole === 'admin' ? 'bg-danger' : (authorRole === 'staff' ? 'bg-primary' : 'bg-secondary')"
                style="width: 52px; height: 52px; font-size: 1.25rem;"
              >
                {{ authorInitial }}
              </div>

              <div>
                <div class="fw-bold text-dark fs-6">
                  {{ authorName }}
                </div>
                <div class="text-muted small">
                  {{ authorRole === 'admin' ? 'Quản trị viên diễn đàn' : (authorRole === 'staff' ? 'Thủ thư thư viện' : 'Độc giả thư viện') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Card Văn hóa thảo luận văn minh -->
          <div class="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i
                class="bi bi-shield-check text-primary fs-5"
                aria-hidden="true"
              />
              <h3 class="h6 fw-bold text-dark mb-0">
                Nội quy thảo luận
              </h3>
            </div>
            <ul class="list-unstyled small text-secondary mb-0 d-flex flex-column gap-2 mt-2">
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-success mt-0.5"
                  aria-hidden="true"
                />
                <span>Giữ thái độ lịch sự, tôn trọng các góc nhìn khác nhau.</span>
              </li>
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-success mt-0.5"
                  aria-hidden="true"
                />
                <span>Không đăng tải thông tin quảng cáo, spam hoặc link độc hại.</span>
              </li>
              <li class="d-flex align-items-start gap-2">
                <i
                  class="bi bi-check2 text-success mt-0.5"
                  aria-hidden="true"
                />
                <span>Nếu phát hiện nội dung tiêu cực, vui lòng bấm Báo cáo vi phạm.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Báo cáo vi phạm -->
    <ReportModal
      v-model="showReportModal"
      :target-type="reportTargetType"
      :target-id="reportTargetId"
      :target-title="reportTargetTitle"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/auth.store';
import forumService from '@/services/forum.service';
import PostItem from '@/components/forum/PostItem.vue';
import PostEditor from '@/components/forum/PostEditor.vue';
import LikeButton from '@/components/forum/LikeButton.vue';
import ReportModal from '@/components/forum/ReportModal.vue';
import { renderMarkdown } from '@/utils/markdown';
import { formatDate } from '@/utils/format';
import { cloudinaryThumb } from '@/utils/image';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const thread = ref(null);
const posts = ref([]);
const loading = ref(true);
const loadingPosts = ref(false);
const error = ref(null);

const authorAvatarFailed = ref(false);
const likeThreadLoading = ref(false);
const postLikeLoadingId = ref(null);
const submittingPost = ref(false);
const replyingTo = ref(null);

const editorSectionRef = ref(null);
const postEditorRef = ref(null);

// Modal báo cáo
const showReportModal = ref(false);
const reportTargetType = ref('thread');
const reportTargetId = ref('');
const reportTargetTitle = ref('');

const authorName = computed(() => {
  const a = thread.value?.author;
  if (!a) return 'Thành viên';
  return [a.lastName, a.firstName].filter(Boolean).join(' ') || 'Thành viên';
});

const authorInitial = computed(() => {
  return (authorName.value.charAt(0) || 'U').toUpperCase();
});

const authorRole = computed(() => {
  return thread.value?.author?.role || 'reader';
});

const authorAvatarUrl = computed(() => {
  if (authorAvatarFailed.value) return null;
  const raw = thread.value?.author?.avatar?.url || thread.value?.author?.avatar;
  if (!raw || typeof raw !== 'string') return null;
  return cloudinaryThumb(raw, 100);
});

const bookCoverUrl = computed(() => {
  const raw = thread.value?.book?.cover?.url || thread.value?.book?.cover;
  if (!raw || typeof raw !== 'string') return '';
  return cloudinaryThumb(raw, 160);
});

const renderedThreadContent = computed(() => {
  return renderMarkdown(thread.value?.content);
});

const isThreadLiked = computed(() => {
  const uid = authStore.user?._id;
  if (!uid || !thread.value?.likes) return false;
  return thread.value.likes.some((id) => String(id) === String(uid));
});

const threadLikeCount = computed(() => {
  return Number(thread.value?.likeCount || thread.value?.likes?.length || 0);
});

// Phân cấp danh sách bài viết (1 cấp)
const rootPosts = computed(() => {
  return posts.value.filter((p) => !p.parent);
});

const repliesMap = computed(() => {
  const map = {};
  posts.value.forEach((p) => {
    if (p.parent) {
      const parentId = typeof p.parent === 'object' ? p.parent._id : p.parent;
      if (!map[parentId]) map[parentId] = [];
      map[parentId].push(p);
    }
  });
  return map;
});

async function loadThreadDetail() {
  const slugOrId = route.params.slug;
  if (!slugOrId) {
    router.replace({ name: 'not-found' });
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await forumService.getThread(slugOrId);
    if (!data) {
      error.value = 'Chủ đề không tồn tại';
      return;
    }
    thread.value = data;
    document.title = `${data.title} | Diễn đàn thư viện`;

    // Tải danh sách bài phản hồi
    await loadPosts(data._id);
  } catch (err) {
    if (err?.response?.status === 404) {
      error.value = 'Chủ đề không tồn tại hoặc đã bị gỡ.';
    } else {
      error.value = err?.response?.data?.message || err?.message || 'Không thể tải chủ đề';
    }
  } finally {
    loading.value = false;
  }
}

async function loadPosts(threadId) {
  loadingPosts.value = true;
  try {
    const res = await forumService.getPosts(threadId, { limit: 100 });
    posts.value = res.posts || [];
  } catch (err) {
    toast.error('Không thể tải các bài phản hồi: ' + (err?.response?.data?.message || err?.message));
  } finally {
    loadingPosts.value = false;
  }
}

async function handleToggleThreadLike() {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để thích chủ đề');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  if (likeThreadLoading.value || !thread.value) return;
  likeThreadLoading.value = true;

  try {
    const res = await forumService.toggleThreadLike(thread.value._id);
    const userId = authStore.user._id;

    if (!Array.isArray(thread.value.likes)) {
      thread.value.likes = [];
    }

    if (res.liked) {
      if (!thread.value.likes.includes(userId)) {
        thread.value.likes.push(userId);
      }
    } else {
      thread.value.likes = thread.value.likes.filter((id) => String(id) !== String(userId));
    }
    thread.value.likeCount = res.likeCount;
  } catch (err) {
    toast.error('Không thể cập nhật lượt thích: ' + (err?.response?.data?.message || err?.message));
  } finally {
    likeThreadLoading.value = false;
  }
}

function handleStartReply(post) {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để gửi phản hồi');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  replyingTo.value = post;
  nextTick(() => {
    editorSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    postEditorRef.value?.focus();
  });
}

async function handleSubmitPost({ content }) {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để gửi phản hồi');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  if (submittingPost.value || !thread.value) return;
  submittingPost.value = true;

  const payload = {
    content,
    parent: replyingTo.value ? replyingTo.value._id : null,
  };

  try {
    const newPost = await forumService.createPost(thread.value._id, payload);

    // Gắn thông tin author từ authStore cho post mới tạo để hiển thị ngay
    newPost.author = {
      _id: authStore.user._id,
      firstName: authStore.user.firstName,
      lastName: authStore.user.lastName,
      avatar: authStore.user.avatar,
      role: authStore.user.role,
    };
    newPost.likes = [];
    newPost.likeCount = 0;

    posts.value.push(newPost);
    thread.value.replyCount = (thread.value.replyCount || 0) + 1;

    toast.success('Đã gửi phản hồi thành công');
    postEditorRef.value?.clear();
    replyingTo.value = null;
  } catch (err) {
    toast.error(err?.response?.data?.message || err?.message || 'Không thể gửi phản hồi');
  } finally {
    submittingPost.value = false;
  }
}

async function handleTogglePostLike(post) {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để thích bài viết');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  if (postLikeLoadingId.value) return;
  postLikeLoadingId.value = post._id;

  try {
    const res = await forumService.togglePostLike(post._id);
    const userId = authStore.user._id;

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    if (res.liked) {
      if (!post.likes.includes(userId)) post.likes.push(userId);
    } else {
      post.likes = post.likes.filter((id) => String(id) !== String(userId));
    }
    post.likeCount = res.likeCount;
  } catch (err) {
    toast.error('Không thể cập nhật lượt thích: ' + (err?.response?.data?.message || err?.message));
  } finally {
    postLikeLoadingId.value = null;
  }
}

function openReportModal(targetType, targetId, title) {
  if (!authStore.isAuthenticated) {
    toast.info('Vui lòng đăng nhập để báo cáo vi phạm');
    router.push({ name: 'login', query: { redirect: route.fullPath } });
    return;
  }

  reportTargetType.value = targetType;
  reportTargetId.value = targetId;
  reportTargetTitle.value = title || '';
  showReportModal.value = true;
}

function handleReportPost(post) {
  const author = [post.author?.lastName, post.author?.firstName].filter(Boolean).join(' ');
  openReportModal('post', post._id, `Bài phản hồi của ${author || 'thành viên'}`);
}

async function handleDeletePost(post) {
  const confirmResult = await Swal.fire({
    title: 'Xóa bài phản hồi?',
    text: 'Bạn có chắc chắn muốn xóa bài phản hồi này? Thao tác này không thể hoàn tác.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Đồng ý xóa',
    cancelButtonText: 'Hủy',
  });

  if (!confirmResult.isConfirmed) return;

  try {
    await forumService.deletePost(post._id);
    // Loại bỏ bài viết khỏi danh sách hiện tại
    posts.value = posts.value.filter((p) => p._id !== post._id && p.parent?._id !== post._id && p.parent !== post._id);
    if (thread.value.replyCount > 0) {
      thread.value.replyCount -= 1;
    }
    toast.success('Đã xóa bài phản hồi');
  } catch (err) {
    toast.error(err?.response?.data?.message || err?.message || 'Không thể xóa bài phản hồi');
  }
}

watch(
  () => route.params.slug,
  (newSlug) => {
    if (newSlug) {
      loadThreadDetail();
    }
  }
);

onMounted(() => {
  loadThreadDetail();
});
</script>

<style scoped>
.hover-primary:hover {
  color: #2563eb !important;
}

.fs-7 {
  font-size: 0.8125rem;
}

.fs-8 {
  font-size: 0.75rem;
}

.shadow-xs {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.thread-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.thread-body :deep(blockquote) {
  font-style: italic;
  color: #4b5563;
}
</style>
