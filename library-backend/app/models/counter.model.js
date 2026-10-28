const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
