<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { Bar, Doughnut, Line } from 'vue-chartjs';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { RouterLink } from 'vue-router';
import ChartCard from '@/components/admin/ChartCard.vue';
import DateRangePicker from '@/components/admin/DateRangePicker.vue';
import StatCard from '@/components/admin/StatCard.vue';
import {
  exportLoansReport,
  getAdminLoans,
  getDashboardCharts,
  getDashboardSummary,
} from '@/services/admin.service';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);
dayjs.locale('vi');

const toast = useToast();
const selectedRange = ref('30d');
const summary = ref(null);
const charts = ref(null);
const approvedLoans = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const exportLoading = ref(false);

const summaryCards = computed(() => {
  if (!summary.value) return [];
  return [
    { label: 'Đầu sách', value: formatNumber(summary.value.totalBooks), icon: 'bi-book' },
    { label: 'Tổng bản sách', value: formatNumber(summary.value.totalBookCopies), icon: 'bi-collection' },
    { label: 'Độc giả', value: formatNumber(summary.value.totalReaders), icon: 'bi-people' },
    { label: 'Đang mượn', value: formatNumber(summary.value.borrowingLoans), icon: 'bi-journal-bookmark' },
    { label: 'Phiếu quá hạn', value: formatNumber(summary.value.overdueLoans), icon: 'bi-exclamation-circle' },
    {
      label: 'Chờ xử lý',
      value: formatNumber((summary.value.pendingLoans || 0) + (summary.value.pendingRenewals || 0)),
      description: `${formatNumber(summary.value.pendingLoans)} yêu cầu mượn · ${formatNumber(summary.value.pendingRenewals)} gia hạn`,
      icon: 'bi-hourglass-split',
    },
    {
      label: 'Phạt chưa thu',
      value: formatCurrency(summary.value.unpaidFines?.amount),
      description: `${formatNumber(summary.value.unpaidFines?.count)} khoản chưa thu`,
      icon: 'bi-cash-coin',
    },
  ];
});

const loansLineData = computed(() => ({
  labels: (charts.value?.loansByPeriod || []).map((item) => formatPeriod(item.period)),
  datasets: [{
    label: 'Lượt mượn',
    data: (charts.value?.loansByPeriod || []).map((item) => item.count),
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    pointBackgroundColor: '#2563eb',
    fill: true,
    tension: 0.25,
  }],
}));

const topBooksData = computed(() => ({
  labels: (charts.value?.topBooks || []).map((item) => item.title),
  datasets: [{
    label: 'Lượt mượn',
    data: (charts.value?.topBooks || []).map((item) => item.borrowCount),
    backgroundColor: '#2563eb',
    borderRadius: 4,
  }],
}));

const categoriesData = computed(() => ({
  labels: (charts.value?.borrowingsByCategory || []).map((item) => item.name),
  datasets: [{
    label: 'Lượt mượn',
    data: (charts.value?.borrowingsByCategory || []).map((item) => item.borrowCount),
    backgroundColor: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#0ea5e9'],
    borderWidth: 0,
  }],
}));

const loanOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};
const categoryOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
};

const soonPickupCount = computed(() => {
  const now = Date.now();
  const deadline = now + 3 * 24 * 60 * 60 * 1000;
  return approvedLoans.value.filter((loan) => {
    const pickupDeadline = new Date(loan.pickupDeadline).getTime();
    return Number.isFinite(pickupDeadline) && pickupDeadline >= now && pickupDeadline <= deadline;
  }).length;
});

const actionRows = computed(() => [
  { label: 'Yêu cầu mượn chờ duyệt', count: summary.value?.pendingLoans || 0, route: '/admin/requests', icon: 'bi-inbox' },
  { label: 'Yêu cầu gia hạn chờ duyệt', count: summary.value?.pendingRenewals || 0, route: '/admin/renewals', icon: 'bi-calendar-check' },
  { label: 'Sắp đến hạn nhận sách (3 ngày)', count: soonPickupCount.value, route: '/admin/handover', icon: 'bi-box-arrow-in-down' },
  { label: 'Phiếu mượn quá hạn', count: summary.value?.overdueLoans || 0, route: '/admin/returns', icon: 'bi-exclamation-triangle' },
]);

