<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import DataTable from '@/components/admin/DataTable.vue';
import {
  createAdminForumCategory,
  deleteAdminForumCategory,
  deleteAdminForumPost,
  getAdminForumCategories,
  getAdminForumReports,
  getAdminForumThreads,
  hideAdminForumPost,
  hideAdminForumThread,
  setAdminForumThreadLocked,
  setAdminForumThreadPinned,
  updateAdminForumCategory,
  updateAdminForumReportStatus,
} from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const activeReports = ref([]);
const reportTotal = ref(0);
const reportPages = ref(1);
const reportLoading = ref(false);
const reportError = ref(false);
const threads = ref([]);
const threadTotal = ref(0);
const threadPages = ref(1);
const threadLoading = ref(false);
const threadError = ref(false);
const categories = ref([]);
const categoriesLoading = ref(false);
const categoriesError = ref(false);
const busyId = ref('');
const modalOpen = ref(false);
const savingCategory = ref(false);
const editingCategory = ref(null);
const categoryForm = reactive({ name: '', slug: '', description: '', order: 0 });

const views = [
  { key: 'reports', label: 'Báo cáo', icon: 'bi-flag' },
  { key: 'threads', label: 'Chủ đề', icon: 'bi-chat-left-text' },
  { key: 'categories', label: 'Chuyên mục', icon: 'bi-tags' },
];
const view = computed(() => views.some((item) => item.key === route.query.view) ? String(route.query.view) : 'reports');
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const status = computed(() => String(route.query.status || 'open'));
const targetType = computed(() => String(route.query.targetType || ''));
const query = computed(() => String(route.query.q || ''));
const threadPage = computed(() => Math.max(1, Number(route.query.threadPage) || 1));
const reportColumns = [
  { key: 'targetType', label: 'Nội dung' },
  { key: 'target', label: 'Bài bị báo cáo' },
  { key: 'reporter', label: 'Người báo cáo' },
  { key: 'reason', label: 'Lý do' },
  { key: 'createdAt', label: 'Ngày báo cáo', sortable: true },
];
const threadColumns = [
  { key: 'title', label: 'Chủ đề' },
  { key: 'category', label: 'Chuyên mục' },
  { key: 'author', label: 'Tác giả' },
  { key: 'state', label: 'Trạng thái' },
  { key: 'createdAt', label: 'Ngày tạo', sortable: true },
];
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');

onMounted(() => {
  if (view.value === 'reports') loadReports();
  if (view.value === 'threads') loadThreads();
  if (view.value === 'categories') loadCategories();
});
watch(() => [view.value, route.query.status, route.query.targetType, route.query.page, route.query.sort], () => {
  if (view.value === 'reports') loadReports();
});
watch(() => [view.value, route.query.q, route.query.threadPage], () => {
  if (view.value === 'threads') loadThreads();
});
watch(view, (value) => { if (value === 'categories') loadCategories(); });

function setQuery(values) {
  const nextQuery = { ...route.query, ...values };
  Object.keys(nextQuery).forEach((key) => { if (nextQuery[key] === '' || nextQuery[key] == null) delete nextQuery[key]; });
  router.replace({ query: nextQuery });
}

function chooseView(value) {
  setQuery({ view: value === 'reports' ? undefined : value, page: undefined, threadPage: undefined, q: undefined, sort: undefined });
}

