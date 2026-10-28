const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes: mỗi người dùng chỉ có 1 bản ghi xác nhận đã đọc cho một thông báo
notificationReadSchema.index({ user: 1, notification: 1 }, { unique: true });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);

