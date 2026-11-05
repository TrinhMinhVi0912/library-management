import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    sidebarOpen: false,
  }),
  actions: {
    toggleCollapsed() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    openSidebar() {
      this.sidebarOpen = true;
    },
    closeSidebar() {
      this.sidebarOpen = false;
    },
  },
});
