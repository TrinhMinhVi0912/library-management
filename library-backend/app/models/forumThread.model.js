const mongoose = require('mongoose');

const forumThreadSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumCategory',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    pinned: {
      type: Boolean,
      default: false,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReplyAt: {
      type: Date,
    },
    lastReplyBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
forumThreadSchema.index({ category: 1, pinned: -1, lastReplyAt: -1 });
forumThreadSchema.index({ title: 'text', content: 'text' }, { default_language: 'none' });

module.exports = mongoose.model('ForumThread', forumThreadSchema);