async function loadReports() {
  reportLoading.value = true;
  reportError.value = false;
  try {
    const result = await getAdminForumReports({
      status: status.value,
      targetType: targetType.value || undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    activeReports.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
    reportTotal.value = Number(result.meta?.total) || 0;
    reportPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    reportError.value = true;
  } finally {
    reportLoading.value = false;
  }
}

async function loadThreads() {
  threadLoading.value = true;
  threadError.value = false;
  try {
    const result = await getAdminForumThreads({ q: query.value || undefined, page: threadPage.value, limit: 10 });
    threads.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
    threadTotal.value = Number(result.meta?.total) || 0;
    threadPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    threadError.value = true;
  } finally {
    threadLoading.value = false;
  }
}

async function loadCategories() {
  categoriesLoading.value = true;
  categoriesError.value = false;
  try {
    categories.value = await getAdminForumCategories();
  } catch (error) {
    categoriesError.value = true;
    toast.error(error.response?.data?.message || 'Không tải được chuyên mục diễn đàn.');
  } finally {
    categoriesLoading.value = false;
  }
}

function updateReportStatus(value) { setQuery({ status: value, page: undefined }); }
function updateTargetType(value) { setQuery({ targetType: value || undefined, page: undefined }); }
function updateReportPage(value) { setQuery({ page: value === 1 ? undefined : String(value) }); }
function updateReportSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key, page: undefined }); }
function updateThreadQuery(value) { setQuery({ q: value.trim() || undefined, threadPage: undefined }); }
function updateThreadPage(value) { setQuery({ threadPage: value === 1 ? undefined : String(value) }); }

function reportTarget(report) { return report.targetId && typeof report.targetId === 'object' ? report.targetId : null; }
function personName(person) { return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.code || '—'; }
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function targetText(report) {
  const target = reportTarget(report);
  if (!target) return 'Nội dung không còn tồn tại.';
  return report.targetType === 'thread' ? target.title || target.content || 'Chủ đề không có nội dung' : target.content || 'Bài trả lời không có nội dung';
}

