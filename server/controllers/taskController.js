const Task = require('../models/Task');
const Project = require('../models/Project');

const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const authorized =
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.toString() === userId.toString());
  return authorized ? project : false;
};

const createTask = async (req, res) => {
  try {
    const { title, description, list, project, assignedTo, priority, dueDate, order } = req.body;
    if (!title || !list || !project) {
      return res.status(400).json({ message: 'Title, list and project are required' });
    }

    const access = await checkAccess(project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    const task = await Task.create({
      title, description, list, project, assignedTo, priority, dueDate, order: order || 0,
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTasksByProject = async (req, res) => {
  try {
    const access = await checkAccess(req.params.projectId, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name email')
      .sort({ order: 1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const access = await checkAccess(task.project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    const fields = ['title', 'description', 'list', 'assignedTo', 'priority', 'dueDate', 'order'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) task[f] = req.body[f];
    });

    const updated = await task.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const access = await checkAccess(task.project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    await task.deleteOne();
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createTask, getTasksByProject, updateTask, deleteTask };