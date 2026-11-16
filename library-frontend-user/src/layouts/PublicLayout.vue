<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppFooter from '@/components/common/AppFooter.vue';
import AppNavbar from '@/components/common/AppNavbar.vue';
import RealtimeToast from '@/components/common/RealtimeToast.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useNotificationStore } from '@/stores/notification.store';

const auth = useAuthStore();
const cartStore = useCartStore();
const notificationStore = useNotificationStore();
const currentRoute = useRoute();
const isAuthRoute = computed(() => ['login', 'register', 'forgot-password', 'reset-password'].includes(currentRoute.name));

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
  <div
    class="public-layout"
    :class="{ 'public-layout--auth': isAuthRoute }"
  >
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
  background: #041321;
}

.public-layout--auth,
.public-layout--auth .public-main {
  background-color: #03172a;
}

.public-main {
  flex: 1;
  background-color: #041321;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
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
