const mongoose = require('mongoose');

const listSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    title: { type: String, required: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    order: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

listSchema.index({ project: 1, owner: 1, position: 1 });

module.exports = mongoose.model('List', listSchema);