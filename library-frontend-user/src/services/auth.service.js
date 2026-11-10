import api from '@/services/api.service';

const requestOptions = {
  skipAuthToken: true,
  skipAuthRefresh: true,
  silent: true,
};

const authService = {
  async login(credentials) {
    const response = await api.post('/auth/login', credentials, requestOptions);
    return response.data?.data;
  },

  async loginWithGoogle(idToken) {
    const response = await api.post('/auth/google', { idToken }, requestOptions);
    return response.data?.data;
  },

  async register(payload) {
    const response = await api.post('/auth/register', payload, requestOptions);
    return response.data?.data;
  },

  async resetPassword(code, newPassword) {
    const response = await api.post('/auth/reset-password', { code, newPassword }, requestOptions);
    return response.data?.data;
  },
};

export default authService;