const hasLoanChart = computed(() => (charts.value?.loansByPeriod || []).some((item) => item.count > 0));
const hasTopBooks = computed(() => (charts.value?.topBooks || []).length > 0);
const hasCategories = computed(() => (charts.value?.borrowingsByCategory || []).length > 0);

onMounted(loadDashboard);
watch(selectedRange, loadDashboard);

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [summaryData, chartData, approvedResult] = await Promise.all([
      getDashboardSummary(),
      getDashboardCharts(selectedRange.value),
      getAdminLoans({ status: 'approved', limit: 100, sort: 'pickupDeadline' }),
    ]);
    summary.value = summaryData;
    charts.value = chartData;
    approvedLoans.value = Array.isArray(approvedResult.data) ? approvedResult.data : (approvedResult.data?.items || []);
  } catch {
    errorMessage.value = 'Không tải được dữ liệu tổng quan. Vui lòng thử lại.';
    toast.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const params = {};
    if (charts.value?.from) params.from = formatDateParam(charts.value.from);
    if (charts.value?.to) params.to = formatDateParam(charts.value.to);
    const file = await exportLoansReport(params);
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-phieu-muon-${dayjs().format('YYYY-MM-DD')}.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast.error('Không xuất được báo cáo. Vui lòng thử lại.');
  } finally {
    exportLoading.value = false;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

function formatCurrency(value) {
  return `${formatNumber(value)}đ`;
}

function formatPeriod(period) {
  return period?.length === 7 ? dayjs(`${period}-01`).format('MM/YYYY') : dayjs(period).format('DD/MM');
}

function formatDateParam(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]));
  return `${date.year}-${date.month}-${date.day}`;
}
</script>

