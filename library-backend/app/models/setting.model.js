const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    maxBooksPerLoan: {
      type: Number,
      default: 5,
      min: 1,
    },
    loanDays: {
      type: Number,
      default: 14,
      min: 1,
    },
    maxRenewals: {
      type: Number,
      default: 2,
      min: 0,
    },
    renewDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    pickupHoldDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    reservationHoldDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    lateFeePerDay: {
      type: Number,
      default: 2000,
      min: 0,
    },
    lostBookFeeRate: {
      type: Number,
      default: 1.0,
      min: 0,
    },
    lostBookProcessingFee: {
      type: Number,
      default: 20000,
      min: 0,
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

module.exports = mongoose.model('Setting', settingSchema);

