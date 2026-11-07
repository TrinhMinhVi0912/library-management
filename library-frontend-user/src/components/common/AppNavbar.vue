<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import SearchBar from '@/components/common/SearchBar.vue';
import NotificationBell from '@/components/common/NotificationBell.vue';
import { useAuthStore } from '@/stores/auth.store';
import { formatMoney } from '@/utils/format';

const props = defineProps({
  cartCount: { type: Number, default: 0 },
  unreadCount: { type: Number, default: 0 },
});

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const searchText = ref(String(route.query.q || ''));
const searchScope = ref(String(route.query.scope || 'all'));
const navOpen = ref(false);
const accountMenu = ref(null);

const fullName = computed(() => [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(' ') || auth.user?.email || 'Tài khoản');
const initials = computed(() => fullName.value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN') || 'TV');
const roleLabel = computed(() => ({ reader: 'Độc giả', staff: 'Nhân viên', admin: 'Quản trị viên' })[auth.role] || 'Khách');
const unpaidFineTotal = computed(() => Number(auth.user?.unpaidFineTotal || 0));
const hasFineDebt = computed(() => auth.isAuthenticated && auth.role === 'reader' && unpaidFineTotal.value > 0);

watch(() => [route.query.q, route.query.scope], ([query, scope]) => {
  searchText.value = String(query || '');
  searchScope.value = String(scope || 'all');
});

function closeNavigation() {
  navOpen.value = false;
}

function closeAccountMenu() {
  if (accountMenu.value) accountMenu.value.open = false;
  closeNavigation();
}

function runSearch(value = searchText.value) {
  searchText.value = String(value || '').trim();
  const query = {};
  if (searchText.value) query.q = searchText.value;
  if (searchScope.value !== 'all') query.scope = searchScope.value;
  closeAccountMenu();
  router.push({ name: 'books', query });
}

async function logout() {
  closeAccountMenu();
  try {
    await auth.logout();
  } catch {
    toast.error('Phiên đã được xóa trên thiết bị này nhưng máy chủ chưa xác nhận đăng xuất.');
  } finally {
    router.push({ name: 'home' });
  }
}
</script>

<template>
  <header class="public-header">
    <nav
      class="navbar navbar-expand-lg public-navbar"
      aria-label="Điều hướng chính"
    >
      <div class="container-xl navbar-container">
        <RouterLink
          class="navbar-brand library-brand"
          :to="{ name: 'home' }"
          @click="closeNavigation"
        >
          <span class="brand-mark"><i
            class="bi bi-book-half"
            aria-hidden="true"
          /></span>
          <span>Thư viện</span>
        </RouterLink>

        <button
          class="navbar-toggler"
          type="button"
          aria-label="Mở hoặc đóng menu"
          aria-controls="public-navigation"
          :aria-expanded="navOpen"
          @click="navOpen = !navOpen"
        >
          <span class="navbar-toggler-icon" />
        </button>

        <div
          id="public-navigation"
          class="collapse navbar-collapse"
          :class="{ show: navOpen }"
        >
          <div class="primary-links">
            <RouterLink
              class="nav-link"
              :to="{ name: 'books' }"
              @click="closeNavigation"
            >
              Danh mục
            </RouterLink>
            <RouterLink
              class="nav-link"
              :to="{ name: 'forum' }"
              @click="closeNavigation"
            >
              Diễn đàn
            </RouterLink>
          </div>

          <form
            class="navbar-search-form"
            role="search"
            @submit.prevent="runSearch()"
          >
            <label
              class="visually-hidden"
              for="quick-search-scope"
            >Phạm vi tìm sách</label>
            <select
              id="quick-search-scope"
              v-model="searchScope"
              class="form-select search-scope"
            >
              <option value="all">
                Tất cả
              </option>
              <option value="title">
                Tên sách
              </option>
              <option value="author">
                Tác giả
              </option>
            </select>
            <SearchBar
              v-model="searchText"
              class="quick-search"
              label="Tìm sách"
              placeholder="Tìm sách..."
              @search="runSearch"
            />
          </form>

          <div class="account-actions">
            <RouterLink
              class="nav-action cart-action position-relative"
              :class="{ 'has-fine-debt': hasFineDebt }"
              :to="{ name: 'cart' }"
              :aria-label="`Giỏ mượn, ${Math.max(0, props.cartCount)} sách${hasFineDebt ? ', tài khoản bị khóa mượn do nợ phạt' : ''}`"
              :title="hasFineDebt ? 'Tài khoản đang bị tạm khóa mượn do nợ tiền phạt' : undefined"
              @click="closeNavigation"
            >
              <i
                class="bi bi-basket3"
                aria-hidden="true"
              />
              <span class="action-label">Giỏ mượn</span>
              <span class="count-badge">{{ Math.max(0, props.cartCount) }}</span>
              <span
                v-if="hasFineDebt"
                class="fine-debt-indicator"
                aria-hidden="true"
              >
                <i class="bi bi-lock-fill" />
              </span>
            </RouterLink>
            <NotificationBell v-if="auth.isAuthenticated && auth.role === 'reader'" />

            <details
              ref="accountMenu"
              class="account-menu"
            >
              <summary class="account-trigger">
                <span
                  class="account-avatar"
                  aria-hidden="true"
                >
                  <img
                    v-if="auth.user?.avatar?.url"
                    :src="auth.user.avatar.url"
                    :alt="fullName"
                    class="avatar-img"
                  >
                  <span v-else>{{ initials }}</span>
                </span>
                <span class="account-name">{{ auth.isAuthenticated ? fullName : 'Tài khoản' }}</span>
                <i
                  class="bi bi-chevron-down"
                  aria-hidden="true"
                />
              </summary>
              <div class="account-menu-panel">
                <template v-if="auth.isAuthenticated">
                  <div class="account-summary">
                    <strong>{{ fullName }}</strong>
                    <span>{{ roleLabel }}</span>
                  </div>
                  <template v-if="auth.role === 'reader'">
                    <RouterLink
                      :to="{ name: 'profile' }"
                      @click="closeAccountMenu"
                    >
                      Hồ sơ
                    </RouterLink>
                    <RouterLink
                      :to="{ name: 'my-loans' }"
                      @click="closeAccountMenu"
                    >
                      Lịch sử mượn
                    </RouterLink>
                    <RouterLink
                      :to="{ name: 'my-fines' }"
                      class="fine-menu-link d-flex align-items-center justify-content-between"
                      @click="closeAccountMenu"
                    >
                      <span>Phạt của tôi</span>
                      <span
                        v-if="hasFineDebt"
                        class="badge bg-danger rounded-pill ms-1"
                        title="Tiền phạt chưa thanh toán"
                      >
                        {{ formatMoney(unpaidFineTotal) }}
                      </span>
                    </RouterLink>
                    <RouterLink
                      :to="{ name: 'my-shelves' }"
                      @click="closeAccountMenu"
                    >
                      Kệ sách của tôi
                    </RouterLink>
                    <RouterLink
                      :to="{ name: 'my-reviews' }"
                      @click="closeAccountMenu"
                    >
                      Đánh giá của tôi
                    </RouterLink>
                    <RouterLink
                      :to="{ name: 'notifications' }"
                      @click="closeAccountMenu"
                    >
                      Thông báo
                    </RouterLink>
                  </template>
                  <button
                    class="account-logout"
                    type="button"
                    @click="logout"
                  >
                    Đăng xuất
                  </button>
                </template>
                <template v-else>
                  <RouterLink
                    :to="{ name: 'login' }"
                    @click="closeAccountMenu"
                  >
                    Đăng nhập
                  </RouterLink>
                  <RouterLink
                    :to="{ name: 'register' }"
                    @click="closeAccountMenu"
                  >
                    Đăng ký
                  </RouterLink>
                </template>
              </div>
            </details>
          </div>
        </div>
      </div>
    </nav>

    <!-- Banner cảnh báo khóa mượn khi còn nợ phạt -->
    <div
      v-if="hasFineDebt"
      class="fine-warning-banner"
      role="alert"
    >
      <div class="container-xl d-flex align-items-center justify-content-between flex-wrap gap-2 py-1 px-3">
        <div class="banner-content d-flex align-items-center gap-2">
          <i
            class="bi bi-exclamation-triangle-fill text-danger flex-shrink-0"
            aria-hidden="true"
          />
          <span class="banner-text">
            Tài khoản đang bị <strong>tạm khóa mượn</strong> do còn nợ tiền phạt
            <strong class="text-danger">{{ formatMoney(unpaidFineTotal) }}</strong>.
            Vui lòng nộp phạt tại quầy thư viện để tiếp tục mượn sách.
          </span>
        </div>
        <RouterLink
          :to="{ name: 'my-fines' }"
          class="btn btn-sm btn-outline-danger banner-link"
        >
          <i
            class="bi bi-receipt me-1"
            aria-hidden="true"
          />
          Xem khoản phạt
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.public-header {
  position: relative;
  z-index: 20;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.navbar-container {
  gap: 1rem;
}

.library-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  margin-right: 0.75rem;
  color: #111827;
  font-size: 1.125rem;
  font-weight: 700;
}

.brand-mark {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.5rem;
  background: #f8f9fa;
  color: #2563eb;
  font-size: 1.25rem;
}

.navbar-collapse {
  align-items: center;
  gap: 1rem;
}

.primary-links,
.account-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-link,
.nav-action,
.account-trigger {
  color: #374151;
  text-decoration: none;
}

.nav-link:hover,
.nav-action:hover,
.account-trigger:hover {
  color: #1d4ed8;
}

.navbar-search-form {
  display: flex;
  flex: 1 1 22rem;
  align-items: center;
  gap: 0.5rem;
  max-width: 34rem;
  margin: 0 auto;
}

.search-scope {
  width: auto;
  min-width: 7rem;
}

.quick-search {
  flex: 1;
  min-width: 0;
}

.account-actions {
  gap: 0.5rem;
}

.nav-action {
  position: relative;
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.875rem;
  white-space: nowrap;
}

.nav-action > i {
  font-size: 1.1rem;
}

.count-badge {
  display: inline-flex;
  min-width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 600;
}

.account-menu {
  position: relative;
}

.account-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem;
  cursor: pointer;
  list-style: none;
}

.account-trigger::-webkit-details-marker {
  display: none;
}

.account-avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 50%;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.account-name {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-menu-panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.5rem);
  right: 0;
  display: grid;
  width: 15rem;
  gap: 0.15rem;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #ffffff;
}

