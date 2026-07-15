const List = require('../models/List');
const Project = require('../models/Project');

const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const authorized =
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.toString() === userId.toString());
  return authorized ? project : false;
};

const createList = async (req, res) => {
  try {
    const { title, project, order } = req.body;
    if (!title || !project) {
      return res.status(400).json({ message: 'Title and project are required' });
    }

    const access = await checkAccess(project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    const list = await List.create({ title, project, order: order || 0 });
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getListsByProject = async (req, res) => {
  try {
    const access = await checkAccess(req.params.projectId, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    const lists = await List.find({ project: req.params.projectId }).sort({ order: 1 });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateList = async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const access = await checkAccess(list.project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    list.title = req.body.title || list.title;
    if (req.body.order !== undefined) list.order = req.body.order;

    const updated = await list.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteList = async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const access = await checkAccess(list.project, req.user._id);
    if (!access) return res.status(403).json({ message: 'Not authorized' });

    await list.deleteOne();
    res.json({ message: 'List removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createList, getListsByProject, updateList, deleteList };