const Label = require('../models/Label');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { getMembership, canEditWorkspaceContent } = require('../utils/permissions');

const findAccessibleProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  return project && await getMembership(userId, project.workspace) ? project : null;
};

const getProjectLabels = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    const labels = await Label.find({
      project: project._id,
    }).sort({ name: 1 });
    return res.json(labels);
  } catch (error) {
    return next(error);
  }
};

const createProjectLabel = async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const label = await Label.create({
      name: req.body.name.trim(),
      color: req.body.color,
      project: project._id,
      owner: req.user._id,
    });
    return res.status(201).json(label);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This label already exists in the project' });
    }
    return next(error);
  }
};

const updateLabel = async (req, res, next) => {
  try {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ message: 'Label not found' });
    const project = await findAccessibleProject(label.project, req.user._id);
    if (!project) return res.status(404).json({ message: 'Label not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    if (req.body.name !== undefined) label.name = req.body.name.trim();
    if (req.body.color !== undefined) label.color = req.body.color;
    return res.json(await label.save());
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This label already exists in the project' });
    }
    return next(error);
  }
};

const deleteLabel = async (req, res, next) => {
  try {
    const label = await Label.findById(req.params.id);
    if (!label) return res.status(404).json({ message: 'Label not found' });
    const project = await findAccessibleProject(label.project, req.user._id);
    if (!project) return res.status(404).json({ message: 'Label not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    await Task.updateMany(
      { project: label.project, labels: label._id },
      { $pull: { labels: label._id } }
    );
    await label.deleteOne();
    return res.json({ message: 'Label removed' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getProjectLabels, createProjectLabel, updateLabel, deleteLabel };
