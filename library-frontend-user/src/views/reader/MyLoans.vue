<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import loanService from '@/services/loan.service';
import { useNotificationStore } from '@/stores/notification.store';
import LoanCard from '@/components/loan/LoanCard.vue';
import Pagination from '@/components/common/Pagination.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';

const route = useRoute();
const router = useRouter();
const notificationStore = useNotificationStore();

// --- Tabs ---
const tabs = [
  { key: 'all', label: 'Tất cả', icon: 'bi-list-ul', statuses: null },
  { key: 'pending', label: 'Chờ duyệt', icon: 'bi-hourglass-split', statuses: ['pending'] },
  { key: 'approved', label: 'Chờ nhận', icon: 'bi-check2-circle', statuses: ['approved'] },
  { key: 'borrowing', label: 'Đang mượn', icon: 'bi-book', statuses: ['borrowing'] },
  { key: 'overdue', label: 'Quá hạn', icon: 'bi-exclamation-triangle', statuses: ['overdue'] },
  { key: 'returned', label: 'Đã trả', icon: 'bi-check-all', statuses: ['returned'] },
  { key: 'other', label: 'Khác', icon: 'bi-three-dots', statuses: ['rejected', 'cancelled', 'expired'] },
];

// --- State ---
const activeTab = ref('all');
const loans = ref([]);
const renewals = ref([]);
const loading = ref(false);
const page = ref(1);
const meta = ref({ total: 0, totalPages: 1 });
const LIMIT = 10;

// --- Computed ---
const currentTab = computed(() => tabs.find((t) => t.key === activeTab.value) || tabs[0]);

const emptyConfig = computed(() => {
  const configs = {
    all: { icon: 'bi-journal-bookmark', title: 'Chưa có phiếu mượn nào', description: 'Hãy thêm sách vào giỏ và gửi yêu cầu mượn.' },
    pending: { icon: 'bi-hourglass-split', title: 'Không có phiếu chờ duyệt', description: 'Các yêu cầu mượn mới sẽ hiện ở đây.' },
    approved: { icon: 'bi-check2-circle', title: 'Không có phiếu chờ nhận', description: 'Phiếu đã duyệt chờ bạn đến nhận sách.' },
    borrowing: { icon: 'bi-book', title: 'Không có sách đang mượn', description: 'Sách bạn đang mượn sẽ hiện ở đây.' },
    overdue: { icon: 'bi-exclamation-triangle', title: 'Không có sách quá hạn', description: 'Tuyệt vời! Bạn không có sách nào quá hạn.' },
    returned: { icon: 'bi-check-all', title: 'Chưa trả sách nào', description: 'Lịch sử trả sách sẽ hiện ở đây.' },
    other: { icon: 'bi-three-dots', title: 'Không có phiếu nào', description: 'Các phiếu bị từ chối, đã hủy hoặc hết hạn sẽ hiện ở đây.' },
  };
  return configs[activeTab.value] || configs.all;
});

// --- Fetch ---
async function fetchRenewals() {
  try {
    const result = await loanService.getMyRenewals({ limit: 100 });
    renewals.value = result.renewals || [];
  } catch {
    renewals.value = [];
  }
}

async function fetchLoans() {
  loading.value = true;
  try {
    const tabInfo = currentTab.value;
    const params = { page: page.value, limit: LIMIT };

    // Fetch song song danh sách phiếu và danh sách gia hạn
    const fetchLoansPromise = (async () => {
      if (tabInfo.key === 'other') {
        const result = await loanService.getMyLoans({ page: params.page, limit: params.limit });
        const otherStatuses = ['rejected', 'cancelled', 'expired'];
        loans.value = (result.loans || []).filter((l) => otherStatuses.includes(l.status));
        meta.value = {
          total: loans.value.length,
          totalPages: 1,
        };
      } else {
        if (tabInfo.statuses) {
          params.status = tabInfo.statuses[0];
        }
        const result = await loanService.getMyLoans(params);
        loans.value = result.loans || [];
        meta.value = result.meta || { total: 0, totalPages: 1 };
      }
    })();

    await Promise.all([fetchLoansPromise, fetchRenewals()]);
  } catch {
    loans.value = [];
    meta.value = { total: 0, totalPages: 1 };
  } finally {
    loading.value = false;
  }
}

function getRenewalsForLoan(loanId) {
  return renewals.value.filter((r) => {
    const rLoanId = typeof r.loan === 'object' ? r.loan?._id : r.loan;
    return rLoanId === loanId;
  });
}

