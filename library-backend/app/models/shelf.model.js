const mongoose = require('mongoose');

const shelfItemSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const shelfSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['want', 'reading', 'read', 'custom'],
      default: 'custom',
    },
    items: [shelfItemSchema],
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
shelfSchema.index({ user: 1, name: 1 }, { unique: true });

const Shelf = mongoose.model('Shelf', shelfSchema, 'shelves');

module.exports = Shelf;

