const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    isbn: {
      type: String,
      trim: true,
    },
    authors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Author',
      },
    ],
    authorText: {
      type: String,
      trim: true,
    },
    publisher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Publisher',
    },
    publishYear: {
      type: Number,
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Đơn giá không được âm'],
    },
    totalCopies: {
      type: Number,
      default: 0,
      min: [0, 'Tổng số lượng không được âm'],
    },
    availableCopies: {
      type: Number,
      default: 0,
      min: [0, 'Số lượng khả dụng không được âm'],
      validate: {
        validator: function (val) {
          if (typeof this.totalCopies === 'number') {
            return val <= this.totalCopies;
          }
          return true;
        },
        message: 'Số lượng khả dụng ({VALUE}) không được vượt quá tổng số lượng',
      },
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    language: {
      type: String,
      default: 'Tiếng Việt',
      trim: true,
    },
    pages: {
      type: Number,
      min: [1, 'Số trang phải lớn hơn 0'],
    },
    description: {
      type: String,
      trim: true,
    },
    cover: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    location: {
      type: String,
      trim: true,
    },
    ratingAvg: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    borrowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
      index: true,
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

// Pre-validate hook to ensure availableCopies <= totalCopies
bookSchema.pre('validate', function () {
  if (typeof this.totalCopies === 'number' && typeof this.availableCopies === 'number') {
    if (this.availableCopies > this.totalCopies) {
      this.invalidate('availableCopies', 'Số lượng khả dụng không được vượt quá tổng số lượng');
    }
  }
});

// Indexes
bookSchema.index(
  {
    title: 'text',
    authorText: 'text',
  },
  {
    default_language: 'none',
  }
);

bookSchema.index({ categories: 1 });
bookSchema.index({ authors: 1 });
bookSchema.index({ borrowCount: -1 });
bookSchema.index({ createdAt: -1 });

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