function switchTab(tabKey) {
  if (activeTab.value === tabKey) return;
  activeTab.value = tabKey;
  page.value = 1;
}

function handlePageChange(newPage) {
  page.value = newPage;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCancelled() {
  fetchLoans();
}

function handleRenewalChanged() {
  fetchLoans();
}

function goToCatalog() {
  router.push({ name: 'books' });
}

// --- Lifecycle ---
onMounted(() => {
  // Đọc tab từ query nếu có
  const tabFromQuery = route.query.tab;
  if (tabFromQuery && tabs.some((t) => t.key === tabFromQuery)) {
    activeTab.value = tabFromQuery;
  }
  fetchLoans();
});

watch(
  () => [notificationStore.lastLoanEvent, notificationStore.lastRenewalEvent],
  ([loanEvent, renewalEvent]) => {
    if (loanEvent || renewalEvent) {
      fetchLoans();
    }
  }
);

// Theo dõi thay đổi tab hoặc page → fetch lại
watch([activeTab, page], () => {
  fetchLoans();
  // Cập nhật query URL (không reload)
  router.replace({ query: { ...route.query, tab: activeTab.value } });
});
</script>

<template>
  <section class="my-loans-page py-4">
    <div class="container">
      <!-- Breadcrumb -->
      <nav aria-label="Đường dẫn">
        <ol class="breadcrumb mb-3">
          <li class="breadcrumb-item">
            <RouterLink :to="{ name: 'home' }">
              Trang chủ
            </RouterLink>
          </li>
          <li
            class="breadcrumb-item active"
            aria-current="page"
          >
            Lịch sử mượn sách
          </li>
        </ol>
      </nav>

      <!-- Tiêu đề -->
      <h1 class="h3 mb-4">
        <i
          class="bi bi-journal-bookmark-fill me-2 text-primary"
          aria-hidden="true"
        />
        Lịch sử mượn sách
      </h1>

      <!-- Tab navigation -->
      <nav class="loan-tabs mb-4">
        <ul
          class="nav nav-pills nav-fill flex-nowrap overflow-auto"
          role="tablist"
        >
          <li
            v-for="tab in tabs"
            :key="tab.key"
            class="nav-item"
            role="presentation"
          >
            <button
              class="nav-link d-flex align-items-center justify-content-center gap-1 text-nowrap"
              :class="{ active: activeTab === tab.key }"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.key"
              @click="switchTab(tab.key)"
            >
              <i
                class="bi"
                :class="tab.icon"
                aria-hidden="true"
              />
              <span>{{ tab.label }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Loading skeleton -->
      <div
        v-if="loading"
        class="loan-skeleton-list"
      >
        <SkeletonCard
          v-for="n in 3"
          :key="n"
          class="mb-3"
        />
      </div>

      <!-- Danh sách phiếu mượn -->
      <div v-else-if="loans.length > 0">
        <LoanCard
          v-for="loan in loans"
          :key="loan._id"
          :loan="loan"
          :renewals="getRenewalsForLoan(loan._id)"
          @cancelled="handleCancelled"
          @renewal-changed="handleRenewalChanged"
        />

        <!-- Phân trang -->
        <Pagination
          :page="page"
          :total-pages="meta.totalPages"
          :total="meta.total"
          @update:page="handlePageChange"
        />
      </div>

      <!-- Trạng thái rỗng -->
      <EmptyState
        v-else
        :icon="emptyConfig.icon"
        :title="emptyConfig.title"
        :description="emptyConfig.description"
        :action-label="activeTab === 'all' ? 'Khám phá danh mục sách' : ''"
        @action="goToCatalog"
      />
    </div>
  </section>
</template>

<style scoped>
.loan-tabs .nav-pills {
  gap: 0.25rem;
  scrollbar-width: thin;
}

.loan-tabs .nav-link {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: #495057;
  transition: all 0.15s ease;
}

.loan-tabs .nav-link:hover:not(.active) {
  background-color: #f1f3f5;
}

.loan-tabs .nav-link.active {
  background-color: #0d6efd;
  color: #ffffff;
}

.loan-tabs .nav-link .bi {
  font-size: 0.9rem;
}

@media (max-width: 767.98px) {
  .loan-tabs .nav-pills {
    padding-bottom: 4px;
  }

  .loan-tabs .nav-link {
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
  }
}
</style>

