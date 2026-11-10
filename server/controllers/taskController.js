const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const List = require('../models/List');
const Label = require('../models/Label');
const { POSITION_GAP, calculatePosition } = require('../utils/positioning');
const Membership = require('../models/Membership');
const { getMembership, canEditWorkspaceContent } = require('../utils/permissions');
const { logActivity } = require('../utils/activity');
const ActivityLog = require('../models/ActivityLog');

const checkProjectAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  return project && await getMembership(userId, project.workspace) ? project : null;
};

const findTaskById = (taskId) => Task.findById(taskId);
const canEditProject = async (project, userId) => {
  const membership = await getMembership(userId, project.workspace);
  return canEditWorkspaceContent(membership);
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id)
      .populate('labels', 'name color')
      .populate('assignees', 'username email');
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    return res.json(task);
  } catch (error) {
    return next(error);
  }
};

const validateLabels = async (labelIds, projectId) => {
  const ids = [...new Set(labelIds.map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return false;
  const count = await Label.countDocuments({ _id: { $in: ids }, project: projectId });
  return count === ids.length;
};

const validateAssignees = async (ids, workspaceId) => {
  if (!Array.isArray(ids) || ids.some((id) => !mongoose.isValidObjectId(id))) return false;
  const uniqueIds = [...new Set(ids.map(String))];
  const count = await Membership.countDocuments({
    workspace: workspaceId, user: { $in: uniqueIds },
  });
  return count === uniqueIds.length;
};

const createTask = async (req, res, next) => {
  try {
    const { title, description, list, project, priority, dueDate, status, labels } = req.body;
    if (!title || !list || !project) {
      return res.status(400).json({ message: 'Title, list and project are required' });
    }

    const access = await checkProjectAccess(project, req.user._id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!(await canEditProject(access, req.user._id))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    const listExists = await List.exists({ _id: list, project });
    if (!listExists) return res.status(404).json({ message: 'List not found' });
    if (labels && !(await validateLabels(labels, project))) {
      return res.status(400).json({ message: 'One or more labels are invalid' });
    }
    const assignees = req.body.assignees || (req.body.assignedTo ? [req.body.assignedTo] : []);
    if (!(await validateAssignees(assignees, access.workspace))) {
      return res.status(400).json({ message: 'One or more assignees are not workspace members' });
    }

    const lastTask = await Task.findOne({ list }).sort({ position: -1 });
    const task = await Task.create({
      title: title.trim(),
      description,
      list,
      project,
      owner: req.user._id,
      createdBy: req.user._id,
      workspace: access.workspace,
      assignees,
      assignedTo: assignees[0] || null,
      priority,
      dueDate,
      status,
      labels,
      position: (lastTask?.position || 0) + POSITION_GAP,
    });
    await logActivity(access.workspace, req.user._id, 'task.created', 'task', task._id);
    return res.status(201).json(task);
  } catch (error) {
    return next(error);
  }
};

const getTasksByProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const access = await checkProjectAccess(projectId, req.user._id);
    if (!access) return res.status(404).json({ message: 'Project not found' });

    const {
      q,
      status,
      priority,
      label,
      due,
      sort = 'position',
      order = 'asc',
      page = '1',
      limit = '500',
    } = req.query;
    const filters = { project: projectId };
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (label) filters.labels = label;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (due === 'none') {
      filters.dueDate = null;
    } else if (due === 'overdue') {
      filters.dueDate = { $lt: startOfToday };
      filters.$and = [
        ...(filters.$and || []),
        { status: { $ne: 'done' } },
      ];
    } else if (due === 'today') {
      filters.dueDate = { $gte: startOfToday, $lt: new Date(+startOfToday + 86400000) };
    } else if (due === 'week') {
      filters.dueDate = { $gte: startOfToday, $lt: new Date(+startOfToday + 7 * 86400000) };
    }

    const sortFields = {
      position: { list: 1, position: 1 },
      dueDate: { dueDate: 1, position: 1 },
      createdAt: { createdAt: 1 },
    };
    const direction = order === 'desc' ? -1 : 1;
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 500));
    const [data, total] = await Promise.all([
      sort === 'priority'
        ? Task.aggregate([
          {
            $match: {
              ...filters,
              project: new mongoose.Types.ObjectId(projectId),
              ...(label ? { labels: new mongoose.Types.ObjectId(label) } : {}),
            },
          },
          {
            $addFields: {
              priorityRank: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$priority', 'High'] }, then: 0 },
                    { case: { $eq: ['$priority', 'Medium'] }, then: 1 },
                    { case: { $eq: ['$priority', 'Low'] }, then: 2 },
                  ],
                  default: 1,
                },
              },
            },
          },
          { $sort: { priorityRank: direction, position: direction } },
          { $skip: (safePage - 1) * safeLimit },
          { $limit: safeLimit },
          { $project: { priorityRank: 0 } },
        ]).then((tasks) => Task.populate(tasks, [
          { path: 'labels', select: 'name color' },
          { path: 'assignees', select: 'username email' },
        ]))
        : Task.find(filters)
          .populate('labels', 'name color')
          .populate('assignees', 'username email')
          .sort(Object.fromEntries(
            Object.entries(sortFields[sort] || sortFields.position)
              .map(([field, value]) => [field, field === 'list' ? value : value * direction])
          ))
          .skip((safePage - 1) * safeLimit)
          .limit(safeLimit),
      Task.countDocuments(filters),
    ]);

    return res.json({ data, page: safePage, limit: safeLimit, total });
  } catch (error) {
    return next(error);
  }
};

