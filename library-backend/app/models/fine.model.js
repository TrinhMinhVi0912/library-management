const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema(
  {
    reader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
    type: {
      type: String,
      enum: ['late', 'damaged', 'lost', 'other'],
      required: true,
    },
    daysLate: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Tiền phạt không được âm'],
    },
    reason: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'waived'],
      default: 'unpaid',
      index: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidAt: {
      type: Date,
    },
    paidConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    waivedReason: {
      type: String,
      trim: true,
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

fineSchema.index({ reader: 1, status: 1 });

const Fine = mongoose.model('Fine', fineSchema, 'fines');

module.exports = Fine;

