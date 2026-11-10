const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
  },
  { timestamps: false }
);

const taskSchema = new mongoose.Schema(
  {
    seedTag: { type: String, default: undefined, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' },
    list: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'List' },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    completedAt: { type: Date, default: null },
    position: { type: Number, default: 0 },
    subtasks: { type: [subtaskSchema], default: [] },
    labels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Label' }],
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, list: 1, position: 1 });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index({ title: 'text', description: 'text' });

taskSchema.pre('save', function () {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? (this.completedAt || new Date()) : null;
  }
});

module.exports = mongoose.model('Task', taskSchema);