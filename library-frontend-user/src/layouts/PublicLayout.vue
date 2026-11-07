<script setup>
import { onMounted } from 'vue';
import AppFooter from '@/components/common/AppFooter.vue';
import AppNavbar from '@/components/common/AppNavbar.vue';
import { useAuthStore } from '@/stores/auth.store';

const auth = useAuthStore();

onMounted(() => {
  if (!auth.initialized) void auth.restoreSession();
});
</script>

<template>
  <div class="public-layout">
    <AppNavbar />
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
