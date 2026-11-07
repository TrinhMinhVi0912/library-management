import { defineStore } from 'pinia';
import notificationService from '@/services/notification.service';
import socketService from '@/services/socket.service';

let socketListenersAttached = false;

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    unreadCount: 0,
    recentNotifications: [],
    notifications: [],
    meta: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
    loading: false,
    dropdownLoading: false,
    connected: false,
    activeToasts: [],
    lastLoanEvent: null,
    lastRenewalEvent: null,
  }),

  getters: {
    hasUnread: (state) => state.unreadCount > 0,
  },

  actions: {
    /**
     * Khởi tạo kết nối Socket và lắng nghe sự kiện
     * @param {string} token
     * @param {Function} [onTokenExpired]
     */
    initSocket(token, onTokenExpired) {
      if (onTokenExpired) {
        socketService.onTokenExpired(onTokenExpired);
      }

      if (token) {
        socketService.connect(token);
      }

      const socket = socketService.getSocket();
      if (socket && !socketListenersAttached) {
        socketListenersAttached = true;

        socket.on('connect', () => {
          this.connected = true;
          this.sync();
        });

        socket.on('disconnect', () => {
          this.connected = false;
        });

        socket.on('notification:new', (notification) => {
          this.handleNewNotification(notification);
        });

        socket.on('notification:updated', (notification) => {
          this.handleUpdatedNotification(notification);
        });

        socket.on('notification:deleted', (data) => {
          this.handleDeletedNotification(data);
        });

        socket.on('loan:updated', (data) => {
          this.lastLoanEvent = { ...data, timestamp: Date.now() };
        });

        socket.on('renewal:updated', (data) => {
          this.lastRenewalEvent = { ...data, timestamp: Date.now() };
        });
      }
    },

    /**
     * Ngắt kết nối socket
     */
    disconnectSocket() {
      socketService.disconnect();
      socketListenersAttached = false;
      this.connected = false;
      this.unreadCount = 0;
      this.recentNotifications = [];
      this.notifications = [];
      this.activeToasts = [];
    },

    /**
     * Cập nhật token cho socket khi auth refresh
     * @param {string} newToken
     */
    updateSocketToken(newToken) {
      socketService.updateToken(newToken);
    },

    /**
     * Đồng bộ số chưa đọc và 5 thông báo mới nhất
     */
    async sync() {
      await Promise.allSettled([
        this.fetchUnreadCount(),
        this.fetchRecent(),
      ]);
    },

    /**
     * Lấy số lượng thông báo chưa đọc
     */
    async fetchUnreadCount() {
      try {
        const count = await notificationService.getUnreadCount();
        this.unreadCount = count;
        return count;
      } catch {
        return this.unreadCount;
      }
    },

    /**
     * Lấy 5 thông báo mới nhất cho dropdown chuông
     */
    async fetchRecent() {
      this.dropdownLoading = true;
      try {
        const result = await notificationService.getMyNotifications({ limit: 5, page: 1 });
        this.recentNotifications = result.notifications || [];
      } catch {
        this.recentNotifications = [];
      } finally {
        this.dropdownLoading = false;
      }
    },

    /**
     * Lấy danh sách thông báo phân trang đầy đủ
     * @param {Object} params { unread, page, limit }
     */
    async fetchNotifications(params = {}) {
      this.loading = true;
      try {
        const result = await notificationService.getMyNotifications(params);
        this.notifications = result.notifications || [];
        this.meta = result.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };
        return result;
      } catch (err) {
        this.notifications = [];
        this.meta = { total: 0, page: 1, limit: 20, totalPages: 1 };
        throw err;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Đánh dấu 1 thông báo đã đọc
     * @param {string} id
     */
    async markAsRead(id) {
      if (!id) return;

      // Cập nhật optimistic
      const updateItem = (item) => {
        if (item._id === id && !item.isRead) {
          item.isRead = true;
          return true;
        }
        return false;
      };

      let wasUnread = false;
      this.recentNotifications.forEach((item) => {
        if (updateItem(item)) wasUnread = true;
      });
      this.notifications.forEach((item) => {
        if (updateItem(item)) wasUnread = true;
      });

      if (wasUnread) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

      try {
        await notificationService.markAsRead(id);
      } catch {
        // Đồng bộ lại nếu lỗi
        await this.fetchUnreadCount();
      }
    },

    /**
     * Đánh dấu tất cả thông báo là đã đọc
     */
    async markAllAsRead() {
      // Cập nhật optimistic
      this.recentNotifications.forEach((item) => {
        item.isRead = true;
      });
      this.notifications.forEach((item) => {
        item.isRead = true;
      });
      this.unreadCount = 0;

      try {
        await notificationService.markAllAsRead();
      } catch {
        await this.fetchUnreadCount();
      }
    },

    /**
     * Xử lý khi nhận thông báo mới qua Socket
     * @param {Object} item
     */
    handleNewNotification(item) {
      if (!item || !item._id) return;

      const formatted = {
        ...item,
        isRead: false,
      };

      // Tăng số chưa đọc
      this.unreadCount += 1;

      // Thêm vào recent (giữ tối đa 5)
      const existingRecentIdx = this.recentNotifications.findIndex((n) => n._id === formatted._id);
      if (existingRecentIdx >= 0) {
        this.recentNotifications.splice(existingRecentIdx, 1);
      }
      this.recentNotifications.unshift(formatted);
      if (this.recentNotifications.length > 5) {
        this.recentNotifications.pop();
      }

      // Thêm vào danh sách trang nếu đang mở
      const existingListIdx = this.notifications.findIndex((n) => n._id === formatted._id);
      if (existingListIdx >= 0) {
        this.notifications.splice(existingListIdx, 1);
      }
      this.notifications.unshift(formatted);
      this.meta.total += 1;

      // Hiển thị toast realtime
      this.addToast(formatted);
    },

    /**
     * Xử lý khi thông báo được admin cập nhật qua Socket
     * @param {Object} item
     */
    handleUpdatedNotification(item) {
      if (!item || !item._id) return;

      const update = (target) => {
        const idx = target.findIndex((n) => n._id === item._id);
        if (idx >= 0) {
          target[idx] = { ...target[idx], ...item };
        }
      };

      update(this.recentNotifications);
      update(this.notifications);
    },

    /**
     * Xử lý khi thông báo bị admin xóa qua Socket
     * @param {Object} data { _id }
     */
    handleDeletedNotification(data) {
      if (!data || !data._id) return;

      const filter = (target) => target.filter((n) => n._id !== data._id);

      const wasInRecent = this.recentNotifications.some((n) => n._id === data._id && !n.isRead);
      const wasInList = this.notifications.some((n) => n._id === data._id && !n.isRead);

      this.recentNotifications = filter(this.recentNotifications);
      this.notifications = filter(this.notifications);

      if (wasInRecent || wasInList) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }
    },

    /**
     * Thêm thông báo toast realtime
     * @param {Object} notification
     */
    addToast(notification) {
      const toastId = `${notification._id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toast = {
        toastId,
        id: notification._id,
        type: notification.type || 'system',
        title: notification.title || 'Thông báo mới',
        content: notification.content || '',
        link: notification.link || null,
        createdAt: notification.createdAt || new Date().toISOString(),
      };

      // Tối đa 3 toast hiển thị cùng lúc
      if (this.activeToasts.length >= 3) {
        this.activeToasts.shift();
      }
      this.activeToasts.push(toast);
    },

    /**
     * Đóng toast realtime
     * @param {string} toastId
     */
    removeToast(toastId) {
      this.activeToasts = this.activeToasts.filter((t) => t.toastId !== toastId);
    },
  },
});

