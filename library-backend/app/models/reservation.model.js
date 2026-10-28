const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    reader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'available', 'fulfilled', 'expired', 'cancelled'],
      default: 'waiting',
    },
    notifiedAt: {
      type: Date,
    },
    holdUntil: {
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
// FIFO queue for book reservations
reservationSchema.index({ book: 1, status: 1, createdAt: 1 });

// Partial unique index: each reader can have at most one active (waiting or available) reservation per book
reservationSchema.index(
  { reader: 1, book: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['waiting', 'available'] } },
  }
);

const Reservation = mongoose.model('Reservation', reservationSchema, 'reservations');

module.exports = Reservation;

