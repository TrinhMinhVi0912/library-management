<script setup>
import { onMounted, watch } from 'vue';
import AppFooter from '@/components/common/AppFooter.vue';
import AppNavbar from '@/components/common/AppNavbar.vue';
import RealtimeToast from '@/components/common/RealtimeToast.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useNotificationStore } from '@/stores/notification.store';

const auth = useAuthStore();
const cartStore = useCartStore();
const notificationStore = useNotificationStore();

onMounted(async () => {
  if (!auth.initialized) {
    await auth.restoreSession();
  }
  if (auth.isAuthenticated && auth.role === 'reader') {
    cartStore.fetchCart();
    notificationStore.initSocket(auth.accessToken, () => auth.refresh());
    notificationStore.sync();
  }
});

watch(
  () => auth.isAuthenticated,
  (isAuth) => {
    if (isAuth && auth.role === 'reader') {
      cartStore.fetchCart();
      notificationStore.initSocket(auth.accessToken, () => auth.refresh());
      notificationStore.sync();
    } else {
      cartStore.clearCart();
      notificationStore.disconnectSocket();
    }
  }
);
</script>

<template>
  <div class="public-layout">
    <AppNavbar :cart-count="cartStore.count" />
    <main
      id="main-content"
      class="public-main"
    >
      <RouterView v-slot="{ Component, route }">
        <Transition
          name="page-fade"
          mode="out-in"
        >
          <component
            :is="Component"
            :key="route.path"
          />
        </Transition>
      </RouterView>
    </main>
    <AppFooter />
    <RealtimeToast />
  </div>
</template>

<style scoped>
.public-layout {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: #ffffff;
}

.public-main {
  flex: 1;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