<template>
  <section>
    <nav
      class="breadcrumb-line"
      aria-label="Đường dẫn"
    >
      <span>Quản trị</span>
      <i
        class="bi bi-chevron-right"
        aria-hidden="true"
      />
      <span aria-current="page">Tổng quan</span>
    </nav>

    <div class="page-heading dashboard-heading">
      <div>
        <h1>Tổng quan</h1>
        <p class="text-muted-strong mb-0">
          Tình hình hoạt động thư viện
        </p>
      </div>
      <div class="dashboard-actions">
        <DateRangePicker v-model="selectedRange" />
        <button
          class="btn btn-outline-primary btn-sm"
          type="button"
          :disabled="exportLoading"
          @click="handleExport"
        >
          <span
            v-if="exportLoading"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          />
          <i
            v-else
            class="bi bi-file-earmark-spreadsheet me-1"
            aria-hidden="true"
          />
          Xuất Excel
        </button>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="surface-card dashboard-error"
      role="alert"
    >
      <p class="mb-2">
        {{ errorMessage }}
      </p>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        @click="loadDashboard"
      >
        Thử lại
      </button>
    </div>

    <div v-else>
      <div
        v-if="loading"
        class="dashboard-grid stats-grid"
        aria-label="Đang tải số liệu"
        aria-busy="true"
      >
        <div
          v-for="item in 7"
          :key="item"
          class="surface-card stat-skeleton"
        >
          <span />
        </div>
      </div>
      <div
        v-else
        class="dashboard-grid stats-grid"
      >
        <StatCard
          v-for="card in summaryCards"
          :key="card.label"
          v-bind="card"
        />
      </div>

      <div class="dashboard-grid charts-grid">
        <ChartCard
          title="Lượt mượn theo thời gian"
          description="Thống kê theo khoảng thời gian đã chọn"
          :loading="loading"
          :empty="!hasLoanChart"
        >
          <div class="chart-canvas">
            <Line
              :data="loansLineData"
              :options="loanOptions"
            />
          </div>
        </ChartCard>
        <ChartCard
          title="10 sách được mượn nhiều"
          description="Xếp theo lượt mượn trong khoảng đã chọn"
          :loading="loading"
          :empty="!hasTopBooks"
        >
          <div class="chart-canvas">
            <Bar
              :data="topBooksData"
              :options="loanOptions"
            />
          </div>
        </ChartCard>
        <ChartCard
          title="Lượt mượn theo thể loại"
          description="Trong khoảng thời gian đã chọn"
          :loading="loading"
          :empty="!hasCategories"
        >
          <div class="chart-canvas chart-canvas-doughnut">
            <Doughnut
              :data="categoriesData"
              :options="categoryOptions"
            />
          </div>
        </ChartCard>
      </div>

      <section class="surface-card action-card">
        <header class="action-heading">
          <div>
            <h2>Cần xử lý hôm nay</h2>
            <p class="mb-0 text-muted-strong">
              Các nhóm công việc cần nhân viên theo dõi
            </p>
          </div>
        </header>
        <div
          v-if="loading"
          class="action-loading"
          role="status"
        >
          Đang tải danh sách cần xử lý...
        </div>
        <div
          v-else-if="actionRows.every((item) => item.count === 0)"
          class="action-empty text-muted-strong"
        >
          Hiện không có công việc cần xử lý.
        </div>
        <div
          v-else
          class="table-responsive"
        >
          <table class="table align-middle mb-0 action-table">
            <thead>
              <tr>
                <th scope="col">
                  Công việc
                </th><th scope="col">
                  Số lượng
                </th><th scope="col">
                  <span class="visually-hidden">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in actionRows"
                v-show="item.count > 0"
                :key="item.label"
              >
                <td>
                  <i
                    class="bi me-2 text-primary"
                    :class="item.icon"
                    aria-hidden="true"
                  />{{ item.label }}
                </td>
                <td><strong>{{ formatNumber(item.count) }}</strong></td>
                <td class="text-end">
                  <RouterLink
                    class="btn btn-link btn-sm"
                    :to="item.route"
                  >
                    Xem danh sách
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.breadcrumb-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #6b7280;
  font-size: 0.825rem;
}

.dashboard-heading,
.dashboard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dashboard-heading > div:first-child p {
  margin-top: 0.35rem;
  font-size: 0.9rem;
}

.dashboard-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dashboard-grid {
  display: grid;
  gap: 1rem;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 1rem;
}

.charts-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 1rem;
}

.charts-grid > :last-child {
  grid-column: 1 / -1;
}

.chart-canvas {
  position: relative;
  height: 260px;
}

.chart-canvas-doughnut {
  max-width: 520px;
  margin: 0 auto;
}

.action-card {
  overflow: hidden;
}

.action-heading {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.action-heading h2 {
  margin: 0 0 0.3rem;
  font-size: 1rem;
  font-weight: 600;
}

.action-heading p,
.action-empty,
.action-loading {
  font-size: 0.85rem;
}

.action-empty,
.action-loading {
  padding: 1.5rem;
  text-align: center;
}

.action-table th {
  color: #6b7280;
  font-size: 0.8rem;
  font-weight: 600;
}

.action-table td {
  min-width: 130px;
}

.stat-skeleton {
  display: flex;
  min-height: 132px;
  align-items: center;
  padding: 1.1rem;
}

.stat-skeleton span {
  width: 70%;
  height: 1.25rem;
  border-radius: 0.35rem;
  background: #e5e7eb;
}

.dashboard-error {
  padding: 1.25rem;
  border-color: #fecaca;
}

@media (max-width: 1199.98px) {
  .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 767.98px) {
  .dashboard-heading,
  .dashboard-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-actions { width: 100%; }
  .dashboard-actions :deep(button) { width: 100%; }
  .stats-grid,
  .charts-grid { grid-template-columns: minmax(0, 1fr); }
  .charts-grid > :last-child { grid-column: auto; }
  .chart-canvas { height: 230px; }
}
</style>
