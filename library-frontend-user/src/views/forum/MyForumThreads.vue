<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import forumService from '@/services/forum.service';
import Pagination from '@/components/common/Pagination.vue';
import { formatDate, formatRelativeTime } from '@/utils/format';

const router = useRouter();
const toast = useToast();
const threads = ref([]);
const loading = ref(true);
const loadError = ref(false);
const page = ref(1);
const meta = ref({ page: 1, limit: 10, total: 0, totalPages: 1 });

async function loadThreads() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await forumService.getMyThreads({ page: page.value, limit: 10 });
    threads.value = result.threads;
    meta.value = result.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
  } catch (error) {
    loadError.value = true;
    toast.error(error.response?.data?.message || 'Không thể tải bài đăng của bạn.');
    threads.value = [];
  } finally {
    loading.value = false;
  }
}

function editThread(thread) {
  router.push({ name: 'forum-new', query: { edit: thread._id } });
}

async function deleteThread(thread) {
  const result = await Swal.fire({
    title: 'Ẩn bài đăng này?',
    text: 'Bài đăng và các phản hồi sẽ không còn hiển thị công khai.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ẩn bài đăng',
    cancelButtonText: 'Quay lại',
    confirmButtonColor: '#dc3545',
  });
  if (!result.isConfirmed) return;
  try {
    await forumService.deleteThread(thread._id);
    toast.success('Đã ẩn bài đăng.');
    await loadThreads();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể ẩn bài đăng.');
  }
}

