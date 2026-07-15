const mongoose = require('mongoose');

const listSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('List', listSchema);