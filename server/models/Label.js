const mongoose = require('mongoose');

const LABEL_COLORS = [
  '#64748b',
  '#3b82f6',
  '#14b8a6',
  '#22c55e',
  '#f59e0b',
  '#f2674a',
  '#ef4444',
  '#a855f7',
];

const labelSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    color: { type: String, required: true, enum: LABEL_COLORS },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true }
);

labelSchema.index({ project: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Label', labelSchema);
module.exports.LABEL_COLORS = LABEL_COLORS;