.account-menu-panel a,
.account-logout {
  padding: 0.55rem 0.65rem;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  color: #374151;
  text-align: left;
  text-decoration: none;
}

.account-menu-panel a:hover,
.account-logout:hover {
  background: #f8f9fa;
  color: #1d4ed8;
}

.account-summary {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0.35rem;
  padding: 0.55rem 0.65rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.account-summary span {
  color: #6b7280;
  font-size: 0.8rem;
}

.account-logout {
  border-top: 1px solid #e5e7eb;
  color: #dc2626;
}

.fine-debt-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #ef4444;
  color: #ffffff;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  box-shadow: 0 0 0 2px #ffffff;
}

.fine-warning-banner {
  background-color: #fef2f2;
  border-bottom: 1px solid #fee2e2;
  font-size: 0.85rem;
  color: #991b1b;

  .banner-text {
    line-height: 1.4;
  }

  .banner-link {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
  }
}

.fine-menu-link {
  .badge {
    font-size: 0.7rem;
    font-weight: 600;
  }
}

@media (max-width: 991.98px) {
  .navbar-container {
    flex-wrap: wrap;
  }

  .navbar-collapse.show {
    display: flex;
    align-items: stretch;
    flex-basis: 100%;
    flex-direction: column;
    padding: 0.75rem 0 1rem;
  }

  .navbar-collapse.show > *,
  .primary-links,
  .account-actions {
    width: 100%;
  }

  .primary-links,
  .account-actions {
    flex-wrap: wrap;
  }

  .navbar-search-form {
    flex: 1 1 auto;
    max-width: none;
    margin: 0.5rem 0;
  }

  .account-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 575.98px) {
  .action-label,
  .account-name {
    display: inline;
  }

  .account-menu-panel {
    right: auto;
    left: 0;
  }
}
</style>