function changePage(nextPage) {
  page.value = nextPage;
  loadThreads();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(loadThreads);
</script>

<template>
  <main class="container py-4 my-forum-page">
    <nav
      aria-label="breadcrumb"
      class="mb-3"
    >
      <ol class="breadcrumb mb-0 small">
        <li class="breadcrumb-item">
          <RouterLink to="/">
            Trang chủ
          </RouterLink>
        </li>
        <li class="breadcrumb-item">
          <RouterLink to="/forum">
            Diễn đàn
          </RouterLink>
        </li>
        <li
          class="breadcrumb-item active"
          aria-current="page"
        >
          Bài đăng của tôi
        </li>
      </ol>
    </nav>

    <header class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h1 class="h3 fw-bold mb-1">
          <i
            class="bi bi-person-lines-fill text-primary me-2"
            aria-hidden="true"
          />Bài đăng của tôi
        </h1>
        <p class="text-secondary mb-0">
          Xem, chỉnh sửa hoặc ẩn các chủ đề bạn đã đăng.
        </p>
      </div>
      <RouterLink
        to="/forum/new"
        class="btn btn-primary rounded-pill px-4"
      >
        <i
          class="bi bi-plus-lg me-2"
          aria-hidden="true"
        />Đăng chủ đề mới
      </RouterLink>
    </header>

    <section
      v-if="loading"
      class="card border-0 shadow-sm p-4 text-center"
      aria-live="polite"
    >
      <span
        class="spinner-border spinner-border-sm text-primary me-2"
        role="status"
      />Đang tải bài đăng…
    </section>
    <section
      v-else-if="loadError"
      class="card border-0 shadow-sm p-5 text-center"
    >
      <i
        class="bi bi-exclamation-circle display-5 text-danger mb-3"
        aria-hidden="true"
      />
      <h2 class="h5">
        Chưa tải được bài đăng
      </h2>
      <p class="text-secondary">
        Kiểm tra kết nối rồi thử lại.
      </p>
      <div>
        <button
          type="button"
          class="btn btn-outline-primary"
          @click="loadThreads"
        >
          Thử lại
        </button>
      </div>
    </section>
    <section
      v-else-if="!threads.length"
      class="card border-0 shadow-sm p-5 text-center"
    >
      <i
        class="bi bi-chat-square-text display-5 text-secondary mb-3"
        aria-hidden="true"
      />
      <h2 class="h5">
        Bạn chưa có bài đăng nào
      </h2>
      <p class="text-secondary">
        Hãy bắt đầu một cuộc thảo luận mới trong diễn đàn.
      </p>
      <div>
        <RouterLink
          to="/forum/new"
          class="btn btn-primary"
        >
          Tạo bài đăng đầu tiên
        </RouterLink>
      </div>
    </section>
    <section
      v-else
      class="d-flex flex-column gap-3"
      aria-label="Danh sách bài đăng của tôi"
    >
      <article
        v-for="thread in threads"
        :key="thread._id"
        class="card border-0 shadow-sm"
      >
        <div class="card-body p-4">
          <div class="d-flex flex-wrap justify-content-between gap-3">
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span
                  class="badge rounded-pill"
                  :class="thread.status === 'active' ? 'text-bg-success' : 'text-bg-secondary'"
                >
                  {{ thread.status === 'active' ? 'Đang hiển thị' : 'Đã ẩn' }}
                </span>
                <span
                  v-if="thread.category?.name"
                  class="badge text-bg-light border"
                >{{ thread.category.name }}</span>
              </div>
              <h2 class="h5 fw-bold mb-2 text-break">
                <RouterLink
                  v-if="thread.status === 'active'"
                  :to="`/forum/t/${thread.slug || thread._id}`"
                  class="text-decoration-none text-dark"
                >
                  {{ thread.title }}
                </RouterLink>
                <span v-else>{{ thread.title }}</span>
              </h2>
              <p class="text-secondary mb-3 thread-preview">
                {{ (thread.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }}
              </p>
              <div class="small text-secondary d-flex flex-wrap gap-3">
                <span><i
                  class="bi bi-clock me-1"
                  aria-hidden="true"
                />{{ formatRelativeTime(thread.createdAt) }} ({{ formatDate(thread.createdAt) }})</span>
                <span><i
                  class="bi bi-chat me-1"
                  aria-hidden="true"
                />{{ thread.replyCount || 0 }} phản hồi</span>
                <span><i
                  class="bi bi-heart me-1"
                  aria-hidden="true"
                />{{ thread.likeCount || 0 }} lượt thích</span>
                <span><i
                  class="bi bi-eye me-1"
                  aria-hidden="true"
                />{{ thread.viewCount || 0 }} lượt xem</span>
              </div>
            </div>
            <div class="d-flex align-items-start gap-2 flex-shrink-0">
              <button
                v-if="thread.status === 'active'"
                type="button"
                class="btn btn-outline-primary btn-sm"
                @click="editThread(thread)"
              >
                <i
                  class="bi bi-pencil me-1"
                  aria-hidden="true"
                />Sửa
              </button>
              <button
                v-if="thread.status === 'active'"
                type="button"
                class="btn btn-outline-danger btn-sm"
                @click="deleteThread(thread)"
              >
                <i
                  class="bi bi-eye-slash me-1"
                  aria-hidden="true"
                />Ẩn
              </button>
              <RouterLink
                v-else
                to="/forum"
                class="btn btn-outline-secondary btn-sm"
              >
                Về diễn đàn
              </RouterLink>
            </div>
          </div>
        </div>
      </article>
      <Pagination
        v-if="meta.totalPages > 1"
        :page="meta.page"
        :total-pages="meta.totalPages"
        :total="meta.total"
        @update:page="changePage"
      />
    </section>
  </main>
</template>

<style scoped>
.my-forum-page { position: relative; isolation: isolate; min-height: 100vh; color: #d5e8f1; }
.my-forum-page::before {
  position: absolute;
  z-index: -1;
  inset: 0 -100vw;
  background: radial-gradient(ellipse at 50% 0%, rgb(13 61 83 / 24%), transparent 42%), #041321;
  content: '';
}
.my-forum-page :deep(.breadcrumb-item),
.my-forum-page :deep(.breadcrumb-item.active) { color: #aac1ce; }
.my-forum-page :deep(.breadcrumb-item a) { color: #61dce8; text-decoration: none; }
.my-forum-page :deep(.breadcrumb-item + .breadcrumb-item::before) { color: #648194; }
.my-forum-page :deep(.card) {
  border: 1px solid rgb(119 177 202 / 18%) !important;
  background: #081d31 !important;
  color: #d5e8f1;
  box-shadow: 0 0.5rem 1.5rem rgb(0 8 20 / 18%) !important;
}
.my-forum-page h1,
.my-forum-page h2 { color: #edf7fb; }
.my-forum-page :deep(.text-dark) { color: #edf7fb !important; }
.my-forum-page :deep(.text-secondary) { color: #9eb4c3 !important; }
.my-forum-page :deep(.text-bg-light) { border-color: rgb(119 177 202 / 22%) !important; background: #10334a !important; color: #c7dbe7 !important; }
.my-forum-page :deep(.btn-primary) { border-color: #0b91a4; background: #0b91a4; color: #fff; }
.my-forum-page :deep(.btn-primary:hover) { border-color: #16adbf; background: #16adbf; }
.my-forum-page :deep(.btn-outline-primary) { border-color: #35cddd; color: #72e5ed; }
.my-forum-page :deep(.btn-outline-primary:hover) { background: #103a50; color: #a5f3fc; }
.my-forum-page :deep(.btn-outline-danger) { border-color: #e87979; color: #ffaaaa; }
.my-forum-page :deep(.btn-outline-danger:hover) { background: #51252e; color: #ffe4e4; }
.my-forum-page :deep(.btn-outline-secondary) { border-color: rgb(119 177 202 / 32%); color: #b9cfdb; }
.my-forum-page :deep(.btn-outline-secondary:hover) { background: #10334a; color: #edf7fb; }
.my-forum-page :deep(.page-link) { border-color: rgb(119 177 202 / 20%); background: #081d31; color: #b9cfdb; }
.my-forum-page :deep(.page-item.active .page-link) { border-color: #20bfd0; background: #0d8299; color: #fff; }
.my-forum-page :deep(.page-item.disabled .page-link) { background: #06172a; color: #60798a; }
.my-forum-page :deep(.text-bg-success) { background: #15553f !important; color: #9af0c0 !important; }
.my-forum-page :deep(.text-bg-secondary) { background: #334b5d !important; color: #d5e8f1 !important; }

.thread-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
