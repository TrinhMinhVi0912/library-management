<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  title: { type: String, default: 'Quản trị thư viện' },
  user: { type: Object, default: null },
  unreadCount: { type: Number, default: 0 },
});

defineEmits(['toggleMenu', 'toggleCollapse', 'logout']);

const profileOpen = ref(false);
const displayName = computed(() => [props.user?.firstName, props.user?.lastName].filter(Boolean).join(' ') || props.user?.email || 'Tài khoản');
const initial = computed(() => displayName.value.trim().charAt(0).toLocaleUpperCase('vi') || 'T');
</script>

<template>
  <header class="admin-topbar">
    <div class="topbar-leading">
      <button
        class="icon-button mobile-menu"
        type="button"
        aria-label="Mở menu"
        @click="$emit('toggleMenu')"
      >
        <i
          class="bi bi-list"
          aria-hidden="true"
        />
      </button>
      <button
        class="icon-button desktop-collapse"
        type="button"
        aria-label="Thu gọn menu"
        @click="$emit('toggleCollapse')"
      >
        <i
          class="bi bi-layout-sidebar-inset"
          aria-hidden="true"
        />
      </button>
      <h1 class="topbar-title">
        {{ title }}
      </h1>
    </div>

    <div class="topbar-actions">
      <RouterLink
        class="icon-button notification-button"
        to="/admin/notifications"
        aria-label="Mở thông báo"
      >
        <i
          class="bi bi-bell"
          aria-hidden="true"
        />
        <span
          v-if="unreadCount"
          class="notification-count"
        >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </RouterLink>
      <div class="profile-menu">
        <button
          class="profile-trigger"
          type="button"
          :aria-expanded="profileOpen"
          aria-haspopup="menu"
          @click="profileOpen = !profileOpen"
        >
          <span
            class="user-avatar"
            aria-hidden="true"
          >{{ initial }}</span>
          <span class="profile-name">{{ displayName }}</span>
          <i
            class="bi bi-chevron-down"
            aria-hidden="true"
          />
        </button>
        <div
          v-if="profileOpen"
          class="profile-dropdown"
          role="menu"
        >
          <div class="profile-summary">
            <strong>{{ displayName }}</strong>
            <span>{{ user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }}</span>
          </div>
          <button
            class="dropdown-action"
            type="button"
            role="menuitem"
            @click="$emit('logout')"
          >
            <i
              class="bi bi-box-arrow-right"
              aria-hidden="true"
            /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.admin-topbar {
  position: sticky;
  z-index: 1010;
  top: 0;
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.topbar-leading,
.topbar-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.topbar-title {
  overflow: hidden;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-button {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 1.1rem;
}

.icon-button:hover {
  border-color: #e5e7eb;
  background: #f8f9fa;
}

.mobile-menu {
  display: none;
}

.notification-count {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 17px;
  padding: 0 0.2rem;
  border-radius: 999px;
  background: #dc2626;
  color: #ffffff;
  font-size: 0.65rem;
  line-height: 17px;
  text-align: center;
}

.profile-menu {
  position: relative;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  background: transparent;
  color: #111827;
}

.user-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: #f8f9fa;
  color: #1d4ed8;
  font-weight: 600;
}

.profile-name {
  max-width: 180px;
  overflow: hidden;
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 0.65rem);
  right: 0;
  z-index: 1030;
  width: 230px;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.profile-summary {
  display: grid;
  gap: 0.2rem;
  padding: 0.6rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.85rem;
}

.profile-summary span {
  color: #6b7280;
}

.dropdown-action {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #dc2626;
  text-align: left;
}

.dropdown-action:hover {
  background: #f8f9fa;
}

@media (max-width: 767.98px) {
  .admin-topbar {
    min-height: 58px;
    padding: 0 0.75rem;
  }

  .mobile-menu {
    display: grid;
  }

  .desktop-collapse,
  .profile-name,
  .profile-trigger > .bi-chevron-down {
    display: none;
  }
}
</style>
