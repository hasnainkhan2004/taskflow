const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Workspace' },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    task: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Task' },
    author: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

commentSchema.virtual('content').get(function () {
  return this.body;
});

commentSchema.index({ task: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
