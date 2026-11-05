import { defineStore } from 'pinia';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    pendingLoans: 0,
    pendingRenewals: 0,
    unreadCount: 0,
    latest: [],
  }),
  getters: {
    pendingCount: (state) => state.pendingLoans + state.pendingRenewals,
  },
  actions: {
    setCounters(counters = {}) {
      this.pendingLoans = Number(counters.pendingLoans) || 0;
      this.pendingRenewals = Number(counters.pendingRenewals) || 0;
    },
    setUnreadCount(count) {
      this.unreadCount = Number(count) || 0;
    },
    addNotification(notification) {
      if (!notification?._id) return;
      this.latest = [notification, ...this.latest.filter((item) => item._id !== notification._id)].slice(0, 5);
      this.unreadCount += 1;
    },
  },
});
