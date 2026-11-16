<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { getAdminStatistics } from '@/services/admin.service';

const props = defineProps({
  section: { type: String, required: true },
  refreshKey: { type: Number, default: 0 },
});

const data = ref(null);
const loading = ref(true);
const error = ref(false);
const expanded = ref(true);
const labels = {
  loans: { pending: 'Chờ duyệt', approved: 'Đã duyệt', borrowing: 'Đang mượn', overdue: 'Quá hạn', returned: 'Đã trả', rejected: 'Từ chối', cancelled: 'Đã hủy', expired: 'Hết hạn nhận' },
  renewals: { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' },
  fines: { unpaid: 'Chưa thu', paid: 'Đã thu', waived: 'Đã miễn' },
  users: { active: 'Đang hoạt động', locked: 'Đã khóa', reader: 'Độc giả', staff: 'Nhân viên', admin: 'Quản trị viên' },
  staff: { active: 'Đang hoạt động', locked: 'Đã khóa' },
  forum: { open: 'Chờ xử lý', resolved: 'Đã xử lý', dismissed: 'Đã bỏ qua', active: 'Đang hiển thị', hidden: 'Đã ẩn' },
  notifications: { user: 'Một người', all: 'Mọi người', readers: 'Độc giả', staff: 'Nhân viên' },
  catalog: { authors: 'Tác giả', categories: 'Thể loại', publishers: 'Nhà xuất bản' },
};
const sectionTitles = {
  loans: 'Thống kê phiếu mượn', renewals: 'Thống kê yêu cầu gia hạn', fines: 'Thống kê tiền phạt',
  users: 'Thống kê tài khoản', staff: 'Thống kê nhân viên', forum: 'Thống kê diễn đàn',
  notifications: 'Thống kê thông báo', catalog: 'Thống kê danh mục',
};
const items = computed(() => {
  if (!data.value) return [];
  const result = [];
  const addGroup = (heading, entries, icon) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => result.push({
      key: `${heading}-${entry.key}`,
      label: heading ? `${heading} · ${labels[props.section]?.[entry.key] || entry.key}` : labels[props.section]?.[entry.key] || entry.key,
      value: Number(entry.count) || 0,
      description: props.section === 'fines' ? formatMoney(entry.amount) : '',
      icon,
    }));
  };

  if (props.section === 'forum') {
    addGroup('Báo cáo', data.value.reports?.statuses, 'bi-flag');
    addGroup('Chủ đề', data.value.threads?.statuses, 'bi-chat-left-text');
  } else if (props.section === 'users') {
    addGroup('', data.value.statuses, 'bi-person-check');
    addGroup('', data.value.roles, 'bi-people');
  } else {
    const entries = props.section === 'notifications' ? data.value.audiences
      : props.section === 'catalog' ? data.value.items
        : data.value.statuses;
    addGroup('', entries, props.section === 'catalog' ? 'bi-collection' : 'bi-bar-chart');
  }
  return [{ key: 'total', label: 'Tổng cộng', value: Number(data.value.total) || 0, icon: 'bi-graph-up' }, ...result];
});

onMounted(refresh);
watch(() => [props.section, props.refreshKey], refresh);

async function refresh() {
  loading.value = true;
  error.value = false;
  try {
    data.value = await getAdminStatistics(props.section);
  } catch {
    data.value = null;
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}
</script>

<template>
  <section
    class="admin-statistics surface-card"
    aria-live="polite"
  >
    <header class="statistics-heading">
      <div>
        <h2>{{ sectionTitles[section] }}</h2>
        <p>Số liệu tổng hợp trong phạm vi quyền hiện tại, không giới hạn theo trang bảng.</p>
      </div>
      <button
        class="btn btn-sm btn-outline-secondary"
        type="button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <i
          class="bi"
          :class="expanded ? 'bi-chevron-up' : 'bi-chevron-down'"
          aria-hidden="true"
        />
        {{ expanded ? 'Thu gọn' : 'Mở thống kê' }}
      </button>
    </header>
    <div
      v-if="expanded"
      class="statistics-content"
    >
      <div
        v-if="loading"
        class="statistics-message"
        role="status"
      >
        <span
          class="spinner-border spinner-border-sm"
          aria-hidden="true"
        /> Đang tải thống kê...
      </div>
      <div
        v-else-if="error"
        class="statistics-message statistics-error"
        role="alert"
      >
        <span>Chưa tải được thống kê.</span>
        <button
          class="btn btn-sm btn-outline-primary"
          type="button"
          @click="refresh"
        >
          Thử lại
        </button>
      </div>
      <div
        v-else-if="items.length"
        class="statistics-grid"
      >
        <article
          v-for="item in items"
          :key="item.key"
          class="statistics-item"
        >
          <span
            class="statistics-icon"
            aria-hidden="true"
          ><i
            class="bi"
            :class="item.icon"
          /></span>
          <div class="statistics-copy">
            <span>{{ item.label }}</span>
            <strong>{{ item.value.toLocaleString('vi-VN') }}</strong>
            <small v-if="item.description">{{ item.description }}</small>
          </div>
        </article>
      </div>
      <div
        v-else
        class="statistics-message"
      >
        Chưa có dữ liệu thống kê.
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.admin-statistics { margin-bottom: 1rem; padding: 1rem; }
.statistics-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.statistics-heading h2 { margin: 0; font-size: 1rem; font-weight: 650; }
.statistics-heading p { margin: .2rem 0 0; color: #64748b; font-size: .8rem; }
.statistics-content { margin-top: .85rem; }
.statistics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .65rem; }
.statistics-item { display: flex; min-width: 0; align-items: center; gap: .65rem; border: 1px solid #e2e8f0; border-radius: .65rem; background: #f8fafc; padding: .7rem; }
.statistics-icon { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: .55rem; background: #dbeafe; color: #2563eb; }
.statistics-copy { display: grid; min-width: 0; gap: .12rem; }
.statistics-copy span { overflow: hidden; color: #475569; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.statistics-copy strong { font-size: 1.1rem; line-height: 1.2; }
.statistics-copy small { color: #64748b; font-size: .72rem; }
.statistics-message { display: flex; min-height: 52px; align-items: center; justify-content: center; gap: .6rem; color: #64748b; font-size: .875rem; }
.statistics-error { color: #b91c1c; }
@media (max-width: 575.98px) { .statistics-heading { align-items: flex-start; flex-direction: column; }.statistics-heading > button { align-self: flex-end; } }
</style>
