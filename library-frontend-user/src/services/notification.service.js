import api from '@/services/api.service';

const getData = (response) => response.data?.data;

const notificationService = {
  /**
   * Lấy danh sách thông báo của tôi
   * @param {Object} params { unread, page, limit }
   */
  async getMyNotifications(params = {}) {
    const response = await api.get('/me/notifications', { params });
    return {
      notifications: getData(response) || [],
      meta: response.data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 },
    };
  },

  /**
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount() {
    const response = await api.get('/me/notifications/unread-count');
    const data = getData(response);
    return Number(data?.unreadCount || 0);
  },

  /**
   * Đánh dấu 1 thông báo đã đọc
   * @param {string} id
   */
  async markAsRead(id) {
    const response = await api.patch(`/me/notifications/${id}/read`);
    return getData(response);
  },

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead() {
    const response = await api.patch('/me/notifications/read-all');
    return getData(response);
  },
};

export default notificationService;

