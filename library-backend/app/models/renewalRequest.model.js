const mongoose = require('mongoose');

const renewalRequestSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    reader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currentDueDate: {
      type: Date,
      required: true,
    },
    requestedDueDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    rejectReason: {
      type: String,
      trim: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
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

// Indexes
renewalRequestSchema.index({ status: 1, createdAt: -1 });
renewalRequestSchema.index({ reader: 1, createdAt: -1 });

// Partial unique index: only 1 pending renewal request per loan + book
renewalRequestSchema.index(
  { loan: 1, book: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

const RenewalRequest = mongoose.model('RenewalRequest', renewalRequestSchema, 'renewalRequests');

module.exports = RenewalRequest;

