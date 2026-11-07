import { defineStore } from 'pinia';
import loanService from '@/services/loan.service';
import { useAuthStore } from '@/stores/auth.store';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
    maxBooks: 5,
  }),

  getters: {
    count: (state) => state.items.length,

    itemIds: (state) => state.items.map((item) => item.book?._id || item.book).filter(Boolean),

    isInCart: (state) => (bookId) => {
      if (!bookId) return false;
      const targetId = String(bookId);
      return state.items.some((item) => String(item.book?._id || item.book) === targetId);
    },

    unavailableItems: (state) => {
      return state.items.filter((item) => {
        if (!item.book) return true;
        if (item.available === false) return true;
        if (item.book.status !== 'active') return true;
        return Number(item.book.availableCopies || 0) <= 0;
      });
    },

    hasUnavailable() {
      return this.unavailableItems.length > 0;
    },

    unavailableCount() {
      return this.unavailableItems.length;
    },
  },

  actions: {
    async fetchCart() {
      const auth = useAuthStore();
      if (!auth.isAuthenticated || auth.role !== 'reader') {
        this.items = [];
        return;
      }

      this.loading = true;
      this.error = null;
      try {
        const data = await loanService.getCart();
        this.items = Array.isArray(data?.items) ? data.items : [];
      } catch (err) {
        this.error = err?.response?.data?.message || err?.message || 'Không thể tải giỏ mượn';
        this.items = [];
      } finally {
        this.loading = false;
      }
    },

    async addToCart(bookId) {
      const auth = useAuthStore();
      if (!auth.isAuthenticated || auth.role !== 'reader') {
        return { success: false, requiresAuth: true };
      }

      this.loading = true;
      this.error = null;
      try {
        const data = await loanService.addToCart(bookId);
        this.items = Array.isArray(data?.items) ? data.items : [];
        return { success: true };
      } catch (err) {
        const message = err?.response?.data?.message || err?.message || 'Không thể thêm sách vào giỏ mượn';
        this.error = message;
        return { success: false, message };
      } finally {
        this.loading = false;
      }
    },

    async removeFromCart(bookId) {
      this.loading = true;
      this.error = null;
      try {
        const data = await loanService.removeFromCart(bookId);
        this.items = Array.isArray(data?.items) ? data.items : [];
        return { success: true };
      } catch (err) {
        const message = err?.response?.data?.message || err?.message || 'Không thể xóa sách khỏi giỏ';
        this.error = message;
        return { success: false, message };
      } finally {
        this.loading = false;
      }
    },

    clearCart() {
      this.items = [];
      this.error = null;
    },
  },
});