const getTasksByProjectLegacy = async (req, res, next) => {
  try {
    const access = await checkProjectAccess(req.params.projectId, req.user._id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    const tasks = await Task.find({
      project: req.params.projectId,
    }).populate('labels', 'name color').populate('assignees', 'username email')
      .sort({ list: 1, position: 1, order: 1 });
    return res.json(tasks);
  } catch (error) {
    return next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }

    if (req.body.list !== undefined) {
      const listExists = await List.exists({
        _id: req.body.list,
        project: task.project,
      });
      if (!listExists) return res.status(404).json({ message: 'List not found' });
      if (String(req.body.list) !== String(task.list)) {
        const targetTasks = await Task.find({
          list: req.body.list,
          _id: { $ne: task._id },
        }).sort({ position: 1, createdAt: 1 });
        const result = calculatePosition(
          targetTasks,
          undefined,
          targetTasks.at(-1)?._id
        );
        if (result.error) return res.status(400).json({ message: result.error });
        if (result.rebalance) {
          await Promise.all(result.rebalance.map(({ id, position }) =>
            Task.updateOne({ _id: id }, { $set: { position } })
          ));
        }
        task.position = result.position;
        task.order = result.insertionIndex;
      }
    }
    if (req.body.labels && !(await validateLabels(req.body.labels, task.project))) {
      return res.status(400).json({ message: 'One or more labels are invalid' });
    }
    if (req.body.assignees !== undefined
      && !(await validateAssignees(req.body.assignees, task.workspace))) {
      return res.status(400).json({ message: 'One or more assignees are not workspace members' });
    }

    const fields = ['title', 'description', 'list', 'priority', 'dueDate', 'status', 'labels', 'assignees'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) task[field] = req.body[field];
    });
    if (req.body.assignees !== undefined) {
      task.assignees = [...new Set(req.body.assignees.map(String))];
      task.assignedTo = task.assignees[0] || null;
    }
    const updated = await task.save();
    await logActivity(task.workspace, req.user._id, 'task.updated', 'task', task._id);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    task.status = req.body.status;
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.status_updated', 'task', task._id, { status: task.status });
    return res.json(task);
  } catch (error) {
    return next(error);
  }
};

const moveTask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    const targetList = await List.findOne({
      _id: req.body.listId,
      project: task.project,
    });
    if (!targetList) return res.status(400).json({ message: 'Target list is invalid' });

    const tasks = await Task.find({
      list: req.body.listId,
      _id: { $ne: task._id },
    }).sort({ position: 1, createdAt: 1 });
    const result = calculatePosition(
      tasks,
      req.body.beforeTaskId,
      req.body.afterTaskId
    );
    if (result.error) return res.status(400).json({ message: result.error });

    if (result.rebalance) {
      await Promise.all(result.rebalance.map(({ id, position }) =>
        Task.updateOne({ _id: id }, { $set: { position } })
      ));
    }
    task.list = targetList._id;
    task.position = result.position;
    task.order = result.insertionIndex;
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.moved', 'task', task._id, { listId: task.list });
    return res.json(task);
  } catch (error) {
    return next(error);
  }
};

