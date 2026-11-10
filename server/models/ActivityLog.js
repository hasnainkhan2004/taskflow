const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Workspace' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 50 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
activityLogSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
