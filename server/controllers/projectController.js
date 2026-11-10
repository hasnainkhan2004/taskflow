const Project = require('../models/Project');
const Task = require('../models/Task');
const Membership = require('../models/Membership');
const Workspace = require('../models/Workspace');
const { getMembership, canEditWorkspaceContent, canManageProjects } = require('../utils/permissions');

const createProject = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: 'Please add a project title' });
    let workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) {
      const personal = await Membership.findOne({ user: req.user._id, role: 'owner' })
        .populate({ path: 'workspace', match: { isPersonal: true } });
      workspaceId = personal?.workspace?._id;
      if (!workspaceId) {
        workspaceId = (await Membership.findOne({ user: req.user._id }))?.workspace;
      }
    }
    const membership = await getMembership(req.user._id, workspaceId);
    if (!membership) return res.status(404).json({ message: 'Workspace not found' });
    if (!canEditWorkspaceContent(membership)) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    const project = await Project.create({
      title, description, owner: req.user._id, members: [req.user._id], workspace: workspaceId,
    });
    return res.status(201).json(project);
  } catch (error) {
    return next(error);
  }
};

const projectIdsForUser = async (userId) => {
  const memberships = await Membership.find({ user: userId }).select('workspace');
  return Project.find({ workspace: { $in: memberships.map((m) => m.workspace) } })
    .sort({ createdAt: -1 });
};

const withTaskCounts = async (projects) => {
  const ids = projects.map((project) => project._id);
  const counts = await Task.aggregate([
    { $match: { project: { $in: ids } } },
    { $group: {
      _id: '$project',
      totalTasks: { $sum: 1 },
      doneTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      overdueTasks: { $sum: { $cond: [
        { $and: [
          { $lt: ['$dueDate', new Date()] },
          { $ne: ['$dueDate', null] },
          { $ne: ['$status', 'done'] },
        ] },
        1, 0,
      ] } },
    } },
  ]);
  const countByProject = new Map(counts.map((count) => [String(count._id), count]));
  return projects.map((project) => ({
    ...project.toObject(),
    totalTasks: countByProject.get(String(project._id))?.totalTasks || 0,
    doneTasks: countByProject.get(String(project._id))?.doneTasks || 0,
    overdueTasks: countByProject.get(String(project._id))?.overdueTasks || 0,
  }));
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await projectIdsForUser(req.user._id);
    return res.json(await withTaskCounts(projects));
  } catch (error) {
    return next(error);
  }
};

const getProjectsByWorkspace = async (req, res, next) => {
  try {
    if (!(await getMembership(req.user._id, req.params.workspaceId))) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    const projects = await Project.find({ workspace: req.params.workspaceId }).sort({ createdAt: -1 });
    return res.json(await withTaskCounts(projects));
  } catch (error) {
    return next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !(await getMembership(req.user._id, project.workspace))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    return res.json(project);
  } catch (error) {
    return next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !(await getMembership(req.user._id, project.workspace))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (!canManageProjects(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Admin role required to update projects' });
    }
    if (req.body.title !== undefined) project.title = req.body.title;
    if (req.body.description !== undefined) project.description = req.body.description;
    return res.json(await project.save());
  } catch (error) {
    return next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !(await getMembership(req.user._id, project.workspace))) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (!canManageProjects(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Admin role required to delete projects' });
    }
    await project.deleteOne();
    return res.json({ message: 'Project removed' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProject, getProjects, getProjectsByWorkspace, getProjectById, updateProject, deleteProject,
};
