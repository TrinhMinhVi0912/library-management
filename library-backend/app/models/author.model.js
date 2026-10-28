const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    photo: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
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

authorSchema.index(
  {
    name: 'text',
  },
  {
    default_language: 'none',
  }
);

const Author = mongoose.model('Author', authorSchema);

module.exports = Author;

