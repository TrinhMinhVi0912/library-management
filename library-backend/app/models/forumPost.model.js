const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema(
  {
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumThread',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumPost',
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'hidden'],
      default: 'active',
      index: true,
    },
    moderation: {
      state: { type: String, enum: ['pending', 'approved', 'rejected', 'bypassed'], default: 'bypassed', index: true },
      score: { type: Number, min: 0, max: 1, default: null },
      model: { type: String, default: '' },
      reason: { type: String, default: '' },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
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

// Indexes
forumPostSchema.index({ thread: 1, createdAt: 1 });

module.exports = mongoose.model('ForumPost', forumPostSchema);

