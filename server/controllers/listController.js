const List = require('../models/List');
const Project = require('../models/Project');
const { POSITION_GAP, calculatePosition } = require('../utils/positioning');
const { getMembership, canEditWorkspaceContent } = require('../utils/permissions');

const checkAccess = (projectId, userId) => Project.findOne({ _id: projectId })
  .then(async (project) => project && await getMembership(userId, project.workspace) ? project : null);

const createList = async (req, res, next) => {
  try {
    const { title, project, order } = req.body;
    if (!title || !project) {
      return res.status(400).json({ message: 'Title and project are required' });
    }

    const access = await checkAccess(project, req.user._id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, access.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }

    const lastList = await List.findOne({ project }).sort({ position: -1 });
    const list = await List.create({
      title: title.trim(),
      project,
      owner: req.user._id,
      order: order || 0,
      position: (lastList?.position || 0) + POSITION_GAP,
    });
    res.status(201).json(list);
  } catch (error) {
    return next(error);
  }
};

const getListsByProject = async (req, res, next) => {
  try {
    const access = await checkAccess(req.params.projectId, req.user._id);
    if (!access) return res.status(404).json({ message: 'Project not found' });

    const lists = await List.find({
      project: req.params.projectId,
    }).sort({ position: 1, order: 1 });
    res.json(lists);
  } catch (error) {
    return next(error);
  }
};

const updateList = async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const access = await checkAccess(list.project, req.user._id);
    if (!access) return res.status(404).json({ message: 'List not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, access.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }

    list.title = req.body.title || list.title;
    if (req.body.order !== undefined) list.order = req.body.order;
    if (req.body.title !== undefined) list.title = req.body.title.trim();

    const updated = await list.save();
    res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const deleteList = async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const access = await checkAccess(list.project, req.user._id);
    if (!access) return res.status(404).json({ message: 'List not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, access.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }

    await list.deleteOne();
    res.json({ message: 'List removed' });
  } catch (error) {
    return next(error);
  }
};

const moveList = async (req, res, next) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list || !(await checkAccess(list.project, req.user._id))) {
      return res.status(404).json({ message: 'List not found' });
    }
    const project = await checkAccess(list.project, req.user._id);
    if (!canEditWorkspaceContent(await getMembership(req.user._id, project.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }

    const lists = await List.find({
      project: list.project,
      _id: { $ne: list._id },
    }).sort({ position: 1, createdAt: 1 });
    const result = calculatePosition(
      lists,
      req.body.beforeListId,
      req.body.afterListId
    );
    if (result.error) return res.status(400).json({ message: result.error });

    if (result.rebalance) {
      await Promise.all(result.rebalance.map(({ id, position }) =>
        List.updateOne({ _id: id }, { $set: { position } })
      ));
    }
    list.position = result.position;
    list.order = result.insertionIndex;
    return res.json(await list.save());
  } catch (error) {
    return next(error);
  }
};

module.exports = { createList, getListsByProject, updateList, deleteList, moveList };