const Membership = require('../models/Membership');

const loadMemberships = async (userId) => Membership.find({ user: userId })
  .populate('workspace', 'name slug owner isPersonal personal createdAt')
  .lean();

const getMembership = async (userId, workspaceId) => {
  if (!workspaceId) return null;
  return Membership.findOne({ user: userId, workspace: workspaceId });
};

const hasRole = (membership, roles) => Boolean(membership && roles.includes(membership.role));

const canManageMembers = (membership) => hasRole(membership, ['owner', 'admin']);
const canManageWorkspace = (membership) => hasRole(membership, ['owner']);
const canEditWorkspaceContent = (membership) => hasRole(membership, ['owner', 'admin', 'member']);
const canManageProjects = (membership) => hasRole(membership, ['owner', 'admin']);

module.exports = {
  loadMemberships,
  getMembership,
  hasRole,
  canManageMembers,
  canManageWorkspace,
  canEditWorkspaceContent,
  canManageProjects,
};
