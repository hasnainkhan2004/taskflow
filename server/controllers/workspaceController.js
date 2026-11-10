const crypto = require('crypto');
const mongoose = require('mongoose');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const List = require('../models/List');
const Label = require('../models/Label');
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const { getMembership, canManageMembers, canManageWorkspace } = require('../utils/permissions');
const { sendInvitationEmail } = require('../utils/email');
const { logActivity } = require('../utils/activity');

const notFound = (res) => res.status(404).json({ message: 'Workspace not found' });

const createWorkspace = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 60) return res.status(400).json({ message: 'Workspace name must be 1–60 characters' });
    const workspace = await Workspace.create({ name, owner: req.user._id, createdBy: req.user._id });
    await Membership.create({ workspace: workspace._id, user: req.user._id, role: 'owner' });
    await logActivity(workspace._id, req.user._id, 'workspace.created', 'workspace', workspace._id);
    return res.status(201).json({ ...workspace.toObject(), role: 'owner' });
  } catch (error) {
    return next(error);
  }
};

const listWorkspaces = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.user._id })
      .populate('workspace', 'name slug owner isPersonal personal createdAt updatedAt').lean();
    return res.json(memberships.filter((m) => m.workspace).map(({ workspace, role }) => ({ ...workspace, role })));
  } catch (error) {
    return next(error);
  }
};

const getWorkspace = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    return res.json({ ...workspace.toObject(), role: membership.role });
  } catch (error) {
    return next(error);
  }
};

const updateWorkspace = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageMembers(membership)) return res.status(403).json({ message: 'Workspace admin role required' });
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 60) return res.status(400).json({ message: 'Workspace name must be 1–60 characters' });
      workspace.name = name;
    }
    return res.json(await workspace.save());
  } catch (error) {
    return next(error);
  }
};

const listMembers = async (req, res, next) => {
  try {
    if (!(await getMembership(req.user._id, req.params.workspaceId))) return notFound(res);
    const members = await Membership.find({ workspace: req.params.workspaceId })
      .populate('user', 'username email createdAt').lean();
    return res.json(members.filter((m) => m.user).map(({ user, role, joinedAt }) => ({ ...user, role, joinedAt })));
  } catch (error) {
    return next(error);
  }
};

const inviteMember = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageMembers(membership)) return res.status(403).json({ message: 'Workspace admin role required' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role || 'member';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    if (!['member', 'admin', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invitation role must be admin, member, or viewer' });
    }
    if (role === 'admin' && !canManageWorkspace(membership)) {
      return res.status(403).json({ message: 'Only an owner can invite an admin' });
    }
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    const existing = await User.findOne({ email });
    if (existing && await Membership.exists({ workspace: workspace._id, user: existing._id })) {
      return res.status(409).json({ message: 'User is already a workspace member' });
    }
    const pending = await Invitation.findOne({
      workspace: workspace._id, email, status: 'pending', expiresAt: { $gt: new Date() },
    });
    if (pending) return res.status(409).json({ message: 'An invitation is already pending' });
    const token = crypto.randomBytes(32).toString('hex');
    const invitation = await Invitation.create({
      workspace: workspace._id,
      email,
      role,
      invitedBy: req.user._id,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    });
    const base = (process.env.CLIENT_URL || '').replace(/\/$/, '');
    try {
      await sendInvitationEmail(email, `${base}/invite/${token}`, workspace.name);
    } catch (emailError) {
      await invitation.deleteOne();
      return next(emailError);
    }
    await logActivity(workspace._id, req.user._id, 'invitation.created', 'invitation', invitation._id, { email, role });
    return res.status(201).json(invitation);
  } catch (error) {
    return next(error);
  }
};

const acceptInvitation = async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    if (!token || token.length > 256) return res.status(400).json({ message: 'Invitation token is invalid' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found or expired' });
    if (invitation.status === 'pending' && invitation.expiresAt <= new Date()) {
      invitation.status = 'expired';
      await invitation.save();
    }
    if (invitation.status !== 'pending') return res.status(404).json({ message: 'Invitation not found or expired' });
    if (invitation.email !== req.user.email) return res.status(403).json({ message: 'Invitation belongs to another account' });
    if (await Membership.exists({ workspace: invitation.workspace, user: req.user._id })) {
      return res.status(409).json({ message: 'You are already a workspace member' });
    }
    await Membership.create({ workspace: invitation.workspace, user: req.user._id, role: invitation.role });
    invitation.acceptedAt = new Date();
    invitation.status = 'accepted';
    await invitation.save();
    await logActivity(invitation.workspace, req.user._id, 'invitation.accepted', 'invitation', invitation._id);
    return res.json({ message: 'Invitation accepted', workspaceId: invitation.workspace });
  } catch (error) {
    return next(error);
  }
};

const getInvitationPreview = async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (invitation.status === 'pending' && invitation.expiresAt <= new Date()) {
      invitation.status = 'expired';
      await invitation.save();
    }
    if (invitation.status !== 'pending') {
      return res.status(410).json({ message: `Invitation ${invitation.status}` });
    }
    const workspace = await Workspace.findById(invitation.workspace).select('name slug isPersonal personal');
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    const safeInvitation = invitation.toObject();
    return res.json({ invitation: safeInvitation, workspace });
  } catch (error) {
    return next(error);
  }
};

