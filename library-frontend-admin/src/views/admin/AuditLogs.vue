<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import DataTable from '@/components/admin/DataTable.vue';
import { getAdminAuditLogs, getAdminUser, searchAdminActors } from '@/services/admin.service';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const rows = ref([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const loadError = ref(false);
const actionInput = ref(String(route.query.action || ''));
const actorQuery = ref('');
const actorMatches = ref([]);
const actorLoading = ref(false);
const selectedActor = ref(null);

const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const actorId = computed(() => String(route.query.actor || ''));
const action = computed(() => String(route.query.action || ''));
const from = computed(() => String(route.query.from || ''));
const to = computed(() => String(route.query.to || ''));
const sortValue = computed(() => String(route.query.sort || '-createdAt'));
const sortBy = computed(() => sortValue.value.replace(/^-/, ''));
const sortOrder = computed(() => sortValue.value.startsWith('-') ? 'desc' : 'asc');
const columns = [
  { key: 'action', label: 'Hành động', sortable: true },
  { key: 'actor', label: 'Người thực hiện' },
  { key: 'targetType', label: 'Đối tượng' },
  { key: 'targetId', label: 'Mã đối tượng' },
  { key: 'detail', label: 'Chi tiết' },
  { key: 'ip', label: 'IP' },
  { key: 'createdAt', label: 'Thời gian', sortable: true },
];

onMounted(() => {
  loadLogs();
  loadSelectedActor();
});
watch(() => [route.query.page, route.query.actor, route.query.action, route.query.from, route.query.to, route.query.sort], loadLogs);
watch(() => route.query.action, (value) => { actionInput.value = String(value || ''); });
watch(() => route.query.actor, loadSelectedActor);

async function loadLogs() {
  loading.value = true;
  loadError.value = false;
  try {
    const result = await getAdminAuditLogs({
      actor: actorId.value || undefined,
      action: action.value || undefined,
      from: from.value ? dayStartIso(from.value) : undefined,
      to: to.value ? dayEndIso(to.value) : undefined,
      page: page.value,
      limit: 10,
      sort: sortValue.value,
    });
    rows.value = Array.isArray(result.data) ? result.data : (Array.isArray(result.items) ? result.items : []);
    total.value = Number(result.meta?.total) || 0;
    totalPages.value = Math.max(1, Number(result.meta?.totalPages) || 1);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function dayStartIso(value) { return new Date(`${value}T00:00:00`).toISOString(); }
function dayEndIso(value) { return new Date(`${value}T23:59:59.999`).toISOString(); }

function setQuery(values) {
  const nextQuery = { ...route.query, ...values };
  Object.keys(nextQuery).forEach((key) => { if (nextQuery[key] === '' || nextQuery[key] == null) delete nextQuery[key]; });
  router.replace({ query: nextQuery });
}

function applyActionFilter() { setQuery({ action: actionInput.value.trim() || undefined, page: undefined }); }
function updatePage(value) { setQuery({ page: value === 1 ? undefined : String(value) }); }
function updateSort({ key, order }) { setQuery({ sort: order === 'desc' ? `-${key}` : key, page: undefined }); }

function updateDateFilter(key, value) {
  const other = key === 'from' ? to.value : from.value;
  if (value && other && ((key === 'from' && value > other) || (key === 'to' && value < other))) {
    toast.error('Khoảng ngày không hợp lệ.');
    return;
  }
  setQuery({ [key]: value || undefined, page: undefined });
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function actorName(actor) {
  return [actor?.firstName, actor?.lastName].filter(Boolean).join(' ') || actor?.code || 'Hệ thống';
}

async function loadSelectedActor() {
  if (!actorId.value) {
    selectedActor.value = null;
    actorQuery.value = '';
    return;
  }
  try {
    selectedActor.value = await getAdminUser(actorId.value);
    actorQuery.value = `${selectedActor.value.code || ''} — ${actorName(selectedActor.value)}`;
  } catch {
    selectedActor.value = null;
    actorQuery.value = `ID: ${actorId.value}`;
  }
}

async function findActors() {
  const value = actorQuery.value.trim();
  if (!value) {
    actorMatches.value = [];
    return;
  }
  actorLoading.value = true;
  try {
    actorMatches.value = await searchAdminActors(value);
  } catch (error) {
    toast.error(error.response?.data?.message || 'Không tìm được người thực hiện.');
  } finally {
    actorLoading.value = false;
  }
}

function chooseActor(user) {
  selectedActor.value = user;
  actorMatches.value = [];
  actorQuery.value = `${user.code || ''} — ${actorName(user)}`;
  setQuery({ actor: user._id, page: undefined });
}

function clearActor() {
  selectedActor.value = null;
  actorQuery.value = '';
  actorMatches.value = [];
  setQuery({ actor: undefined, page: undefined });
}

function prettyDetail(value) {
  if (value == null) return '—';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
</script>

<template>
  <section class="audit-page">
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span><i
        class="bi bi-chevron-right"
        aria-hidden="true"
      /><span aria-current="page">Nhật ký hệ thống</span>
    </nav>
    <div class="page-heading audit-heading">
      <div>
        <h1>Nhật ký hệ thống</h1><p class="text-muted-strong mb-0">
          Tra cứu thao tác quản trị và thay đổi dữ liệu.
        </p>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="loadError"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :searchable="false"
      @sort="updateSort"
      @page="updatePage"
      @retry="loadLogs"
    >
      <template #toolbar>
        <div class="audit-filters">
          <label class="filter-field action-filter"><span>Hành động</span><div class="search-row"><input
            v-model="actionInput"
            class="form-control form-control-sm"
            type="search"
            placeholder="Ví dụ: book.create"
          ><button
            class="btn btn-sm btn-outline-primary"
            type="button"
            @click="applyActionFilter"
          >Lọc</button></div></label>
          <div class="filter-field actor-filter">
            <label for="actor-search">Người thực hiện</label><div class="search-row">
              <input
                id="actor-search"
                v-model="actorQuery"
                class="form-control form-control-sm"
                type="search"
                placeholder="Mã, tên hoặc email"
              ><button
                class="btn btn-sm btn-outline-primary"
                type="button"
                :disabled="actorLoading"
                @click="findActors"
              >
                Tìm
              </button><button
                v-if="actorId"
                class="btn btn-sm btn-outline-secondary"
                type="button"
                aria-label="Xóa bộ lọc người thực hiện"
                @click="clearActor"
              >
                <i class="bi bi-x-lg" />
              </button>
            </div><div
              v-if="actorMatches.length"
              class="actor-results"
            >
              <button
                v-for="user in actorMatches"
                :key="user._id"
                type="button"
                @click="chooseActor(user)"
              >
                <strong>{{ user.code }} · {{ actorName(user) }}</strong><small>{{ user.email }}</small>
              </button>
            </div>
          </div>
          <label class="filter-field"><span>Từ ngày</span><input
            class="form-control form-control-sm"
            type="date"
            :value="from"
            :max="to || undefined"
            @change="updateDateFilter('from', $event.target.value)"
          ></label>
          <label class="filter-field"><span>Đến ngày</span><input
            class="form-control form-control-sm"
            type="date"
            :value="to"
            :min="from || undefined"
            @change="updateDateFilter('to', $event.target.value)"
          ></label>
        </div>
      </template>
      <template #cell-actor="{ row }">
        <div class="actor-cell">
          <strong>{{ actorName(row.actor) }}</strong><small>{{ row.actor?.code || (row.actor ? '—' : 'Hệ thống') }}</small>
        </div>
      </template>
      <template #cell-targetId="{ value }">
        <code v-if="value">{{ value }}</code><span v-else>—</span>
      </template>
      <template #cell-detail="{ value }">
        <details
          v-if="value && Object.keys(value).length"
          class="detail-popover"
        >
          <summary>Xem chi tiết</summary><pre>{{ prettyDetail(value) }}</pre>
        </details><span v-else>—</span>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value) }}
      </template>
      <template #empty>
        <div class="empty-state">
          <i
            class="bi bi-journal-text"
            aria-hidden="true"
          /><span>Không có nhật ký phù hợp bộ lọc.</span>
        </div>
      </template>
      <template #error>
        Không tải được nhật ký hệ thống.<button
          class="btn btn-sm btn-outline-primary ms-2"
          type="button"
          @click="loadLogs"
        >
          Thử lại
        </button>
      </template>
    </DataTable>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; color: #6b7280; font-size: .825rem; }.audit-heading { margin-bottom: 1.25rem; }.audit-heading p { margin-top: .35rem; font-size: .9rem; }
.audit-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem; width: 100%; }.filter-field { position: relative; display: grid; min-width: 150px; gap: .25rem; color: #6b7280; font-size: .75rem; }.action-filter,.actor-filter { flex: 1 1 220px; }.search-row { display: flex; gap: .35rem; }.search-row input { min-width: 0; }.actor-results { position: absolute; z-index: 5; top: 100%; right: 0; left: 0; display: grid; max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: .4rem; background: #fff; box-shadow: 0 8px 20px rgb(17 24 39 / 12%); }.actor-results button { display: grid; gap: .2rem; padding: .55rem .7rem; border: 0; border-bottom: 1px solid #e5e7eb; background: #fff; text-align: left; }.actor-results small { color: #6b7280; }.actor-cell { display: grid; gap: .2rem; }.actor-cell small { color: #6b7280; font-size: .75rem; }.detail-popover { min-width: 95px; }.detail-popover summary { color: #2563eb; cursor: pointer; font-size: .8rem; }.detail-popover pre { position: absolute; z-index: 3; width: min(360px, 60vw); max-height: 280px; overflow: auto; padding: .75rem; border: 1px solid #e5e7eb; border-radius: .5rem; background: #fff; box-shadow: 0 8px 24px rgb(17 24 39 / 14%); color: #374151; font-size: .72rem; white-space: pre-wrap; }.empty-state { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; }
@media (max-width: 575.98px) { .audit-filters { display: grid; grid-template-columns: 1fr; }.filter-field,.search-row { width: 100%; }.detail-popover pre { width: min(300px, 70vw); } }
</style>
