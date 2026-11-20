<script setup>
import { onMounted, ref } from 'vue';
import Swal from 'sweetalert2';
import { useToast } from 'vue-toastification';
import { getAdminForumModeration, reviewAdminForumContent } from '@/services/admin.service';

const toast = useToast();
const items = ref([]);
const loading = ref(false);
const error = ref(false);
const page = ref(1);
const totalPages = ref(1);
const total = ref(0);
const busyId = ref('');

function authorName(author) {
  return [author?.firstName, author?.lastName].filter(Boolean).join(' ') || author?.code || 'Độc giả';
}
function plainText(value) { return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function loadItems() {
  loading.value = true;
  error.value = false;
  try {
    const response = await getAdminForumModeration({ page: page.value, limit: 10 });
    items.value = response.data || [];
    total.value = response.meta?.total || 0;
    totalPages.value = Math.max(1, response.meta?.totalPages || 1);
  } catch (requestError) {
    error.value = true;
    toast.error(requestError.response?.data?.message || 'Không tải được hàng chờ kiểm duyệt.');
  } finally {
    loading.value = false;
  }
}

async function review(item, decision) {
  let reason = '';
  if (decision === 'reject') {
    const result = await Swal.fire({
      title: 'Từ chối nội dung này?',
      input: 'textarea',
      inputLabel: 'Lý do (sẽ gửi thông báo đến tác giả)',
      inputPlaceholder: 'Nêu ngắn gọn nội dung cần chỉnh sửa…',
      showCancelButton: true,
      confirmButtonText: 'Từ chối bài',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#dc3545',
    });
    if (!result.isConfirmed) return;
    reason = result.value || '';
  } else {
    const result = await Swal.fire({
      title: 'Duyệt và công khai nội dung?',
      text: 'Bài đăng sẽ xuất hiện trên diễn đàn.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Duyệt bài',
      cancelButtonText: 'Quay lại',
    });
    if (!result.isConfirmed) return;
  }

  busyId.value = item._id;
  try {
    await reviewAdminForumContent(item.targetType, item._id, decision, reason);
    toast.success(decision === 'approve' ? 'Đã duyệt và công khai bài đăng.' : 'Đã từ chối bài đăng.');
    if (!items.value.length && page.value > 1) page.value -= 1;
    await loadItems();
  } catch (requestError) {
    toast.error(requestError.response?.data?.message || 'Không thể cập nhật quyết định kiểm duyệt.');
  } finally {
    busyId.value = '';
  }
}

function changePage(next) {
  page.value = next;
  loadItems();
}

onMounted(loadItems);
</script>

<template>
  <main class="forum-moderation-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">CỘNG ĐỒNG ĐỘC GIẢ</p>
        <h1>Duyệt bài diễn đàn</h1>
        <p class="subheading">Bài đăng của độc giả được AI sàng lọc và chờ nhân viên quyết định trước khi công khai.</p>
      </div>
      <button class="btn btn-outline-primary" type="button" :disabled="loading" @click="loadItems">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />Làm mới
      </button>
    </header>

    <div class="queue-summary"><i class="bi bi-hourglass-split" aria-hidden="true" /> {{ total }} nội dung đang chờ xem xét</div>

    <section v-if="loading" class="state-card" aria-live="polite">
      <span class="spinner-border spinner-border-sm text-primary me-2" />Đang tải nội dung…
    </section>
    <section v-else-if="error" class="state-card">
      Không tải được dữ liệu. <button class="btn btn-sm btn-outline-primary ms-2" @click="loadItems">Thử lại</button>
    </section>
    <section v-else-if="!items.length" class="state-card empty-state">
      <i class="bi bi-shield-check" aria-hidden="true" />
      <strong>Hàng chờ đã được xử lý</strong>
      <span>Hiện không có bài đăng nào cần duyệt.</span>
    </section>
    <section v-else class="moderation-list" aria-label="Nội dung chờ kiểm duyệt">
      <article v-for="item in items" :key="`${item.targetType}-${item._id}`" class="moderation-card">
        <header class="card-meta">
          <span class="type-chip"><i class="bi" :class="item.targetType === 'thread' ? 'bi-chat-square-text' : 'bi-reply'" aria-hidden="true" />{{ item.targetType === 'thread' ? 'Chủ đề mới' : 'Phản hồi' }}</span>
          <span>{{ authorName(item.author) }} · {{ formatDate(item.createdAt) }}</span>
        </header>
        <h2 v-if="item.targetType === 'thread'">{{ item.title }}</h2>
        <p v-else class="parent-thread">Trả lời trong: <strong>{{ item.thread?.title || 'Chủ đề đã ẩn' }}</strong></p>
        <p class="content-preview">{{ plainText(item.content) }}</p>
        <footer class="card-footer">
          <div class="risk-info">
            <span v-if="Number.isFinite(item.moderation?.score)" class="score-chip">Điểm AI: {{ (item.moderation.score * 100).toFixed(1) }}%</span>
            <span>{{ item.moderation?.reason || 'Được chuyển đến hàng chờ kiểm tra thủ công' }}</span>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline-danger" :disabled="busyId === item._id" @click="review(item, 'reject')">Từ chối</button>
            <button class="btn btn-sm btn-primary" :disabled="busyId === item._id" @click="review(item, 'approve')">
              <span v-if="busyId === item._id" class="spinner-border spinner-border-sm me-1" />Duyệt và công khai
            </button>
          </div>
        </footer>
      </article>
      <nav v-if="totalPages > 1" class="pager" aria-label="Phân trang hàng chờ">
        <button class="btn btn-sm btn-outline-secondary" :disabled="page <= 1" @click="changePage(page - 1)">Trước</button>
        <span>Trang {{ page }} / {{ totalPages }}</span>
        <button class="btn btn-sm btn-outline-secondary" :disabled="page >= totalPages" @click="changePage(page + 1)">Sau</button>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.forum-moderation-page { display: grid; gap: 1rem; color: #153451; }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.page-heading h1 { margin: 0; font-size: 1.55rem; font-weight: 750; }
.eyebrow { margin: 0 0 .25rem; color: #4778a5; font-size: .72rem; font-weight: 700; letter-spacing: .08em; }
.subheading { margin: .3rem 0 0; color: #65809a; font-size: .9rem; }
.queue-summary,.state-card,.moderation-card { border: 1px solid #d8e5f1; border-radius: .8rem; background: #fff; }
.queue-summary { padding: .8rem 1rem; color: #245b88; font-weight: 650; }
.state-card { display: flex; min-height: 180px; align-items: center; justify-content: center; padding: 2rem; color: #647b91; }
.empty-state { flex-direction: column; gap: .45rem; }
.empty-state i { color: #1398a8; font-size: 2rem; }
.moderation-list { display: grid; gap: .85rem; }
.moderation-card { padding: 1.1rem 1.2rem; box-shadow: 0 3px 12px rgb(17 55 88 / 5%); }
.card-meta,.card-footer,.actions,.risk-info { display: flex; align-items: center; justify-content: space-between; gap: .65rem; }
.card-meta { flex-wrap: wrap; color: #70849a; font-size: .8rem; }
.type-chip,.score-chip { border-radius: 999px; background: #eaf5ff; color: #17649b; padding: .27rem .58rem; font-weight: 650; }
.moderation-card h2 { margin: .8rem 0 .45rem; font-size: 1.08rem; }
.parent-thread { margin: .8rem 0 .4rem; color: #607890; font-size: .85rem; }
.content-preview { margin: .6rem 0 1rem; color: #344f69; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.card-footer { align-items: flex-end; border-top: 1px solid #e8eef4; padding-top: .8rem; }
.risk-info { justify-content: flex-start; flex-wrap: wrap; color: #71869a; font-size: .77rem; }
.score-chip { background: #fff5df; color: #8b5c00; }
.actions { flex-shrink: 0; }
.pager { display: flex; justify-content: center; align-items: center; gap: 1rem; padding: .5rem; }
@media (max-width: 650px) { .page-heading,.card-footer { align-items: stretch; flex-direction: column; }.actions { justify-content: flex-end; } }
</style>
