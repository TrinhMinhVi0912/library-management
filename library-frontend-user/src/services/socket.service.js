import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let tokenExpiredHandler = null;
let isRefreshing = false;

export const socketService = {
  /**
   * Đăng ký callback khi token hết hạn để refresh
   * @param {Function} handler async () => string|null (trả về token mới)
   */
  onTokenExpired(handler) {
    tokenExpiredHandler = handler;
  },

  /**
   * Khởi tạo và kết nối Socket.IO
   * @param {string} token
   */
  connect(token) {
    if (!token) return;

    if (socket) {
      if (socket.auth?.token === token && socket.connected) {
        return;
      }
      socket.auth = { token };
      if (!socket.connected) {
        socket.connect();
      }
      return;
    }

    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect_error', async (error) => {
      const msg = error?.message || '';
      const isAuthError = msg.includes('hết hạn') || msg.includes('xác thực') || msg.includes('expired') || msg.includes('jwt');

      if (isAuthError && tokenExpiredHandler && !isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await tokenExpiredHandler();
          if (newToken && socket) {
            socket.auth = { token: newToken };
            socket.connect();
          }
        } catch {
          // Lỗi làm mới token sẽ được auth store xử lý
        } finally {
          isRefreshing = false;
        }
      }
    });
  },

  /**
   * Cập nhật token mới khi refresh và kết nối lại
   * @param {string} newToken
   */
  updateToken(newToken) {
    if (!newToken) {
      this.disconnect();
      return;
    }
    if (socket) {
      socket.auth = { token: newToken };
      if (!socket.connected) {
        socket.connect();
      }
    } else {
      this.connect(newToken);
    }
  },

  /**
   * Ngắt kết nối socket
   */
  disconnect() {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * Lắng nghe sự kiện socket
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (socket) {
      socket.on(event, callback);
    }
  },

  /**
   * Hủy lắng nghe sự kiện socket
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (socket) {
      socket.off(event, callback);
    }
  },

  /**
   * Kiểm tra trạng thái kết nối
   */
  isConnected() {
    return Boolean(socket?.connected);
  },

  /**
   * Lấy socket instance hiện tại
   */
  getSocket() {
    return socket;
  },
};

export default socketService;

