const { Notification, NotificationRead, RefreshToken } = require('../models');

async function run({ now = new Date() } = {}) {
  const expired = await Notification.find({ expiresAt: { $lte: now } }).select('_id').lean();
  const ids = expired.map((notification) => notification._id);
  if (ids.length) await NotificationRead.deleteMany({ notification: { $in: ids } });
  const notifications = ids.length ? await Notification.deleteMany({ _id: { $in: ids } }) : { deletedCount: 0 };
  const tokens = await RefreshToken.deleteMany({ expiresAt: { $lte: now } });
  return { notificationsDeleted: notifications.deletedCount || 0, refreshTokensDeleted: tokens.deletedCount || 0 };
}

module.exports = { run };