const acceptInvitationToken = async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (invitation.status === 'pending' && invitation.expiresAt <= new Date()) {
      invitation.status = 'expired';
      await invitation.save();
    }
    if (invitation.status !== 'pending') return res.status(410).json({ message: `Invitation ${invitation.status}` });
    if (invitation.email !== req.user.email) {
      return res.status(403).json({ message: 'Invitation belongs to another account' });
    }
    if (await Membership.exists({ workspace: invitation.workspace, user: req.user._id })) {
      return res.status(409).json({ message: 'You are already a workspace member' });
    }
    await Membership.create({ workspace: invitation.workspace, user: req.user._id, role: invitation.role });
    invitation.acceptedAt = new Date();
    invitation.status = 'accepted';
    await invitation.save();
    await logActivity(invitation.workspace, req.user._id, 'invitation.accepted', 'invitation', invitation._id);
    return res.json({ message: 'Invitation accepted', workspaceId: invitation.workspace });
  } catch (error) {
    return next(error);
  }
};

const declineInvitation = async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (invitation.status === 'pending' && invitation.expiresAt <= new Date()) {
      invitation.status = 'expired';
      await invitation.save();
    }
    if (invitation.status !== 'pending') return res.status(410).json({ message: `Invitation ${invitation.status}` });
    if (invitation.email !== req.user.email) {
      return res.status(403).json({ message: 'Invitation belongs to another account' });
    }
    invitation.status = 'declined';
    await invitation.save();
    await logActivity(invitation.workspace, req.user._id, 'invitation.declined', 'invitation', invitation._id);
    return res.json({ message: 'Invitation declined' });
  } catch (error) {
    return next(error);
  }
};

const listInvitations = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageMembers(membership)) return res.status(403).json({ message: 'Workspace admin role required' });
    await Invitation.updateMany(
      { workspace: req.params.workspaceId, status: 'pending', expiresAt: { $lte: new Date() } },
      { $set: { status: 'expired' } }
    );
    const invitations = await Invitation.find({
      workspace: req.params.workspaceId,
    }).select('-tokenHash').sort({ createdAt: -1 });
    return res.json(invitations);
  } catch (error) {
    return next(error);
  }
};

const revokeInvitation = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageMembers(membership)) return res.status(403).json({ message: 'Workspace admin role required' });
    const invitation = await Invitation.findOne({
      _id: req.params.invitationId, workspace: req.params.workspaceId, status: 'pending',
    });
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (membership.role === 'admin' && !['member', 'viewer'].includes(invitation.role)) {
      return res.status(403).json({ message: 'Admins can revoke member or viewer invitations only' });
    }
    invitation.status = 'revoked';
    await invitation.save();
    await logActivity(req.params.workspaceId, req.user._id, 'invitation.revoked', 'invitation', invitation._id);
    return res.json({ message: 'Invitation revoked' });
  } catch (error) {
    return next(error);
  }
};

const resendInvitation = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageMembers(membership)) return res.status(403).json({ message: 'Workspace admin role required' });
    const invitation = await Invitation.findOne({
      _id: req.params.invitationId,
      workspace: req.params.workspaceId,
      status: { $in: ['pending', 'expired'] },
    }).select('+tokenHash');
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
    if (membership.role === 'admin' && invitation.role !== 'member' && invitation.role !== 'viewer') {
      return res.status(403).json({ message: 'Admins can resend member or viewer invitations only' });
    }
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    const token = crypto.randomBytes(32).toString('hex');
    invitation.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    invitation.status = 'pending';
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invitation.save();
    try {
      await sendInvitationEmail(
        invitation.email,
        `${(process.env.CLIENT_URL || '').replace(/\/$/, '')}/invite/${token}`,
        workspace.name
      );
    } catch (emailError) {
      invitation.status = 'expired';
      await invitation.save();
      return next(emailError);
    }
    await logActivity(workspace._id, req.user._id, 'invitation.resent', 'invitation', invitation._id);
    return res.json(invitation);
  } catch (error) {
    return next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const acting = await getMembership(req.user._id, req.params.workspaceId);
    if (!acting) return notFound(res);
    if (!canManageWorkspace(acting)) return res.status(403).json({ message: 'Owner role required' });
    if (!['admin', 'member', 'viewer'].includes(req.body.role)) {
      return res.status(400).json({ message: 'Role must be admin, member, or viewer' });
    }
    const target = await Membership.findOne({ workspace: req.params.workspaceId, user: req.params.userId });
    if (!target) return res.status(404).json({ message: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ message: 'Transfer ownership to change the owner role' });
    target.role = req.body.role;
    await target.save();
    await logActivity(req.params.workspaceId, req.user._id, 'membership.role_changed', 'membership', target._id, { role: target.role });
    return res.json({ userId: target.user, role: target.role });
  } catch (error) {
    return next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const acting = await getMembership(req.user._id, req.params.workspaceId);
    if (!acting) return notFound(res);
    if (!canManageMembers(acting)) return res.status(403).json({ message: 'Workspace admin role required' });
    const target = await Membership.findOne({ workspace: req.params.workspaceId, user: req.params.userId });
    if (!target) return res.status(404).json({ message: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ message: 'Transfer ownership before removing the owner' });
    if (acting.role === 'admin' && !['member', 'viewer'].includes(target.role)) {
      return res.status(403).json({ message: 'Admins can remove members and viewers only' });
    }
    await Promise.all([
      Task.updateMany({ workspace: req.params.workspaceId }, { $pull: { assignees: target.user } }),
      Task.updateMany(
        { workspace: req.params.workspaceId, assignedTo: target.user },
        { $set: { assignedTo: null } }
      ),
      target.deleteOne(),
    ]);
    await logActivity(req.params.workspaceId, req.user._id, 'membership.removed', 'membership', target._id, { userId: target.user });
    return res.json({ message: 'Member removed' });
  } catch (error) {
    return next(error);
  }
};

