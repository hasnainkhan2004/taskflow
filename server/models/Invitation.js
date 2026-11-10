const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Workspace' },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { delete ret.tokenHash; return ret; } },
    toObject: { transform: (_doc, ret) => { delete ret.tokenHash; return ret; } },
  }
);

invitationSchema.index(
  { workspace: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('Invitation', invitationSchema);
