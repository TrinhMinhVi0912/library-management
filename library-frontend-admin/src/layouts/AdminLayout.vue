<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import AdminSidebar from '@/components/admin/AdminSidebar.vue';
import AdminTopbar from '@/components/admin/AdminTopbar.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { useUiStore } from '@/stores/ui.store';
import { getCounters, getUnreadCount } from '@/services/admin.service';
import { connectSocket, onSocketEvent } from '@/services/socket.service';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const notifications = useNotificationStore();
const ui = useUiStore();
const toast = useToast();
const title = computed(() => route.meta.title || 'Quản trị thư viện');
const unlisten = [];

onMounted(async () => {
  unlisten.push(onSocketEvent('staff:counters', notifications.setCounters));
  unlisten.push(onSocketEvent('notification:new', notifications.addNotification));
  connectSocket();
  const [counterResult, unreadResult] = await Promise.allSettled([getCounters(), getUnreadCount()]);
  if (counterResult.status === 'fulfilled') notifications.setCounters(counterResult.value);
  else toast.error('Không tải được số yêu cầu đang chờ. Vui lòng thử lại.');
  if (unreadResult.status === 'fulfilled') notifications.setUnreadCount(unreadResult.value);
  else toast.error('Không tải được số thông báo. Vui lòng thử lại.');
});

onBeforeUnmount(() => unlisten.forEach((stop) => stop()));

async function handleLogout() {
  try {
    await auth.logout();
  } catch {
    toast.error('Đã xóa phiên đăng nhập trên thiết bị này.');
  } finally {
    ui.closeSidebar();
    await router.replace({ name: 'admin-login' });
  }
}
</script>

<template>
  <div
    class="admin-shell"
    :class="{ 'sidebar-collapsed': ui.sidebarCollapsed }"
  >
    <div
      v-if="ui.sidebarOpen"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="ui.closeSidebar()"
    />
    <AdminSidebar
      :collapsed="ui.sidebarCollapsed"
      :mobile-open="ui.sidebarOpen"
      :is-admin="auth.isAdmin"
      :pending-loans="notifications.pendingLoans"
      :pending-renewals="notifications.pendingRenewals"
      @navigate="ui.closeSidebar()"
    />
    <div class="admin-main">
      <AdminTopbar
        :title="title"
        :user="auth.user"
        :unread-count="notifications.unreadCount"
        @toggle-menu="ui.openSidebar()"
        @toggle-collapse="ui.toggleCollapsed()"
        @logout="handleLogout"
      />
      <main
        id="main-content"
        class="admin-content"
        tabindex="-1"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-shell {
  display: flex;
  min-height: 100vh;
}

.admin-main {
  min-width: 0;
  flex: 1;
}

.admin-content {
  padding: 1.5rem;
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 767.98px) {
  .admin-content {
    padding: 1rem;
  }

  .sidebar-backdrop {
    position: fixed;
    z-index: 1020;
    inset: 0;
    display: block;
    background: rgba(17, 24, 39, 0.35);
  }
}
</style>
