<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  pendingLoans: { type: Number, default: 0 },
  pendingRenewals: { type: Number, default: 0 },
});
const route = useRoute();

defineEmits(['navigate']);

const mainGroups = [
  {
    label: 'TỔNG QUAN',
    links: [
      { to: '/admin', label: 'Tổng quan', icon: 'bi-speedometer2', exact: true },
    ],
  },
  {
    label: 'MƯỢN VÀ TRẢ SÁCH',
    links: [
      { to: '/admin/requests', label: 'Duyệt yêu cầu mượn', icon: 'bi-inbox', counter: 'loans' },
      { to: '/admin/handover', label: 'Giao sách', icon: 'bi-box-arrow-up-right' },
      { to: '/admin/returns', label: 'Nhận trả sách', icon: 'bi-arrow-return-left' },
      { to: '/admin/renewals', label: 'Duyệt gia hạn', icon: 'bi-calendar2-check', counter: 'renewals' },
      { to: '/admin/loans', label: 'Phiếu mượn', icon: 'bi-journal-text' },
      { to: '/admin/fines', label: 'Quản lý phạt', icon: 'bi-cash-coin' },
    ],
  },
  {
    label: 'KHO SÁCH',
    links: [
      { to: '/admin/books', label: 'Quản lý sách', icon: 'bi-book' },
      { to: '/admin/catalog', label: 'Danh mục', icon: 'bi-tags' },
    ],
  },
  {
    label: 'ĐỘC GIẢ VÀ CỘNG ĐỒNG',
    links: [
      { to: '/admin/users', label: 'Người dùng', icon: 'bi-people' },
      { to: '/admin/forum', label: 'Kiểm duyệt diễn đàn', icon: 'bi-chat-square-text' },
      { to: '/admin/forum/moderation', label: 'Duyệt bài mới', icon: 'bi-shield-check' },
    ],
  },
  {
    label: 'THÔNG TIN',
    links: [
      { to: '/admin/notifications', label: 'Thông báo', icon: 'bi-bell' },
    ],
  },
];

const adminGroups = [
  {
    label: 'QUẢN TRỊ HỆ THỐNG',
    links: [
      { to: '/admin/staff', label: 'Quản lý nhân viên', icon: 'bi-person-gear' },
      { to: '/admin/settings', label: 'Cài đặt', icon: 'bi-gear' },
      { to: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: 'bi-clock-history' },
    ],
  },
];

const groups = computed(() => (props.isAdmin ? [...mainGroups, ...adminGroups] : mainGroups));

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
      <section
        v-for="group in groups"
        :key="group.label"
        class="nav-group"
        :aria-label="group.label"
      >
        <h2
          v-if="!collapsed"
          class="nav-group-title"
        >
          {{ group.label }}
        </h2>
        <RouterLink
          v-for="link in group.links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :class="{
            'nav-link-exact': link.exact,
            'is-manually-active': link.to === '/admin/books' && route.path.startsWith('/admin/books'),
          }"
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
      </section>
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
  width: 284px;
  height: 100vh;
  flex: 0 0 auto;
  flex-direction: column;
  border-right: 1px solid #174c7d;
  background: linear-gradient(165deg, #082b55 0%, #0b3b70 52%, #08264d 100%);
  transition: width 0.2s ease, background-color 0.2s ease;
}

.admin-sidebar.is-collapsed {
  width: 76px;
}

.brand {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid rgba(157, 211, 255, 0.2);
  color: #f2f8ff;
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
  background: linear-gradient(145deg, #43c5e8, #8bdcff);
  color: #07305c;
}

.sidebar-nav {
  display: grid;
  align-content: start;
  gap: 0.8rem;
  overflow-y: auto;
  padding: 0.75rem;
}

.nav-group {
  display: grid;
  gap: 0.2rem;
}

.nav-group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0.15rem;
  padding: 0 0.65rem;
  color: #8fb9df;
  font-size: 0.65rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  line-height: 1.3;
}

.nav-group-title::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #55d4f2;
  box-shadow: 0 0 8px rgba(85, 212, 242, 0.65);
  content: '';
}

.nav-link {
  position: relative;
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  color: #d4e7fa;
  font-size: 0.9rem;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.router-link-active,
.nav-link.router-link-exact-active,
.nav-link.is-manually-active {
  background: rgba(87, 190, 238, 0.16);
  color: #8de5ff;
  box-shadow: inset 3px 0 0 #58d2f2, 0 3px 10px rgba(0, 16, 38, 0.16);
}

.nav-link-exact:not(.router-link-exact-active) {
  background: transparent;
  color: #d4e7fa;
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
  border-top: 1px solid rgba(157, 211, 255, 0.2);
  color: #b8d4ee;
  font-size: 0.8rem;
}

@media (max-width: 767.98px) {
  .admin-sidebar,
  .admin-sidebar.is-collapsed {
    position: fixed;
    left: 0;
    width: min(300px, 85vw);
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
