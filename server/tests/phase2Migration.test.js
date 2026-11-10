const mongoose = require('mongoose');
const migratePhase2 = require('../utils/phase2Migration');

describe('Phase 2 migration', () => {
  test('is safe to dry-run and repeat', async () => {
    const userId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const users = mongoose.connection.collection('users');
    const projects = mongoose.connection.collection('projects');
    const tasks = mongoose.connection.collection('tasks');
    const invitations = mongoose.connection.collection('invitations');
    const skippedProjectId = new mongoose.Types.ObjectId();
    await users.insertOne({ _id: userId, username: 'migrationuser' });
    await projects.insertOne({ _id: projectId, owner: userId, members: [] });
    await projects.insertOne({ _id: skippedProjectId, title: 'No owner record' });
    await tasks.insertOne({ _id: taskId, project: projectId, owner: userId, assignedTo: userId });
    const invitationId = new mongoose.Types.ObjectId();
    await invitations.insertOne({
      _id: invitationId,
      workspace: new mongoose.Types.ObjectId(),
      email: 'legacy@example.com',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const dryRun = await migratePhase2({ dryRun: true });
    expect(dryRun.workspaces).toBe(1);
    expect(dryRun.usersProcessed).toBe(1);
    expect(dryRun.projectsSkipped).toBe(1);
    expect(await mongoose.connection.collection('workspaces').countDocuments()).toBe(0);

    await migratePhase2();
    const firstCounts = await Promise.all([
      mongoose.connection.collection('workspaces').countDocuments(),
      mongoose.connection.collection('memberships').countDocuments(),
    ]);
    await migratePhase2();
    const secondCounts = await Promise.all([
      mongoose.connection.collection('workspaces').countDocuments(),
      mongoose.connection.collection('memberships').countDocuments(),
    ]);
    expect(secondCounts).toEqual(firstCounts);
    expect((await projects.findOne({ _id: projectId })).workspace).toBeDefined();
    expect(await projects.findOne({ _id: skippedProjectId })).toBeTruthy();
    expect((await tasks.findOne({ _id: taskId })).assignees).toEqual([userId]);
    expect((await invitations.findOne({ _id: invitationId })).status).toBe('pending');
    const workspace = await mongoose.connection.collection('workspaces').findOne({ owner: userId });
    expect(workspace.isPersonal).toBe(true);
    expect(workspace.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const second = await migratePhase2();
    expect(second.usersProcessed).toBe(1);
    expect(second.projectsSkipped).toBe(1);
  });
});
