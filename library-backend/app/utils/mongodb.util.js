const mongoose = require('mongoose');
const config = require('../config');

class MongoDB {
  static async connect(uri = config.mongodbUri) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`[MongoDB] Kết nối cơ sở dữ liệu thành công: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.error('[MongoDB] Lỗi kết nối cơ sở dữ liệu:', error.message);
      throw error;
    }
  }

  static async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('[MongoDB] Đã ngắt kết nối cơ sở dữ liệu.');
    } catch (error) {
      console.error('[MongoDB] Lỗi khi ngắt kết nối:', error.message);
      throw error;
    }
  }
}

module.exports = MongoDB;
