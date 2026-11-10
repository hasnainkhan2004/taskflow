const crypto = require('crypto');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const Invitation = require('../models/Invitation');
const Project = require('../models/Project');
const List = require('../models/List');
const Task = require('../models/Task');
const Label = require('../models/Label');
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const {
  DEMO_PASSWORD,
  SEED_TAG,
  resetSeedData,
  runCli,
  seedDatabase,
} = require('../scripts/seed');

describe('development demo seed', () => {
  test('creates the demo accounts, workspace, boards, comments, and activity', async () => {
    const output = [];
    const result = await seedDatabase({ output: (line) => output.push(line) });

    expect(result).toMatchObject({ demoUsers: 5, projects: 8, teamTasks: 60 });
    expect(await User.countDocuments({ seedTag: SEED_TAG })).toBe(5);
    const ayesha = await User.findOne({ email: 'ayesha.owner@taskflow.demo' }).select('+password');
    expect(await ayesha.matchPassword(DEMO_PASSWORD)).toBe(true);

    const team = await Workspace.findOne({ name: 'Acme Studio' });
    expect(team.seedTag).toBe(SEED_TAG);
    expect(await Membership.countDocuments({ workspace: team._id, seedTag: SEED_TAG })).toBe(4);
    expect(await Project.countDocuments({ workspace: team._id, seedTag: SEED_TAG })).toBe(6);
    expect(await List.countDocuments({ seedTag: SEED_TAG })).toBe(21);
    expect(await Task.countDocuments({ workspace: team._id, seedTag: SEED_TAG })).toBe(60);
    expect(await Comment.countDocuments({ workspace: team._id, seedTag: SEED_TAG })).toBe(30);
    expect(await ActivityLog.countDocuments({ workspace: team._id, seedTag: SEED_TAG })).toBeGreaterThanOrEqual(60);
    expect(await Label.countDocuments({ seedTag: SEED_TAG })).toBeGreaterThan(0);
    const editedComment = await Comment.findOne({ workspace: team._id, seedTag: SEED_TAG, editedAt: { $ne: null } });
    expect(editedComment).toBeTruthy();
    expect(await Comment.countDocuments({ workspace: team._id, seedTag: SEED_TAG, deletedAt: { $ne: null } })).toBe(1);

    const backlog = await Project.findOne({ title: 'Customer Support Backlog', seedTag: SEED_TAG });
    const backlogList = await List.findOne({ project: backlog._id, title: 'Backlog' });
    expect(await Task.countDocuments({ list: backlogList._id, seedTag: SEED_TAG })).toBe(25);
    const tasks = await Task.find({ workspace: team._id, seedTag: SEED_TAG });
    expect(new Set(tasks.map((task) => task.priority))).toEqual(new Set(['Low', 'Medium', 'High']));
    expect(new Set(tasks.map((task) => task.status))).toEqual(new Set(['todo', 'in_progress', 'done']));
    expect(tasks.filter((task) => task.completedAt)).not.toHaveLength(0);
    const assignedUsers = await User.find({
      _id: { $in: tasks.flatMap((task) => task.assignees) },
    });
    expect(assignedUsers.map((user) => user.username).sort()).toEqual(['ayesha', 'bilal', 'sara']);
    for (const task of tasks) {
      expect(String(task.owner)).toBe(String(task.createdBy));
      if (task.assignedTo) expect(task.assignees.map(String)).toContain(String(task.assignedTo));
      expect(String(task.workspace)).toBe(String(team._id));
      expect(task.position % 1024).toBe(0);
      expect(task.order).toBe(task.position / 1024 - 1);
      expect(task.status === 'done').toBe(Boolean(task.completedAt));
    }
    const longTitle = tasks.find((task) => task.title.startsWith('Coordinate the unusually long'));
    expect(longTitle.title.length).toBeGreaterThan(140);
    expect(longTitle.title.length).toBeLessThanOrEqual(200);
    expect(longTitle.description.split('\n\n')).toHaveLength(3);
    expect(tasks.some((task) => task.title === '<b>Fix</b> login & signup ✅')).toBe(true);
    expect(await Project.countDocuments({ seedTag: SEED_TAG, title: 'My Private Notes' })).toBe(1);
    expect(await Task.countDocuments({
      seedTag: SEED_TAG,
      workspace: (await Workspace.findOne({ owner: (await User.findOne({ email: 'zain.outsider@taskflow.demo' }))._id, isPersonal: true }))._id,
    })).toBe(1);
    expect(await Membership.exists({
      workspace: team._id,
      user: (await User.findOne({ email: 'zain.outsider@taskflow.demo' }))._id,
    })).toBeNull();

    const pending = await Invitation.findOne({ status: 'pending', seedTag: SEED_TAG }).select('+tokenHash');
    expect(pending.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const inviteLine = output.find((line) => line.includes('/invite/'));
    expect(inviteLine).toBeTruthy();
    const token = inviteLine.match(/\/invite\/([a-f0-9]+)$/)[1];
    expect(pending.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(await Invitation.countDocuments({ status: 'expired', seedTag: SEED_TAG })).toBe(1);
    expect(await Invitation.countDocuments({ status: 'revoked', seedTag: SEED_TAG })).toBe(1);
  });

  test('is idempotent and does not duplicate demo records', async () => {
    await seedDatabase();
    const countsBefore = {
      users: await User.countDocuments({ seedTag: SEED_TAG }),
      projects: await Project.countDocuments({ seedTag: SEED_TAG }),
      lists: await List.countDocuments({ seedTag: SEED_TAG }),
      tasks: await Task.countDocuments({ seedTag: SEED_TAG }),
      comments: await Comment.countDocuments({ seedTag: SEED_TAG }),
      activities: await ActivityLog.countDocuments({ seedTag: SEED_TAG }),
      invitations: await Invitation.countDocuments({ seedTag: SEED_TAG }),
    };

    await seedDatabase();
    expect({
      users: await User.countDocuments({ seedTag: SEED_TAG }),
      projects: await Project.countDocuments({ seedTag: SEED_TAG }),
      lists: await List.countDocuments({ seedTag: SEED_TAG }),
      tasks: await Task.countDocuments({ seedTag: SEED_TAG }),
      comments: await Comment.countDocuments({ seedTag: SEED_TAG }),
      activities: await ActivityLog.countDocuments({ seedTag: SEED_TAG }),
      invitations: await Invitation.countDocuments({ seedTag: SEED_TAG }),
    }).toEqual(countsBefore);
  });

  test('dry run performs no writes, even when reset is requested', async () => {
    const result = await seedDatabase({ dryRun: true, reset: true });
    expect(result).toMatchObject({ dryRun: true, resetRequested: true });
    expect(await User.countDocuments()).toBe(0);
    expect(await Workspace.countDocuments()).toBe(0);
  });

  test('personal-only seed adds twelve assigned tasks idempotently without creating other accounts or workspaces', async () => {
    const user = await User.create({
      username: 'hasee',
      email: 'hasee2615@gmail.com',
      password: 'Strong!Unrelated456',
    });
    const workspace = await Workspace.create({
      name: 'Hasnain Personal',
      slug: 'hasnain-personal',
      owner: user._id,
      createdBy: user._id,
      isPersonal: true,
    });
    await Membership.create({ workspace: workspace._id, user: user._id, role: 'owner' });

    const options = { personalOnly: true, ownerEmail: user.email };
    const first = await seedDatabase(options);
    expect(first).toEqual({ projects: 2, lists: 6, tasks: 12 });
    const seededTasks = await Task.find({ workspace: workspace._id, seedTag: SEED_TAG });
    expect(seededTasks).toHaveLength(12);
    expect(seededTasks.every((task) => String(task.assignedTo) === String(user._id))).toBe(true);
    expect(new Set(seededTasks.map((task) => task.status))).toEqual(new Set(['todo', 'in_progress', 'done']));
    expect(seededTasks.every((task) => task.workspace.equals(workspace._id))).toBe(true);
    expect(await ActivityLog.countDocuments({ workspace: workspace._id, seedTag: SEED_TAG })).toBeGreaterThan(12);

    const second = await seedDatabase(options);
    expect(second).toEqual(first);
    expect(await User.countDocuments()).toBe(1);
    expect(await Workspace.countDocuments()).toBe(1);
    expect(await Project.countDocuments({ workspace: workspace._id })).toBe(2);
    expect(await List.countDocuments({ project: { $in: await Project.find({ workspace: workspace._id }).distinct('_id') } })).toBe(6);
    expect(await Task.countDocuments({ workspace: workspace._id })).toBe(12);
  });

  test('personal-only CLI dry run requires an owner and does not connect', async () => {
    const output = [];
    const connect = jest.fn();
    const result = await runCli(
      ['--personal-only', '--owner-email=hasee2615@gmail.com', '--dry-run'],
      {
        env: {
          NODE_ENV: 'development',
          MONGO_URI: 'mongodb+srv://name:secret@cluster.example.test/taskflow',
        },
        connect,
        output: (line) => output.push(line),
      }
    );
    expect(result).toMatchObject({ dryRun: true, projects: 2, lists: 6, tasks: 12 });
    expect(output.join('\n')).toContain('Personal-only plan');
    expect(output.join('\n')).not.toContain('secret');
    expect(connect).not.toHaveBeenCalled();
    expect(() => require('../scripts/seed').parseArgs(['--personal-only']))
      .toThrow('--personal-only requires --owner-email');
    expect(() => require('../scripts/seed').parseArgs([
      '--personal-only', '--owner-email=hasee2615@gmail.com', '--reset',
    ])).toThrow('cannot be combined with --reset');
  });

  test('CLI dry run prints the plan and never connects or writes', async () => {
    const output = [];
    const connect = jest.fn();
    const result = await runCli(['--dry-run', '--reset', '--owner-email=owner@example.test'], {
      env: { NODE_ENV: 'development', MONGO_URI: 'mongodb+srv://name:secret@cluster.example.test/taskflow' },
      connect,
      output: (line) => output.push(line),
    });
    expect(result).toMatchObject({ dryRun: true, resetRequested: true, projects: 10 });
    expect(connect).not.toHaveBeenCalled();
    expect(output.join('\n')).toContain('taskflow');
    expect(output.join('\n')).toContain('Dry run plan');
    expect(output.join('\n')).not.toContain('secret');
    expect(await User.countDocuments()).toBe(0);
    expect(await Workspace.countDocuments()).toBe(0);
  });

  test('reset removes seed data but preserves the optional owner and untagged personal data', async () => {
    const owner = await User.create({
      username: 'real_owner',
      email: 'owner@example.test',
      password: 'Strong!Unrelated456',
    });
    const personal = await Workspace.create({
      name: 'Owner Personal',
      slug: 'owner-personal',
      owner: owner._id,
      createdBy: owner._id,
      isPersonal: true,
    });
    await Membership.create({ workspace: personal._id, user: owner._id, role: 'owner' });
    const realProject = await Project.create({
      title: 'Unseeded project',
      owner: owner._id,
      workspace: personal._id,
    });

    await seedDatabase({ ownerEmail: owner.email });
    const team = await Workspace.findOne({ name: 'Acme Studio', seedTag: SEED_TAG });
    expect((await Membership.findOne({ workspace: team._id, user: owner._id })).role).toBe('owner');
    expect((await Membership.findOne({
      workspace: team._id,
      user: await User.findOne({ email: 'ayesha.owner@taskflow.demo' }).then((user) => user._id),
    })).role).toBe('admin');
    expect(await Project.countDocuments({ workspace: personal._id, seedTag: SEED_TAG })).toBe(2);

    await resetSeedData({ ownerEmail: owner.email });
    expect(await User.exists({ _id: owner._id })).toBeTruthy();
    expect(await Workspace.exists({ _id: personal._id })).toBeTruthy();
    expect(await Project.exists({ _id: realProject._id })).toBeTruthy();
    expect(await Project.countDocuments({ workspace: personal._id, seedTag: SEED_TAG })).toBe(0);
    expect(await User.countDocuments({ seedTag: SEED_TAG })).toBe(0);
    expect(await Workspace.countDocuments({ seedTag: SEED_TAG })).toBe(0);
    expect(await Project.countDocuments({ seedTag: SEED_TAG })).toBe(0);
    expect(await Task.countDocuments({ seedTag: SEED_TAG })).toBe(0);
    expect(await ActivityLog.countDocuments({ seedTag: SEED_TAG })).toBe(0);
  });

  test('refuses production before attempting a connection', async () => {
    const connect = jest.fn();
    await expect(runCli([], {
      env: { NODE_ENV: 'production' },
      connect,
    })).rejects.toThrow('disabled when NODE_ENV=production');
    await expect(seedDatabase({ env: { NODE_ENV: 'production' } }))
      .rejects.toThrow('disabled when NODE_ENV=production');
    expect(connect).not.toHaveBeenCalled();
  });
});
