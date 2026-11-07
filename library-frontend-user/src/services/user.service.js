import api from '@/services/api.service';

const userService = {
  async getProfile() {
    const response = await api.get('/me');
    return response.data?.data;
  },

  async updateProfile(payload) {
    const response = await api.patch('/me', payload);
    return response.data?.data;
  },

  async changePassword({ currentPassword, newPassword }) {
    // Không dùng silent để error được chuyển cho component xử lý rõ ràng
    const response = await api.patch('/me/password', { currentPassword, newPassword });
    return response.data?.data;
  },

  async uploadAvatar(file, onProgress) {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return response.data?.data;
  },
};

export default userService;

