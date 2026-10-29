const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const notifyService = require('../services/notify.service');

/**
 * Middleware xác thực kết nối Socket.IO qua JWT access token trong auth.token
 */
async function authMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Chưa cung cấp mã xác thực'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Mã xác thực đã hết hạn'));
      }
      return next(new Error('Mã xác thực không hợp lệ'));
    }

    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) {
      return next(new Error('Payload mã xác thực không hợp lệ'));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new Error('Tài khoản không tồn tại'));
    }

    if (user.status !== 'active') {
      const lockMsg = user.lockReason
        ? `Tài khoản đã bị khóa. Lý do: ${user.lockReason}`
        : 'Tài khoản đã bị khóa';
      return next(new Error(lockMsg));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error(`Lỗi xác thực: ${err.message}`));
  }
}

/**
 * Xử lý khi client kết nối thành công và phân phòng
 */
function handleConnection(socket) {
  const user = socket.user;
  const userId = user._id.toString();

  // Tham gia phòng chung và phòng cá nhân
  socket.join('all');
  socket.join(`user:${userId}`);

  // Phân phòng theo vai trò
  if (user.role === 'staff' || user.role === 'admin') {
    socket.join('role:staff');
  }
  if (user.role === 'reader') {
    socket.join('role:reader');
  }

  // Client không phát sự kiện nghiệp vụ lên server
  socket.on('disconnect', () => {
    // Ngắt kết nối socket
  });
}

/**
 * Khởi tạo Socket.IO server gắn vào HTTP server
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrls,
      credentials: true,
    },
  });

  // Gắn io vào notifyService để service có thể phát sự kiện
  notifyService.setIO(io);

  io.use(authMiddleware);
  io.on('connection', handleConnection);

  return io;
}

module.exports = {
  initSocket,
  authMiddleware,
  handleConnection,
};
