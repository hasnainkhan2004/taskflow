const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    list: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'List' },
    project: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Project' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);