import { defineStore } from 'pinia';
import api from '@/services/api.service';
import authService from '@/services/auth.service';
import socketService from '@/services/socket.service';

const getData = (response) => response.data?.data;
let restorePromise = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.accessToken),
    role: (state) => state.user?.role || null,
  },
  actions: {
    setSession(user, accessToken) {
      this.user = user || null;
      this.accessToken = accessToken || null;
      this.initialized = true;
      if (this.accessToken && this.user?.role === 'reader') {
        socketService.updateToken(this.accessToken);
      }
    },
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.initialized = true;
      socketService.disconnect();
    },
    updateUser(userData) {
      if (!userData) return;
      this.user = this.user ? { ...this.user, ...userData } : userData;
    },
    async login(credentials) {
      const result = await authService.login(credentials);
      this.setSession(result?.user, result?.accessToken);
      return result?.user || null;
    },
    async register(payload) {
      const result = await authService.register(payload);
      this.setSession(result?.user, result?.accessToken);
      return result?.user || null;
    },
    async fetchMe() {
      const response = await api.get('/me');
      this.user = getData(response) || null;
      this.initialized = true;
      return this.user;
    },
    async refresh() {
      const response = await api.post('/auth/refresh', {}, {
        skipAuthToken: true,
        skipAuthRefresh: true,
        silent: true,
      });
      const result = getData(response);
      if (!result?.accessToken || !result?.user) {
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
          await this.refresh();
          return this.user;
        } catch {
          this.clearSession();
          return null;
        } finally {
          this.initialized = true;
          restorePromise = null;
        }
      })();

      return restorePromise;
    },
    async logout() {
      try {
        await api.post('/auth/logout', {}, {
          skipAuthRefresh: true,
          silent: true,
        });
      } finally {
        this.clearSession();
      }
    },
  },
});
