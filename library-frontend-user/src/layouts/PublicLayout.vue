<script setup>
import { onMounted, watch } from 'vue';
import AppFooter from '@/components/common/AppFooter.vue';
import AppNavbar from '@/components/common/AppNavbar.vue';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';

const auth = useAuthStore();
const cartStore = useCartStore();

onMounted(async () => {
  if (!auth.initialized) {
    await auth.restoreSession();
  }
  if (auth.isAuthenticated && auth.role === 'reader') {
    cartStore.fetchCart();
  }
});

watch(
  () => auth.isAuthenticated,
  (isAuth) => {
    if (isAuth && auth.role === 'reader') {
      cartStore.fetchCart();
    } else {
      cartStore.clearCart();
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
      <RouterView />
    </main>
    <AppFooter />
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
</style>
