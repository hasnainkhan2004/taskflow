export const WORKSPACE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
};

const permissions = {
  owner: ['workspace:manage', 'workspace:delete', 'workspace:transfer', 'members:manage', 'invites:manage', 'projects:manage', 'tasks:manage'],
  admin: ['workspace:manage', 'members:manage', 'invites:manage', 'projects:manage', 'tasks:manage'],
  member: ['projects:create', 'tasks:manage'],
  viewer: [],
};

export const canWorkspace = (role, permission) => Boolean(permissions[role]?.includes(permission));

