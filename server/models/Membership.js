const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Workspace' },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

membershipSchema.index({ workspace: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1, workspace: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
