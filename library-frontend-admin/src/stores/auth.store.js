import { defineStore } from 'pinia';
import * as authService from '@/services/auth.service';
import { disconnectSocket } from '@/services/socket.service';

let restorePromise = null;
const ADMIN_ROLES = ['staff', 'admin'];

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: null,
    initialized: false,
    rejectedReader: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.accessToken),
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    setSession(user, accessToken) {
      this.user = user;
      this.accessToken = accessToken;
      this.initialized = true;
      this.rejectedReader = false;
    },
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.initialized = true;
      disconnectSocket();
    },
    async login(credentials) {
      const result = await authService.login(credentials);
      this.setSession(result.user, result.accessToken);
      if (!ADMIN_ROLES.includes(result.user?.role)) {
        this.rejectedReader = result.user?.role === 'reader';
        try {
          await authService.logout();
        } catch {
          // Vẫn xóa phiên ở client khi logout API thất bại.
        } finally {
          this.clearSession();
        }
        const error = new Error('Tài khoản độc giả hãy đăng nhập tại website dành cho bạn.');
        error.code = 'READER_ACCOUNT';
        throw error;
      }
      return result.user;
    },
    async refreshSession() {
      const result = await authService.refresh();
      if (!ADMIN_ROLES.includes(result.user?.role)) {
        this.rejectedReader = result.user?.role === 'reader';
        this.clearSession();
        return null;
      }
      this.setSession(result.user, result.accessToken);
      return result.accessToken;
    },
    async restoreSession() {
      if (this.initialized) return this.user;
      if (restorePromise) return restorePromise;
      restorePromise = (async () => {
        try {
          const refreshed = await authService.refresh();
          if (!ADMIN_ROLES.includes(refreshed.user?.role)) {
            this.rejectedReader = refreshed.user?.role === 'reader';
            this.clearSession();
            return null;
          }
          this.setSession(refreshed.user, refreshed.accessToken);
          const user = await authService.getCurrentUser();
          if (!ADMIN_ROLES.includes(user?.role)) {
            this.rejectedReader = user?.role === 'reader';
            this.clearSession();
            return null;
          }
          this.user = user;
          return user;
        } catch {
          this.clearSession();
          return null;
        } finally {
          restorePromise = null;
          this.initialized = true;
        }
      })();
      return restorePromise;
    },
    async logout() {
      try {
        await authService.logout();
      } finally {
        this.clearSession();
        this.rejectedReader = false;
      }
    },
  },
});
