const mongoose = require('mongoose');

const slugBase = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60)
  .replace(/-+$/g, '') || 'workspace';

const migratePhase2 = async ({ dryRun = false } = {}) => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const workspaces = db.collection('workspaces');
  const memberships = db.collection('memberships');
  const projects = db.collection('projects');
  const tasks = db.collection('tasks');
  const invitations = db.collection('invitations');
  const stats = {
    usersProcessed: 0,
    workspaces: 0,
    memberships: 0,
    projects: 0,
    projectsSkipped: 0,
    tasks: 0,
    invitations: 0,
  };
  const workspaceByOwner = new Map();
  const knownMemberships = new Set();
  const reservedSlugs = new Set();

  const uniqueSlug = async (value, ownId) => {
    const base = slugBase(value);
    let slug = base;
    let suffix = 1;
    while (
      reservedSlugs.has(slug)
      || await workspaces.findOne({ slug, ...(ownId ? { _id: { $ne: ownId } } : {}) })
    ) {
      const ending = `-${suffix}`;
      slug = `${base.slice(0, 60 - ending.length).replace(/-+$/g, '')}${ending}`;
      suffix += 1;
    }
    reservedSlugs.add(slug);
    return slug;
  };

  try {
    const invitationIndexes = await invitations.listIndexes().toArray();
    const oldExpiryIndex = invitationIndexes.find((index) =>
      index.key?.expiresAt === 1 && index.expireAfterSeconds !== undefined
    );
    if (oldExpiryIndex && !dryRun) await invitations.dropIndex(oldExpiryIndex.name);
  } catch (error) {
    if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error;
  }

  for await (const workspace of workspaces.find({})) {
    const slug = await uniqueSlug(workspace.slug || workspace.name, workspace._id);
    const isPersonal = workspace.isPersonal ?? workspace.personal ?? false;
    const set = {};
    if (workspace.slug !== slug) set.slug = slug;
    if (workspace.isPersonal !== isPersonal) set.isPersonal = isPersonal;
    if (workspace.personal !== undefined) {
      if (!dryRun) await workspaces.updateOne({ _id: workspace._id }, { $unset: { personal: '' } });
    }
    if (Object.keys(set).length) {
      stats.workspaces += 1;
      if (!dryRun) await workspaces.updateOne({ _id: workspace._id }, { $set: set });
    }
  }

  for await (const user of users.find({}, { projection: { _id: 1, username: 1, email: 1 } })) {
    stats.usersProcessed += 1;
    let workspace = await workspaces.findOne({
      owner: user._id,
      $or: [{ isPersonal: true }, { personal: true }],
    });
    if (!workspace) {
      const base = slugBase(user.username || user.email?.split('@')[0] || 'personal');
      const slug = await uniqueSlug(`${base}-workspace`);
      workspace = {
        _id: new mongoose.Types.ObjectId(),
        name: `${user.username || user.email?.split('@')[0] || 'Personal'}'s Workspace`,
        slug,
        owner: user._id,
        createdBy: user._id,
        isPersonal: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      stats.workspaces += 1;
      if (!dryRun) await workspaces.insertOne(workspace);
    }
    workspaceByOwner.set(String(user._id), workspace);
    const membership = await memberships.findOne({ workspace: workspace._id, user: user._id });
    if (!membership) {
      stats.memberships += 1;
      if (!dryRun) {
        await memberships.updateOne(
          { workspace: workspace._id, user: user._id },
          { $setOnInsert: { workspace: workspace._id, user: user._id, role: 'owner', joinedAt: new Date() } },
          { upsert: true }
        );
      }
    }
    knownMemberships.add(`${workspace._id}:${user._id}`);
  }

  for await (const project of projects.find({})) {
    if (!project.owner) {
      stats.projectsSkipped += 1;
      continue;
    }
    let workspaceId = project.workspace;
    let workspace = workspaceId ? await workspaces.findOne({ _id: workspaceId }) : null;
    if (!workspace) {
      workspace = workspaceByOwner.get(String(project.owner))
        || await workspaces.findOne({
          owner: project.owner,
          $or: [{ isPersonal: true }, { personal: true }],
        });
      if (!workspace) {
        stats.projectsSkipped += 1;
        continue;
      }
      workspaceId = workspace._id;
      stats.projects += 1;
      if (!dryRun) await projects.updateOne({ _id: project._id }, { $set: { workspace: workspaceId } });
    }
    const memberIds = [...new Set([project.owner, ...(project.members || [])].filter(Boolean).map(String))];
    for (const id of memberIds) {
      const userId = new mongoose.Types.ObjectId(id);
      const membershipKey = `${workspaceId}:${userId}`;
      if (knownMemberships.has(membershipKey)
        || await memberships.findOne({ workspace: workspaceId, user: userId })) {
        knownMemberships.add(membershipKey);
        continue;
      }
      stats.memberships += 1;
      knownMemberships.add(membershipKey);
      if (!dryRun) {
        await memberships.updateOne(
          { workspace: workspaceId, user: userId },
          { $setOnInsert: {
            workspace: workspaceId,
            user: userId,
            role: id === String(workspace.owner) ? 'owner' : 'member',
            joinedAt: new Date(),
          } },
          { upsert: true }
        );
      }
    }
    const cursor = tasks.find({
      project: project._id,
      $or: [
        { workspace: { $exists: false } },
        { createdBy: { $exists: false } },
        { assignees: { $exists: false } },
      ],
    });
    for await (const task of cursor) {
      const set = {};
      if (!task.workspace) set.workspace = workspaceId;
      if (!task.createdBy) set.createdBy = task.owner || project.owner;
      if (!task.assignees) set.assignees = task.assignedTo ? [task.assignedTo] : [];
      if (Object.keys(set).length) {
        stats.tasks += 1;
        if (!dryRun) await tasks.updateOne({ _id: task._id }, { $set: set });
      }
    }
  }

  for await (const invitation of invitations.find({})) {
    const status = invitation.status || (invitation.acceptedAt
      ? 'accepted'
      : (invitation.expiresAt <= new Date() ? 'expired' : 'pending'));
    const update = {};
    if (invitation.status !== status) update.status = status;
    if (Object.keys(update).length) {
      stats.invitations += 1;
      if (!dryRun) await invitations.updateOne({ _id: invitation._id }, { $set: update });
    }
  }

  const pendingByWorkspaceEmail = new Set();
  const pendingInvitations = invitations.find({ status: 'pending' }).sort({ createdAt: -1 });
  for await (const invitation of pendingInvitations) {
    const key = `${invitation.workspace}:${String(invitation.email).toLowerCase()}`;
    if (!pendingByWorkspaceEmail.has(key)) {
      pendingByWorkspaceEmail.add(key);
      continue;
    }
    stats.invitations += 1;
    if (!dryRun) {
      await invitations.updateOne({ _id: invitation._id }, { $set: { status: 'revoked' } });
    }
  }

  return stats;
};

module.exports = migratePhase2;
