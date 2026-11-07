import { defineStore } from 'pinia';
import api from '@/services/api.service';

const getData = (response) => response.data?.data;

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
    },
    clearSession() {
      this.user = null;
      this.accessToken = null;
      this.initialized = true;
    },
    async login(credentials) {
      const response = await api.post('/auth/login', credentials, {
        skipAuthToken: true,
        skipAuthRefresh: true,
      });
      const result = getData(response);
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
