import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    loading: false,
    sidebarOpen: false,
  }),
  actions: {
    setLoading(value) {
      this.loading = Boolean(value);
    },
    openSidebar() {
      this.sidebarOpen = true;
    },
    closeSidebar() {
      this.sidebarOpen = false;
    },
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },
  },
});