const addSubtask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    const position = task.subtasks.length
      ? Math.max(...task.subtasks.map((subtask) => subtask.position)) + POSITION_GAP
      : POSITION_GAP;
    task.subtasks.push({ title: req.body.title.trim(), position });
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.subtask_created', 'task', task._id, {
      subtaskId: task.subtasks[task.subtasks.length - 1]._id,
    });
    return res.status(201).json(task.subtasks[task.subtasks.length - 1]);
  } catch (error) {
    return next(error);
  }
};

const updateSubtask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found' });
    if (req.body.title !== undefined) subtask.title = req.body.title.trim();
    if (req.body.done !== undefined) subtask.done = req.body.done;
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.subtask_updated', 'task', task._id, {
      subtaskId: subtask._id,
    });
    return res.json(subtask);
  } catch (error) {
    return next(error);
  }
};

const deleteSubtask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found' });
    subtask.deleteOne();
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.subtask_deleted', 'task', task._id, {
      subtaskId: subtask._id,
    });
    return res.json({ message: 'Subtask removed' });
  } catch (error) {
    return next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await findTaskById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    await task.deleteOne();
    await logActivity(task.workspace, req.user._id, 'task.deleted', 'task', task._id);
    return res.json({ message: 'Task removed' });
  } catch (error) {
    return next(error);
  }
};

const updateTaskAssignees = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !(await checkProjectAccess(task.project, req.user._id))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const project = await checkProjectAccess(task.project, req.user._id);
    if (!(await canEditProject(project, req.user._id))) return res.status(403).json({ message: 'Workspace is read-only for your role' });
    if (!(await validateAssignees(req.body.assignees, task.workspace))) {
      return res.status(400).json({ message: 'One or more assignees are not workspace members' });
    }
    task.assignees = [...new Set(req.body.assignees.map(String))];
    task.assignedTo = task.assignees[0] || null;
    await task.save();
    await logActivity(task.workspace, req.user._id, 'task.assignees_updated', 'task', task._id, {
      assignees: task.assignees,
    });
    return res.json(task);
  } catch (error) {
    return next(error);
  }
};

const getMyTasks = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.user._id }).select('workspace');
    const workspaceIds = memberships.map((membership) => membership.workspace);
    const tasks = await Task.find({
      workspace: { $in: workspaceIds },
      $or: [{ assignees: req.user._id }, { assignedTo: req.user._id }],
    }).populate('project', 'title').populate('list', 'title').populate('assignees', 'username email')
      .sort({ dueDate: 1, position: 1 });
    return res.json(tasks);
  } catch (error) {
    return next(error);
  }
};

const getWorkspaceMyTasks = async (req, res, next) => {
  try {
    if (!(await getMembership(req.user._id, req.params.workspaceId))) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    const tasks = await Task.find({
      workspace: req.params.workspaceId,
      $or: [{ assignees: req.user._id }, { assignedTo: req.user._id }],
      status: { $ne: 'done' },
    }).populate('project', 'title').populate('list', 'title')
      .populate('assignees', 'username email').sort({ dueDate: 1, position: 1 });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const groups = { overdue: [], today: [], thisWeek: [], later: [], noDate: [] };
    tasks.forEach((task) => {
      if (!task.dueDate) groups.noDate.push(task);
      else {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < now) groups.overdue.push(task);
        else if (+dueDate === +now) groups.today.push(task);
        else if (dueDate < weekEnd) groups.thisWeek.push(task);
        else groups.later.push(task);
      }
    });
    return res.json({ ...groups, groups, tasks });
  } catch (error) {
    return next(error);
  }
};

const getTaskActivity = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !(await getMembership(req.user._id, task.workspace))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = {
      workspace: task.workspace,
      $or: [
        { entityId: task._id },
        { 'metadata.taskId': task._id },
      ],
    };
    const [data, total] = await Promise.all([
      ActivityLog.find(filter).populate('actor', 'username').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit),
      ActivityLog.countDocuments(filter),
    ]);
    return res.json({
      data,
      page,
      limit,
      total,
      hasNextPage: page * limit < total,
      nextPage: page * limit < total ? page + 1 : null,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTaskById,
  createTask,
  getTasksByProject,
  getTasksByProjectLegacy,
  updateTask,
  updateTaskStatus,
  moveTask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  deleteTask,
  updateTaskAssignees,
  getMyTasks,
  getWorkspaceMyTasks,
  getTaskActivity,
};
