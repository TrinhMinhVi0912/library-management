<script setup>
import { computed } from 'vue';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  pendingLoans: { type: Number, default: 0 },
  pendingRenewals: { type: Number, default: 0 },
});

defineEmits(['navigate']);

const mainLinks = [
  { to: '/admin', label: 'Tổng quan', icon: 'bi-speedometer2', exact: true },
  { to: '/admin/requests', label: 'Duyệt yêu cầu mượn', icon: 'bi-inbox', counter: 'loans' },
  { to: '/admin/handover', label: 'Giao sách', icon: 'bi-box-arrow-up-right' },
  { to: '/admin/returns', label: 'Nhận trả sách', icon: 'bi-arrow-return-left' },
  { to: '/admin/renewals', label: 'Duyệt gia hạn', icon: 'bi-calendar2-check', counter: 'renewals' },
  { to: '/admin/loans', label: 'Phiếu mượn', icon: 'bi-journal-text' },
  { to: '/admin/fines', label: 'Quản lý phạt', icon: 'bi-cash-coin' },
  { to: '/admin/books', label: 'Quản lý sách', icon: 'bi-book' },
  { to: '/admin/catalog', label: 'Danh mục', icon: 'bi-tags' },
  { to: '/admin/users', label: 'Người dùng', icon: 'bi-people' },
  { to: '/admin/notifications', label: 'Thông báo', icon: 'bi-bell' },
  { to: '/admin/forum', label: 'Kiểm duyệt diễn đàn', icon: 'bi-chat-square-text' },
];

const adminLinks = [
  { to: '/admin/staff', label: 'Quản lý nhân viên', icon: 'bi-person-gear' },
  { to: '/admin/settings', label: 'Cài đặt', icon: 'bi-gear' },
  { to: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: 'bi-clock-history' },
];

const links = computed(() => (props.isAdmin ? [...mainLinks, ...adminLinks] : mainLinks));

function countFor(link) {
  if (link.counter === 'loans') return props.pendingLoans;
  if (link.counter === 'renewals') return props.pendingRenewals;
  return 0;
}
</script>

<template>
  <aside
    class="admin-sidebar"
    :class="{ 'is-collapsed': collapsed, 'is-mobile-open': mobileOpen }"
    aria-label="Điều hướng quản trị"
  >
    <RouterLink
      class="brand"
      to="/admin"
      aria-label="Quản trị thư viện, trang tổng quan"
      @click="$emit('navigate')"
    >
      <span class="brand-mark"><i
        class="bi bi-book-half"
        aria-hidden="true"
      /></span>
      <span
        v-if="!collapsed"
        class="brand-name"
      >Thư viện</span>
    </RouterLink>

    <nav class="sidebar-nav">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="nav-link"
        :class="{ 'nav-link-exact': link.exact }"
        :title="collapsed ? link.label : undefined"
        :aria-label="collapsed ? link.label : undefined"
        @click="$emit('navigate')"
      >
        <i
          class="nav-icon bi"
          :class="link.icon"
          aria-hidden="true"
        />
        <span
          v-if="!collapsed"
          class="nav-label"
        >{{ link.label }}</span>
        <span
          v-if="link.counter && countFor(link) > 0 && !collapsed"
          class="counter-badge"
          :aria-label="`${countFor(link)} yêu cầu đang chờ`"
        >{{ countFor(link) > 99 ? '99+' : countFor(link) }}</span>
        <span
          v-else-if="link.counter && countFor(link) > 0"
          class="counter-dot"
          :aria-label="`${countFor(link)} yêu cầu đang chờ`"
        />
      </RouterLink>
    </nav>
    <div
      v-if="!collapsed"
      class="sidebar-role"
    >
      {{ isAdmin ? 'Quản trị viên' : 'Nhân viên' }}
    </div>
  </aside>
</template>

<style scoped lang="scss">
.admin-sidebar {
  position: sticky;
  top: 0;
  z-index: 1021;
  display: flex;
  width: 248px;
  height: 100vh;
  flex: 0 0 auto;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  transition: width 0.15s ease;
}

.admin-sidebar.is-collapsed {
  width: 72px;
}

.brand {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  font-size: 1.05rem;
  font-weight: 650;
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: #f8f9fa;
  color: #2563eb;
}

.sidebar-nav {
  display: grid;
  gap: 0.2rem;
  overflow-y: auto;
  padding: 0.75rem;
}

.nav-link {
  position: relative;
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  color: #6b7280;
  font-size: 0.9rem;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.router-link-active,
.nav-link.router-link-exact-active {
  background: #f8f9fa;
  color: #1d4ed8;
}

.nav-link-exact:not(.router-link-exact-active) {
  background: transparent;
  color: #6b7280;
}

.nav-icon {
  width: 22px;
  flex: 0 0 auto;
  font-size: 1.05rem;
  text-align: center;
}

.nav-label {
  min-width: 0;
  flex: 1;
}

.counter-badge,
.counter-dot {
  flex: 0 0 auto;
  background: #dc2626;
  color: #ffffff;
}

.counter-badge {
  min-width: 22px;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.72rem;
  text-align: center;
}

.counter-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.sidebar-role {
  margin-top: auto;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.8rem;
}

@media (max-width: 767.98px) {
  .admin-sidebar,
  .admin-sidebar.is-collapsed {
    position: fixed;
    left: 0;
    width: min(280px, 85vw);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .admin-sidebar.is-mobile-open {
    transform: translateX(0);
  }

  .admin-sidebar.is-collapsed .brand-name,
  .admin-sidebar.is-collapsed .nav-label,
  .admin-sidebar.is-collapsed .sidebar-role {
    display: initial;
  }
}
</style>
