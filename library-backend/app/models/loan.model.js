const mongoose = require('mongoose');

const renewalHistorySchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
    },
    oldDue: {
      type: Date,
      required: true,
    },
    newDue: {
      type: Date,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    _id: false,
  }
);

const loanItemSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    titleSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    priceSnapshot: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'borrowing', 'returned', 'lost'],
      default: 'pending',
    },
    borrowDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    returnDate: {
      type: Date,
    },
    renewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    renewals: [renewalHistorySchema],
    condition: {
      type: String,
      enum: ['good', 'damaged', 'lost'],
    },
  },
  {
    _id: true,
  }
);

const loanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    reader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'borrowing',
        'overdue',
        'returned',
        'rejected',
        'cancelled',
        'expired',
      ],
      default: 'pending',
    },
    items: {
      type: [loanItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Phiếu mượn phải có ít nhất 1 quyển sách',
      },
    },
    requestNote: {
      type: String,
      trim: true,
    },
    expectedPickupDate: {
      type: Date,
    },
    pickupDeadline: {
      type: Date,
      index: true,
    },
    rejectReason: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    handedOverBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    handedOverAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
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

// Compound indexes
loanSchema.index({ reader: 1, status: 1 });
loanSchema.index({ status: 1, createdAt: -1 });
loanSchema.index({ 'items.dueDate': 1, status: 1 });

const Loan = mongoose.model('Loan', loanSchema, 'loans');

module.exports = Loan;

