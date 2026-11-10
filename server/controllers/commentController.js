const Task = require('../models/Task');
const Comment = require('../models/Comment');
const {
  getMembership,
  canManageMembers,
  canEditWorkspaceContent,
} = require('../utils/permissions');
const { logActivity } = require('../utils/activity');

const accessibleTask = async (taskId, userId) => {
  const task = await Task.findById(taskId);
  if (!task || !(await getMembership(userId, task.workspace))) return null;
  return task;
};

const listComments = async (req, res, next) => {
  try {
    const task = await accessibleTask(req.params.taskId, req.user._id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const comments = await Comment.find({ task: task._id }).populate('author', 'username').sort({ createdAt: 1 });
    return res.json(comments);
  } catch (error) {
    return next(error);
  }
};

const createComment = async (req, res, next) => {
  try {
    const task = await accessibleTask(req.params.taskId, req.user._id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!canEditWorkspaceContent(await getMembership(req.user._id, task.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    const body = String(req.body.content ?? req.body.body ?? '').trim();
    if (!body || body.length > 5000) return res.status(400).json({ message: 'Comment must be 1–5000 characters' });
    const comment = await Comment.create({
      workspace: task.workspace, project: task.project, task: task._id, author: req.user._id, body,
    });
    await logActivity(task.workspace, req.user._id, 'comment.created', 'comment', comment._id, { taskId: task._id });
    await comment.populate('author', 'username');
    return res.status(201).json(comment);
  } catch (error) {
    return next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId || req.params.id);
    if (!comment || (req.params.taskId && String(comment.task) !== String(req.params.taskId))
      || !(await getMembership(req.user._id, comment.workspace))) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    const membership = await getMembership(req.user._id, comment.workspace);
    if (!canEditWorkspaceContent(membership) && !canManageMembers(membership)) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    if (String(comment.author) !== String(req.user._id) && !canManageMembers(membership)) {
      return res.status(403).json({ message: 'Only the author or workspace administrator can delete this comment' });
    }
    if (!comment.deletedAt) {
      comment.deletedAt = new Date();
      comment.body = '[deleted]';
      await comment.save();
      await logActivity(comment.workspace, req.user._id, 'comment.deleted', 'comment', comment._id);
    }
    return res.json({ message: 'Comment deleted' });
  } catch (error) {
    return next(error);
  }
};

const updateComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment || !(await getMembership(req.user._id, comment.workspace))) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    if (String(comment.author) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the comment author can edit it' });
    }
    if (!canEditWorkspaceContent(await getMembership(req.user._id, comment.workspace))) {
      return res.status(403).json({ message: 'Workspace is read-only for your role' });
    }
    if (comment.deletedAt) return res.status(409).json({ message: 'Deleted comments cannot be edited' });
    const body = String(req.body.content ?? req.body.body ?? '').trim();
    if (!body || body.length > 5000) return res.status(400).json({ message: 'Comment must be 1–5000 characters' });
    comment.body = body;
    await comment.save();
    await logActivity(comment.workspace, req.user._id, 'comment.updated', 'comment', comment._id, { taskId: comment.task });
    await comment.populate('author', 'username');
    return res.json(comment);
  } catch (error) {
    return next(error);
  }
};

module.exports = { listComments, createComment, deleteComment, updateComment };