async function handleReport(report, statusValue) {
  const confirmation = await Swal.fire({
    title: statusValue === 'resolved' ? 'Đánh dấu báo cáo đã xử lý?' : 'Bỏ qua báo cáo này?',
    text: `${report.reason}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: statusValue === 'resolved' ? 'Đã xử lý' : 'Bỏ qua',
    cancelButtonText: 'Quay lại',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = report._id;
  try {
    await updateAdminForumReportStatus(report._id, statusValue);
    toast.success(statusValue === 'resolved' ? 'Đã đánh dấu báo cáo đã xử lý.' : 'Đã bỏ qua báo cáo.');
    await loadReports();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể cập nhật báo cáo.');
  } finally {
    busyId.value = '';
  }
}

async function moderateReportTarget(report, action) {
  const target = reportTarget(report);
  const targetId = target?._id || report.targetId;
  if (!targetId) {
    toast.error('Nội dung báo cáo không còn tồn tại.');
    return;
  }
  const labels = { hide: 'ẩn', delete: 'xóa' };
  const confirmation = await Swal.fire({
    title: `${labels[action]} ${report.targetType === 'thread' ? 'chủ đề' : 'bài trả lời'} này?`,
    text: 'Nội dung sẽ không còn hiển thị công khai.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: action === 'delete' ? 'Xóa bài' : 'Ẩn nội dung',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = report._id;
  try {
    if (report.targetType === 'thread') await hideAdminForumThread(targetId);
    else if (action === 'delete') await deleteAdminForumPost(targetId);
    else await hideAdminForumPost(targetId);
    toast.success('Đã ẩn nội dung khỏi diễn đàn công khai.');
    await loadReports();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể kiểm duyệt nội dung.');
  } finally {
    busyId.value = '';
  }
}

async function toggleThread(thread, field) {
  const key = field === 'pinned' ? 'pinned' : 'locked';
  const next = !thread[key];
  busyId.value = thread._id;
  try {
    if (key === 'pinned') await setAdminForumThreadPinned(thread._id, next);
    else await setAdminForumThreadLocked(thread._id, next);
    toast.success(key === 'pinned' ? (next ? 'Đã ghim chủ đề.' : 'Đã bỏ ghim chủ đề.') : (next ? 'Đã khóa chủ đề.' : 'Đã mở khóa chủ đề.'));
    await loadThreads();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể cập nhật chủ đề.');
  } finally {
    busyId.value = '';
  }
}

async function hideThread(thread) {
  const confirmation = await Swal.fire({
    title: `Ẩn chủ đề “${thread.title}”?`,
    text: 'Chủ đề và các bài trả lời sẽ không còn hiển thị công khai.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ẩn chủ đề',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = thread._id;
  try {
    await hideAdminForumThread(thread._id);
    toast.success('Đã ẩn chủ đề.');
    await loadThreads();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể ẩn chủ đề.');
  } finally {
    busyId.value = '';
  }
}

function openCreateCategory() {
  editingCategory.value = null;
  Object.assign(categoryForm, { name: '', slug: '', description: '', order: categories.value.length });
  modalOpen.value = true;
}

function openEditCategory(category) {
  editingCategory.value = category;
  Object.assign(categoryForm, { name: category.name || '', slug: category.slug || '', description: category.description || '', order: category.order || 0 });
  modalOpen.value = true;
}

async function saveCategory() {
  if (savingCategory.value || !categoryForm.name.trim()) return;
  savingCategory.value = true;
  try {
    const payload = { name: categoryForm.name.trim(), slug: categoryForm.slug.trim() || undefined, description: categoryForm.description.trim(), order: Number(categoryForm.order) || 0 };
    if (editingCategory.value) await updateAdminForumCategory(editingCategory.value._id, payload);
    else await createAdminForumCategory(payload);
    toast.success(editingCategory.value ? 'Đã cập nhật chuyên mục.' : 'Đã tạo chuyên mục.');
    modalOpen.value = false;
    await loadCategories();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không thể lưu chuyên mục.');
  } finally {
    savingCategory.value = false;
  }
}

async function removeCategory(category) {
  const confirmation = await Swal.fire({
    title: `Xóa chuyên mục “${category.name}”?`,
    text: 'Không thể xóa chuyên mục đang có chủ đề.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Xóa chuyên mục',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#dc2626',
  });
  if (!confirmation.isConfirmed) return;
  busyId.value = category._id;
  try {
    await deleteAdminForumCategory(category._id);
    toast.success('Đã xóa chuyên mục.');
    await loadCategories();
  } catch (error) {
    toast.error(error.response?.status === 409
      ? error.response?.data?.message || 'Không thể xóa chuyên mục đang có chủ đề.'
      : error.response?.data?.message || 'Không thể xóa chuyên mục.');
  } finally {
    busyId.value = '';
  }
}
</script>

<template>
  <section class="forum-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Kiểm duyệt diễn đàn</span>
    </nav>
    <div class="page-heading forum-heading">
      <div>
        <h1>Kiểm duyệt diễn đàn</h1><p class="text-muted-strong mb-0">
          Xử lý báo cáo và quản lý chủ đề, chuyên mục.
        </p>
      </div>
    </div>

    <div
      class="forum-tabs"
      role="tablist"
      aria-label="Khu vực diễn đàn"
    >
      <button
        v-for="tab in views"
        :key="tab.key"
        class="forum-tab"
        :class="{ 'is-active': view === tab.key }"
        type="button"
        role="tab"
        :aria-selected="view === tab.key"
        @click="chooseView(tab.key)"
      >
        <i
          class="bi"
          :class="tab.icon"
          aria-hidden="true"
        />{{ tab.label }}
      </button>
    </div>

    <template v-if="view === 'reports'">
      <DataTable
        :columns="reportColumns"
        :rows="activeReports"
        :loading="reportLoading"
        :error="reportError"
        :page="page"
        :total-pages="reportPages"
        :total="reportTotal"
        :searchable="false"
        :sort-by="sortBy"
        :sort-order="sortOrder"
        @sort="updateReportSort"
        @page="updateReportPage"
        @retry="loadReports"
      >
        <template #toolbar>
          <div class="toolbar-filters">
            <label class="filter-field"><span>Trạng thái</span><select
              class="form-select form-select-sm"
              :value="status"
              @change="updateReportStatus($event.target.value)"
            ><option value="open">Chờ xử lý</option><option value="resolved">Đã xử lý</option><option value="dismissed">Đã bỏ qua</option></select></label>
            <label class="filter-field"><span>Loại nội dung</span><select
              class="form-select form-select-sm"
              :value="targetType"
              @change="updateTargetType($event.target.value)"
            ><option value="">Tất cả</option><option value="thread">Chủ đề</option><option value="post">Bài trả lời</option></select></label>
          </div>
        </template>
        <template #cell-targetType="{ value }">
          <span class="type-badge">{{ value === 'thread' ? 'Chủ đề' : 'Bài trả lời' }}</span>
        </template>
        <template #cell-target="{ row }">
          <div class="report-target">
            <strong>{{ reportTarget(row)?.title || (row.targetType === 'thread' ? 'Chủ đề' : 'Bài trả lời') }}</strong><p>{{ targetText(row) }}</p><small
              v-if="reportTarget(row)?.status === 'hidden'"
              class="text-danger"
            >Nội dung đã ẩn</small>
          </div>
        </template>
        <template #cell-reporter="{ row }">
          <div class="reporter-cell">
            <strong>{{ personName(row.reporter) }}</strong><small>{{ row.reporter?.code || '—' }}</small>
          </div>
        </template>
        <template #cell-createdAt="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #row="{ row }">
          <div class="report-actions">
            <template v-if="row.status === 'open'">
              <button
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="Boolean(busyId)"
                @click="handleReport(row, 'resolved')"
              >
                Đã xử lý
              </button>
              <button
                v-if="reportTarget(row)?.status !== 'hidden'"
                class="btn btn-sm btn-outline-danger"
                type="button"
                :disabled="Boolean(busyId)"
                @click="moderateReportTarget(row, 'hide')"
              >
                Ẩn
              </button>
              <button
                v-if="row.targetType === 'post' && reportTarget(row)?.status !== 'hidden'"
                class="btn btn-sm btn-outline-danger"
                type="button"
                :disabled="Boolean(busyId)"
                @click="moderateReportTarget(row, 'delete')"
              >
                Xóa
              </button>
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                :disabled="Boolean(busyId)"
                @click="handleReport(row, 'dismissed')"
              >
                Bỏ qua
              </button>
            </template>
            <span
              v-else
              class="text-muted-strong"
            >{{ row.status === 'resolved' ? 'Đã xử lý' : 'Đã bỏ qua' }}</span>
          </div>
        </template>
        <template #empty>
          <div class="empty-state">
            <i
              class="bi bi-flag"
              aria-hidden="true"
            /><span>Không có báo cáo ở trạng thái này.</span>
          </div>
        </template>
        <template #error>
          Không tải được hàng đợi báo cáo.<button
            class="btn btn-sm btn-outline-primary ms-2"
            type="button"
            @click="loadReports"
          >
            Thử lại
          </button>
        </template>
      </DataTable>
    </template>

    <template v-else-if="view === 'threads'">
      <DataTable
        :columns="threadColumns"
        :rows="threads"
        :loading="threadLoading"
        :error="threadError"
        :page="threadPage"
        :total-pages="threadPages"
        :total="threadTotal"
        :query="query"
        :sort-by="'createdAt'"
        :sort-order="'desc'"
        @update:query="updateThreadQuery"
        @page="updateThreadPage"
        @retry="loadThreads"
      >
        <template #cell-title="{ row }">
          <div class="thread-title">
            <strong>{{ row.title }}</strong><small>{{ row.replyCount || 0 }} phản hồi · {{ row.viewCount || 0 }} lượt xem</small>
          </div>
        </template>
        <template #cell-category="{ row }">
          {{ row.category?.name || '—' }}
        </template>
        <template #cell-author="{ row }">
          {{ personName(row.author) }}
        </template>
        <template #cell-state="{ row }">
          <div class="state-chips">
            <span
              v-if="row.pinned"
              class="state-chip pinned"
            >Đã ghim</span><span
              v-if="row.locked"
              class="state-chip locked"
            >Đã khóa</span><span v-if="!row.pinned && !row.locked">Bình thường</span>
          </div>
        </template>
        <template #cell-createdAt="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #row="{ row }">
          <div class="thread-actions">
            <button
              class="btn btn-sm btn-outline-primary"
              type="button"
              :disabled="Boolean(busyId)"
              @click="toggleThread(row, 'pinned')"
            >
              {{ row.pinned ? 'Bỏ ghim' : 'Ghim' }}
            </button><button
              class="btn btn-sm btn-outline-secondary"
              type="button"
              :disabled="Boolean(busyId)"
              @click="toggleThread(row, 'locked')"
            >
              {{ row.locked ? 'Mở khóa' : 'Khóa' }}
            </button><button
              class="btn btn-sm btn-outline-danger"
              type="button"
              :disabled="Boolean(busyId)"
              @click="hideThread(row)"
            >
              Ẩn
            </button>
          </div>
        </template>
        <template #empty>
          <div class="empty-state">
            <i
              class="bi bi-chat-left-text"
              aria-hidden="true"
            /><span>Không có chủ đề phù hợp.</span>
          </div>
        </template>
        <template #error>
          Không tải được danh sách chủ đề.<button
            class="btn btn-sm btn-outline-primary ms-2"
            type="button"
            @click="loadThreads"
          >
            Thử lại
          </button>
        </template>
      </DataTable>
    </template>

    <section
      v-else
      class="categories-panel surface-card"
    >
      <header class="categories-heading">
        <div><h2>Chuyên mục diễn đàn</h2><p>Quản lý nhóm chủ đề hiển thị ở diễn đàn.</p></div><button
          class="btn btn-primary btn-sm"
          type="button"
          @click="openCreateCategory"
        >
          <i class="bi bi-plus-lg me-1" />Thêm chuyên mục
        </button>
      </header>
      <div
        v-if="categoriesLoading"
        class="panel-state"
      >
        <span class="spinner-border spinner-border-sm text-primary" /> Đang tải chuyên mục...
      </div>
      <div
        v-else-if="categoriesError"
        class="panel-state"
      >
        Không tải được chuyên mục.<button
          class="btn btn-sm btn-outline-primary"
          type="button"
          @click="loadCategories"
        >
          Thử lại
        </button>
      </div>
      <div
        v-else-if="!categories.length"
        class="panel-state"
      >
        Chưa có chuyên mục diễn đàn.
      </div>
      <div
        v-else
        class="category-list"
      >
        <article
          v-for="category in categories"
          :key="category._id"
          class="category-row"
        >
          <div class="category-info">
            <strong>{{ category.name }}</strong><small>{{ category.slug }} · Thứ tự {{ category.order || 0 }}</small><p>{{ category.description || 'Chưa có mô tả.' }}</p>
          </div>
          <div class="category-actions">
            <button
              class="btn btn-sm btn-outline-primary"
              type="button"
              :disabled="Boolean(busyId)"
              @click="openEditCategory(category)"
            >
              Sửa
            </button><button
              class="btn btn-sm btn-outline-danger"
              type="button"
              :disabled="Boolean(busyId)"
              @click="removeCategory(category)"
            >
              Xóa
            </button>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="modalOpen"
      class="modal-backdrop-custom"
      @click.self="modalOpen = false"
    >
      <section
        class="category-modal surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
      >
        <header class="modal-heading">
          <div>
            <span class="eyebrow">Diễn đàn</span><h2 id="category-modal-title">
              {{ editingCategory ? 'Sửa chuyên mục' : 'Thêm chuyên mục' }}
            </h2>
          </div><button
            class="icon-close"
            type="button"
            aria-label="Đóng"
            @click="modalOpen = false"
          >
            <i class="bi bi-x-lg" />
          </button>
        </header>
        <form @submit.prevent="saveCategory">
          <label class="form-field"><span>Tên chuyên mục *</span><input
            v-model.trim="categoryForm.name"
            class="form-control"
            maxlength="100"
            required
          ></label>
          <label class="form-field"><span>Slug (không bắt buộc)</span><input
            v-model.trim="categoryForm.slug"
            class="form-control"
            maxlength="120"
            pattern="[a-z0-9-]*"
            placeholder="Tự tạo từ tên nếu để trống"
          ></label>
          <label class="form-field"><span>Mô tả</span><textarea
            v-model.trim="categoryForm.description"
            class="form-control"
            maxlength="1000"
            rows="3"
          /></label>
          <label class="form-field"><span>Thứ tự</span><input
            v-model.number="categoryForm.order"
            class="form-control"
            type="number"
            min="0"
            step="1"
          ></label>
          <footer class="modal-actions">
            <button
              class="btn btn-outline-secondary"
              type="button"
              :disabled="savingCategory"
              @click="modalOpen = false"
            >
              Hủy
            </button><button
              class="btn btn-primary"
              type="submit"
              :disabled="savingCategory || !categoryForm.name.trim()"
            >
              <span
                v-if="savingCategory"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              />{{ editingCategory ? 'Lưu thay đổi' : 'Tạo chuyên mục' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }.forum-heading { margin-bottom: 1.25rem; }.forum-heading p { margin-top: .35rem; font-size: .9rem; }
.forum-tabs { display: flex; gap: .35rem; margin-bottom: 1rem; padding: .3rem; border-bottom: 1px solid #e5e7eb; }.forum-tab { display: inline-flex; align-items: center; gap: .45rem; padding: .65rem 1rem; border: 0; border-radius: .5rem .5rem 0 0; background: transparent; color: #6b7280; }.forum-tab:hover { background: #f8fafc; color: #1d4ed8; }.forum-tab.is-active { border-bottom: 2px solid #2563eb; color: #1d4ed8; font-weight: 600; }
.toolbar-filters { display: flex; flex-wrap: wrap; gap: .75rem; }.filter-field { display: grid; min-width: 150px; gap: .25rem; color: #6b7280; font-size: .75rem; }.report-target { display: grid; min-width: 190px; max-width: 320px; gap: .2rem; }.report-target p { display: -webkit-box; overflow: hidden; margin: 0; color: #6b7280; font-size: .78rem; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }.report-target small { font-size: .72rem; }.reporter-cell,.thread-title { display: grid; gap: .2rem; }.reporter-cell small,.thread-title small { color: #6b7280; font-size: .75rem; }.type-badge,.state-chip { display: inline-flex; padding: .28rem .5rem; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: .72rem; white-space: nowrap; }.state-chips { display: flex; flex-wrap: wrap; gap: .3rem; }.state-chip.pinned { background: #f5f3ff; color: #6d28d9; }.state-chip.locked { background: #fff7ed; color: #c2410c; }.report-actions,.thread-actions { display: flex; flex-wrap: wrap; gap: .35rem; }.empty-state,.panel-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1.25rem; color: #6b7280; }.categories-panel { padding: 1.2rem; }.categories-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; }.categories-heading h2 { margin: 0; font-size: 1rem; }.categories-heading p { margin: .3rem 0 0; color: #6b7280; font-size: .8rem; }.category-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .85rem 0; border-top: 1px solid #e5e7eb; }.category-info { display: grid; gap: .2rem; }.category-info small,.category-info p { margin: 0; color: #6b7280; font-size: .78rem; }.category-actions { display: flex; gap: .35rem; }.modal-backdrop-custom { position: fixed; z-index: 1050; inset: 0; display: grid; overflow-y: auto; place-items: center; padding: 1rem; background: rgb(17 24 39 / 45%); }.category-modal { width: min(100%, 520px); padding: 1.35rem; box-shadow: 0 20px 50px rgb(17 24 39 / 20%); }.modal-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.1rem; }.modal-heading h2 { margin: .2rem 0 0; font-size: 1.2rem; }.eyebrow { color: #6b7280; font-size: .75rem; }.icon-close { width: 2.25rem; height: 2.25rem; border: 0; border-radius: .5rem; background: #f3f4f6; }.form-field { display: grid; gap: .35rem; margin-bottom: 1rem; font-size: .85rem; }.modal-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
@media (max-width: 575.98px) { .forum-tabs { overflow-x: auto; }.forum-tab { flex: 1 0 auto; }.categories-heading { align-items: flex-start; flex-direction: column; }.category-row { align-items: flex-start; flex-direction: column; }.report-actions,.thread-actions { align-items: flex-start; flex-direction: column; }.toolbar-filters { display: grid; grid-template-columns: 1fr; } }
</style>
