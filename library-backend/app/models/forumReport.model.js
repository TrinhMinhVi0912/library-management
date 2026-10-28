const mongoose = require('mongoose');

const forumReportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['thread', 'post'],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel',
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

forumReportSchema.virtual('targetModel').get(function () {
  return this.targetType === 'thread' ? 'ForumThread' : 'ForumPost';
});

// Indexes
forumReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ForumReport', forumReportSchema);

