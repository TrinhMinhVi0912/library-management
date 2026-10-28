const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['reader', 'staff', 'admin'],
      default: 'reader',
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    birthDate: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    position: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'locked'],
      default: 'active',
      index: true,
    },
    lockReason: {
      type: String,
      trim: true,
    },
    unpaidFineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for role & status
userSchema.index({ role: 1, status: 1 });

// Text search index for user search
userSchema.index(
  {
    firstName: 'text',
    lastName: 'text',
    email: 'text',
    code: 'text',
  },
  {
    default_language: 'none',
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;

