const http = require('http');
const app = require('./app');
const config = require('./app/config');
const MongoDB = require('./app/utils/mongodb.util');

const server = http.createServer(app);

// TODO: Khởi tạo Socket.IO (gắn vào server ở task BE-04/BE-32)
// const { initSocket } = require('./app/sockets');
// initSocket(server);

// TODO: Khởi chạy Scheduled Jobs (task sau)
// if (!config.jobs.disableInternalCron) {
//   require('./app/jobs');
// }

async function startServer() {
  try {
    // 1. Kết nối cơ sở dữ liệu MongoDB
    await MongoDB.connect(config.mongodbUri);

    // 2. Lắng nghe trên 0.0.0.0 và PORT
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`[Server] 🚀 Máy chủ đang lắng nghe tại http://0.0.0.0:${config.port}`);
      console.log(`[Server] Môi trường: ${config.env}`);
    });
  } catch (error) {
    console.error('[Server] Không thể khởi động máy chủ:', error);
    process.exit(1);
  }
}

// Xử lý các tín hiệu tắt tiến trình an toàn (Graceful Shutdown)
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Nhận tín hiệu ${signal}. Đang đóng các kết nối...`);
  server.close(async () => {
    try {
      await MongoDB.disconnect();
      console.log('[Server] Đã đóng máy chủ HTTP và ngắt kết nối DB an toàn.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Lỗi khi ngắt kết nối:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
  process.exit(1);
});

startServer();

module.exports = server;