const leaveWorkspace = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (membership.role === 'owner') return res.status(400).json({ message: 'Transfer ownership before leaving the workspace' });
    await Promise.all([
      Task.updateMany({ workspace: req.params.workspaceId }, { $pull: { assignees: req.user._id } }),
      Task.updateMany(
        { workspace: req.params.workspaceId, assignedTo: req.user._id },
        { $set: { assignedTo: null } }
      ),
      membership.deleteOne(),
    ]);
    await logActivity(req.params.workspaceId, req.user._id, 'membership.left', 'workspace', req.params.workspaceId);
    return res.json({ message: 'You left the workspace' });
  } catch (error) {
    return next(error);
  }
};

const transferOwnership = async (req, res, next) => {
  try {
    const acting = await getMembership(req.user._id, req.params.workspaceId);
    if (!acting) return notFound(res);
    if (!canManageWorkspace(acting)) return res.status(403).json({ message: 'Owner role required' });
    const userId = req.body.userId;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: 'Invalid user identifier' });
    const nextOwner = await Membership.findOne({ workspace: req.params.workspaceId, user: userId });
    if (!nextOwner) return res.status(404).json({ message: 'New owner must be a workspace member' });
    if (String(nextOwner.user) === String(acting.user)) {
      return res.status(400).json({ message: 'Choose another workspace member as the new owner' });
    }
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    const oldOwnerId = acting.user;
    acting.role = 'admin';
    nextOwner.role = 'owner';
    workspace.owner = nextOwner.user;
    await Promise.all([acting.save(), nextOwner.save(), workspace.save()]);
    await logActivity(workspace._id, oldOwnerId, 'workspace.ownership_transferred', 'workspace', workspace._id, { userId });
    return res.json({ message: 'Workspace ownership transferred' });
  } catch (error) {
    return next(error);
  }
};

const deleteWorkspace = async (req, res, next) => {
  try {
    const membership = await getMembership(req.user._id, req.params.workspaceId);
    if (!membership) return notFound(res);
    if (!canManageWorkspace(membership)) return res.status(403).json({ message: 'Owner role required' });
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return notFound(res);
    if (workspace.isPersonal || workspace.personal) return res.status(400).json({ message: 'Personal workspaces cannot be deleted' });
    const projects = await Project.find({ workspace: workspace._id }).select('_id').lean();
    const projectIds = projects.map((project) => project._id);
    await Promise.all([
      Task.deleteMany({ $or: [{ workspace: workspace._id }, { project: { $in: projectIds } }] }),
      List.deleteMany({ project: { $in: projectIds } }),
      Label.deleteMany({ project: { $in: projectIds } }),
      Comment.deleteMany({ workspace: workspace._id }),
      ActivityLog.deleteMany({ workspace: workspace._id }),
      Invitation.deleteMany({ workspace: workspace._id }),
      Membership.deleteMany({ workspace: workspace._id }),
      Project.deleteMany({ workspace: workspace._id }),
    ]);
    await workspace.deleteOne();
    return res.json({ message: 'Workspace deleted' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createWorkspace, listWorkspaces, getWorkspace, updateWorkspace, listMembers,
  inviteMember, acceptInvitation, listInvitations, revokeInvitation,
  updateMemberRole, removeMember, leaveWorkspace, transferOwnership,
  getInvitationPreview, acceptInvitationToken, declineInvitation, resendInvitation, deleteWorkspace,
};
