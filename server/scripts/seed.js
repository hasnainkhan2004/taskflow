#!/usr/bin/env node

const crypto = require('crypto');
const dns = require('dns');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config();
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
const { POSITION_GAP } = require('../utils/positioning');
const { logActivity } = require('../utils/activity');

const SEED_TAG = 'demo-seed-v1';
const DEMO_PASSWORD = 'TaskFlow#Demo2026';
const CLIENT_URL = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const USERS = [
  { username: 'ayesha', email: 'ayesha.owner@taskflow.demo', role: 'owner' },
  { username: 'bilal', email: 'bilal.admin@taskflow.demo', role: 'admin' },
  { username: 'sara', email: 'sara@taskflow.demo', role: 'member' },
  { username: 'omar', email: 'omar.viewer@taskflow.demo', role: 'viewer' },
  { username: 'zain', email: 'zain.outsider@taskflow.demo', role: 'member' },
];
const LABELS = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#3b82f6' },
  { name: 'Design', color: '#a855f7' },
  { name: 'Urgent', color: '#f2674a' },
  { name: 'Research', color: '#14b8a6' },
  { name: 'Docs', color: '#64748b' },
];
const TEAM_PROJECTS = [
  { title: 'Website Redesign', lists: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'], count: 12 },
  { title: 'Mobile App Launch', lists: ['Backlog', 'In Progress', 'Done'], count: 10 },
  { title: 'Marketing Campaign Q1', lists: ['Backlog', 'To Do', 'In Progress', 'Done'], count: 10 },
  { title: 'Customer Support Backlog', lists: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'], count: 27 },
  { title: 'Internal Wiki', lists: ['Articles'], count: 1 },
  { title: 'Ideas Parking Lot', lists: [], count: 0 },
];
const MODELS = [ActivityLog, Comment, Task, List, Label, Invitation, Membership, Project, Workspace, User];

const assertNotProduction = (env = process.env) => {
  if (env.NODE_ENV === 'production') {
    throw new Error('The development seed script is disabled when NODE_ENV=production.');
  }
};

const parseArgs = (argv) => {
  const options = {
    reset: false,
    dryRun: false,
    yes: false,
    personalOnly: false,
    ownerEmail: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reset') options.reset = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--personal-only') options.personalOnly = true;
    else if (arg === '--owner-email' && argv[index + 1]) {
      options.ownerEmail = argv[index + 1].toLowerCase();
      index += 1;
    } else if (arg.startsWith('--owner-email=')) {
      options.ownerEmail = arg.slice('--owner-email='.length).toLowerCase();
    } else {
      throw new Error(`Unknown seed option: ${arg}`);
    }
  }
  if (options.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.ownerEmail)) {
    throw new Error('--owner-email must be a valid email address.');
  }
  if (options.personalOnly && !options.ownerEmail) {
    throw new Error('--personal-only requires --owner-email=<mail>.');
  }
  if (options.personalOnly && options.reset) {
    throw new Error('--personal-only cannot be combined with --reset.');
  }
  return options;
};

const databaseInfo = (uri) => {
  const parsed = new URL(uri);
  return {
    host: parsed.host,
    name: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || '(default)',
  };
};

const localDateOffset = (days, hour = 9) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0);
};

const dateFromOffset = (days, hour = 9) => localDateOffset(days, hour);

const tagged = (Model, query) => Model.findOne({ seedTag: SEED_TAG, ...query });

const ensureActivity = async ({
  workspace, actor, action, entityType, entityId, eventKey, metadata = {}, createdAt,
}) => {
  if (await ActivityLog.exists({ seedTag: SEED_TAG, 'metadata.eventKey': eventKey })) return;
  await logActivity(workspace, actor, action, entityType, entityId, {
    ...metadata,
    eventKey,
  }, { seedTag: SEED_TAG, createdAt });
};

const resetSeedData = async ({ ownerEmail = null, env = process.env } = {}) => {
  assertNotProduction(env);
  const normalizedOwnerEmail = ownerEmail?.toLowerCase();
  const removed = {};
  for (const Model of MODELS) {
    const filter = { seedTag: SEED_TAG };
    if (Model === User && normalizedOwnerEmail) filter.email = { $ne: normalizedOwnerEmail };
    const result = await Model.deleteMany(filter);
    removed[Model.modelName] = result.deletedCount || 0;
  }
  return removed;
};

const ensureUser = async (definition) => {
  let user = await User.findOne({ email: definition.email });
  if (user && user.seedTag !== SEED_TAG) {
    throw new Error(`Refusing to modify existing non-demo account ${definition.email}.`);
  }
  if (user) return user;
  const usernameCollision = await User.findOne({ username: definition.username });
  if (usernameCollision) {
    throw new Error(`Username ${definition.username} is already in use by a non-demo account.`);
  }
  user = await User.create({
    ...definition,
    password: DEMO_PASSWORD,
    seedTag: SEED_TAG,
  });
  return user;
};

const ensureWorkspace = async ({ name, slug, owner, createdBy, isPersonal, useExistingPersonal = false }) => {
  const existingTagged = await tagged(Workspace, { name, owner: owner._id });
  if (existingTagged) return existingTagged;
  if (useExistingPersonal) {
    const existing = await Workspace.findOne({ owner: owner._id, isPersonal: true });
    if (existing) return existing;
  }
  return Workspace.create({
    name,
    slug,
    owner: owner._id,
    createdBy: createdBy._id,
    isPersonal,
    seedTag: SEED_TAG,
  });
};

const ensureMembership = async ({ workspace, user, role, joinedAt }) => {
  const existing = await Membership.findOne({ workspace: workspace._id, user: user._id });
  if (existing) return existing;
  return Membership.create({
    workspace: workspace._id,
    user: user._id,
    role,
    joinedAt,
    seedTag: SEED_TAG,
  });
};

const ensureProject = async ({ title, description, owner, workspace, members, createdAt }) => {
  let project = await tagged(Project, { title, workspace: workspace._id });
  if (!project) {
    project = await Project.create({
      title,
      description,
      owner: owner._id,
      workspace: workspace._id,
      members: members.map((member) => member._id),
      seedTag: SEED_TAG,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await ensureActivity({
    workspace: workspace._id, actor: owner._id, action: 'project.created',
    entityType: 'project', entityId: project._id, eventKey: `project:${project._id}:created`,
    metadata: { title }, createdAt,
  });
  return project;
};

const ensureList = async ({ title, project, owner, workspace, position, createdAt }) => {
  let list = await tagged(List, { title, project: project._id });
  if (!list) {
    list = await List.create({
      title,
      project: project._id,
      owner: owner._id,
      position,
      order: position / POSITION_GAP - 1,
      seedTag: SEED_TAG,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await ensureActivity({
    workspace: workspace._id, actor: owner._id, action: 'list.created',
    entityType: 'list', entityId: list._id, eventKey: `list:${list._id}:created`,
    metadata: { projectId: project._id, title }, createdAt,
  });
  return list;
};

const ensureLabel = async ({ definition, project, owner, createdAt }) => {
  const existing = await tagged(Label, { name: definition.name, project: project._id });
  if (existing) return existing;
  return Label.create({
    ...definition,
    project: project._id,
    owner: owner._id,
    seedTag: SEED_TAG,
    createdAt,
    updatedAt: createdAt,
  });
};

const taskTitle = (projectTitle, index) => {
  if (projectTitle === 'Website Redesign' && index === 0) {
    return '<b>Fix</b> login & signup ✅';
  }
  if (projectTitle === 'Mobile App Launch' && index === 0) {
    return 'Coordinate the unusually long accessibility and offline-sync acceptance checklist across product, design, support, and engineering before the seasonal launch window closes';
  }
  const nouns = ['onboarding', 'checkout', 'search', 'notifications', 'analytics', 'accessibility'];
  return `${projectTitle}: ${nouns[index % nouns.length]} improvement ${String(index + 1).padStart(2, '0')}`;
};

const taskDescription = (projectTitle, index) => [
  `Context: the ${projectTitle} team is preparing this work for the next review cycle.`,
  '',
  'Plan: confirm the acceptance criteria with the relevant partners, implement the smallest safe change, and verify it on desktop and mobile.',
  '',
  `Follow-up: add evidence and any remaining questions to the handoff. Tracking reference ${String(index + 1).padStart(2, '0')}.`,
].join('\n');

const taskState = (project, listTitle, index) => {
  if (project.title === 'Customer Support Backlog' && listTitle === 'Backlog') return 'todo';
  if (listTitle === 'Done' || listTitle === 'Published') return 'done';
  if (listTitle === 'To Do') return 'todo';
  if (listTitle === 'In Progress') return 'in_progress';
  if (project.title === 'Mobile App Launch' && index % 4 === 1) return 'in_progress';
  if (index % 7 === 0) return 'done';
  if (index % 5 === 0) return 'in_progress';
  return 'todo';
};

const createTask = async ({
  project, workspace, list, owner, users, assignedUsers, labels, index, listIndex, createdAt,
}) => {
  const title = taskTitle(project.title, index);
  let task = await tagged(Task, { title, project: project._id, list: list._id });
  const status = taskState(project, list.title, index);
  if (!task) {
    const assignees = index % 5 === 0
      ? []
      : index % 5 === 1
        ? [assignedUsers[index % assignedUsers.length], assignedUsers[(index + 1) % assignedUsers.length]]
        : index % 5 === 2
          ? [assignedUsers[index % assignedUsers.length], assignedUsers[(index + 1) % assignedUsers.length], assignedUsers[(index + 2) % assignedUsers.length]]
          : [assignedUsers[index % assignedUsers.length]];
    const creators = users.slice(0, 3);
    const creator = creators[index % creators.length];
    const dueOffset = [-6, 0, 1, 2, 4, 10, null][index % 7];
    const taskLabels = labels.length ? [labels[index % labels.length]] : [];
    if (labels.length > 1 && index % 3 === 0) taskLabels.push(labels[(index + 2) % labels.length]);
    const position = (await Task.countDocuments({ list: list._id, seedTag: SEED_TAG }) + 1) * POSITION_GAP;
    const taskData = {
      title,
      description: project.title === 'Website Redesign' && index === 1
        ? 'Background: customers have reported that the account flow is difficult to use on smaller screens.\n\nApproach: review the navigation hierarchy, validate the interaction with keyboard and touch, and coordinate the updated copy with support.\n\nAcceptance: the final design works at narrow viewport widths, keeps focus visible, and includes screenshots for the handoff.'
        : taskDescription(project.title, index),
      list: list._id,
      project: project._id,
      owner: creator._id,
      assignedTo: assignees[0]?._id || null,
      assignees: assignees.map((assignee) => assignee._id),
      createdBy: creator._id,
      workspace: workspace._id,
      priority: ['Low', 'Medium', 'High'][index % 3],
      dueDate: dueOffset === null ? null : dateFromOffset(dueOffset, 17),
      order: position / POSITION_GAP - 1,
      status,
      completedAt: status === 'done' ? createdAt : null,
      position,
      subtasks: index % 2 === 0
        ? [
          { title: 'Confirm scope and acceptance criteria', done: index % 4 === 0, position: POSITION_GAP },
          { title: 'Share progress with the project team', done: status === 'done', position: POSITION_GAP * 2 },
        ]
        : [],
      labels: taskLabels.map((label) => label._id),
      seedTag: SEED_TAG,
      createdAt,
      updatedAt: createdAt,
    };
    task = await Task.create(taskData);
  }
  await ensureActivity({
    workspace: workspace._id,
    actor: task.createdBy,
    action: 'task.created',
    entityType: 'task',
    entityId: task._id,
    eventKey: `task:${task._id}:created`,
    metadata: { projectId: project._id, listId: list._id },
    createdAt,
  });
  if (status !== 'todo') {
    await ensureActivity({
      workspace: workspace._id, actor: task.createdBy, action: 'task.status_changed',
      entityType: 'task', entityId: task._id, eventKey: `task:${task._id}:status`,
      metadata: { status }, createdAt: dateFromOffset(Math.min(0, Math.floor(index / 5) - 5), 14),
    });
  }
  if (task.assignees.length) {
    await ensureActivity({
      workspace: workspace._id,
      actor: task.createdBy,
      action: 'task.assigned',
      entityType: 'task',
      entityId: task._id,
      eventKey: `task:${task._id}:assigned`,
      metadata: { assigneeIds: task.assignees },
      createdAt: dateFromOffset(Math.min(0, Math.floor(index / 6) - 4), 15),
    });
  } else {
    await ensureActivity({
      workspace: workspace._id,
      actor: task.createdBy,
      action: 'task.unassigned',
      entityType: 'task',
      entityId: task._id,
      eventKey: `task:${task._id}:unassigned`,
      createdAt: dateFromOffset(Math.min(0, Math.floor(index / 6) - 4), 15),
    });
  }
  if (index % 4 === 0 && list.title !== 'Backlog') {
    await ensureActivity({
      workspace: workspace._id,
      actor: task.createdBy,
      action: 'task.moved',
      entityType: 'task',
      entityId: task._id,
      eventKey: `task:${task._id}:moved`,
      metadata: { listId: list._id },
      createdAt: dateFromOffset(Math.min(0, Math.floor(index / 6) - 3), 16),
    });
  }
  return task;
};

const createTeamProjects = async ({ workspace, owner, users, extraOwner }) => {
  const allowedExtraOwner = extraOwner && !['omar', 'zain'].includes(extraOwner.username)
    ? [extraOwner]
    : [];
  const eligibleAssignees = [...new Map(
    [users[0], users[1], users[2], ...allowedExtraOwner]
      .map((user) => [String(user._id), user])
  ).values()];
  const teamMembers = [...new Map(
    [...users.slice(0, 4), ...(extraOwner ? [extraOwner] : [])].map((user) => [String(user._id), user])
  ).values()];
  const allTasks = [];
  for (let projectIndex = 0; projectIndex < TEAM_PROJECTS.length; projectIndex += 1) {
    const definition = TEAM_PROJECTS[projectIndex];
    const projectOwner = [users[0], users[1], users[2], users[0], users[1], users[0]][projectIndex];
    const createdAt = dateFromOffset(-13 + projectIndex, 10);
    const project = await ensureProject({
      title: definition.title,
      description: `${definition.title} planning space for Acme Studio. Share decisions, ownership, and delivery updates here.`,
      owner: projectOwner,
      workspace,
      members: teamMembers,
      createdAt,
    });
    const labelDefinitions = definition.count ? (project.title === 'Internal Wiki' ? [LABELS[5]] : LABELS) : [];
    const labels = [];
    for (const label of labelDefinitions) {
      labels.push(await ensureLabel({ definition: label, project, owner: projectOwner, createdAt }));
    }

    const lists = [];
    for (let index = 0; index < definition.lists.length; index += 1) {
      lists.push(await ensureList({
        title: definition.lists[index],
        project,
        owner: projectOwner,
        workspace,
        position: (index + 1) * POSITION_GAP,
        createdAt: dateFromOffset(-12 + index, 11),
      }));
    }

    let taskIndex = 0;
    for (let listIndex = 0; listIndex < lists.length && taskIndex < definition.count; listIndex += 1) {
      let allocation;
      if (project.title === 'Customer Support Backlog') {
        allocation = listIndex === 0 ? 25 : listIndex <= 2 ? 1 : 0;
      } else {
        allocation = Math.ceil((definition.count - taskIndex) / (lists.length - listIndex));
      }
      for (let allocated = 0; allocated < allocation && taskIndex < definition.count; allocated += 1) {
        const index = taskIndex;
        const task = await createTask({
          project,
          workspace,
          list: lists[listIndex],
          owner: projectOwner,
          users: teamMembers,
          assignedUsers: eligibleAssignees,
          labels,
          index,
          listIndex,
          createdAt: dateFromOffset(-13 + ((index + projectIndex) % 14), 9 + (index % 8)),
        });
        allTasks.push(task);
        taskIndex += 1;
      }
    }
  }
  return allTasks;
};

const ensurePersonalProjects = async ({ user, workspace, isOptionalOwner = false }) => {
  const projectTitles = isOptionalOwner
    ? ['Personal Launch Plan', 'Personal Reading List']
    : user.username === 'ayesha'
      ? ['My Private Notes']
      : user.username === 'zain'
        ? ['Zain Private Project']
        : [];
  for (let index = 0; index < projectTitles.length; index += 1) {
    const project = await ensureProject({
      title: projectTitles[index],
      description: 'A small personal sample project kept separate from Acme Studio.',
      owner: user,
      workspace,
      members: [user],
      createdAt: dateFromOffset(-4 + index, 10),
    });
    const listCount = user.username === 'ayesha' && !isOptionalOwner ? 1 : 2;
    const lists = [];
    for (let listIndex = 0; listIndex < listCount; listIndex += 1) {
      lists.push(await ensureList({
        title: listIndex === 0 ? 'To Do' : 'Done',
        project,
        owner: user,
        workspace,
        position: (listIndex + 1) * POSITION_GAP,
        createdAt: dateFromOffset(-3 + index + listIndex, 11),
      }));
    }
    const taskCount = user.username === 'ayesha' && !isOptionalOwner ? 3 : 1;
    for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
      await createTask({
        project,
        workspace,
        list: lists[taskIndex % lists.length],
        owner: user,
        users: [user],
        assignedUsers: [user],
        labels: [],
        index: taskIndex,
        listIndex: index,
        createdAt: dateFromOffset(-1 + index + taskIndex, 13),
      });
    }
  }
};

const seedPersonalWorkspace = async ({ ownerEmail, dryRun = false, output = () => {} }) => {
  const projectTitles = ['Personal Product Sprint (Demo)', 'Personal Planning Board (Demo)'];
  const taskDefinitions = [
    { title: 'Review first-run onboarding checklist', list: 'To Do', priority: 'High', dueDays: -2 },
    { title: 'Write acceptance criteria for saved views', list: 'To Do', priority: 'Medium', dueDays: 0 },
    { title: 'Collect feedback on the project dashboard', list: 'In Progress', priority: 'High', dueDays: 1 },
    { title: 'Polish empty-state copy for new projects', list: 'In Progress', priority: 'Low', dueDays: 4 },
    { title: 'Verify keyboard navigation on task cards', list: 'Done', priority: 'Medium', dueDays: null },
    { title: 'Document the weekly planning workflow', list: 'Done', priority: 'Low', dueDays: 10 },
  ];

  if (dryRun) {
    output(`Personal-only plan for ${ownerEmail}: 2 projects, 6 lists, 12 tasks; no other users or workspaces will be created.`);
    return { dryRun: true, projects: 2, lists: 6, tasks: 12 };
  }

  const user = await User.findOne({ email: ownerEmail.toLowerCase() });
  if (!user) throw new Error(`No existing account was found for --owner-email=${ownerEmail}.`);
  const workspace = await Workspace.findOne({ owner: user._id, isPersonal: true });
  if (!workspace) {
    throw new Error(`No Personal Workspace was found for ${ownerEmail}; no data was created.`);
  }

  for (const [projectIndex, title] of projectTitles.entries()) {
    const project = await ensureProject({
      title,
      description: 'Sample board with assigned work to explore TaskFlow projects, tasks, statuses, priorities, and due dates.',
      owner: user,
      workspace,
      members: [user],
      createdAt: dateFromOffset(-2 + projectIndex, 10),
    });
    const lists = new Map();
    for (const [listIndex, listTitle] of ['To Do', 'In Progress', 'Done'].entries()) {
      lists.set(listTitle, await ensureList({
        title: listTitle,
        project,
        owner: user,
        workspace,
        position: (listIndex + 1) * POSITION_GAP,
        createdAt: dateFromOffset(-2 + projectIndex + listIndex, 11),
      }));
    }

    for (const [taskIndex, definition] of taskDefinitions.entries()) {
      const list = lists.get(definition.list);
      let task = await tagged(Task, { title: definition.title, project: project._id });
      if (!task) {
        const lastTask = await Task.findOne({ list: list._id }).sort({ position: -1 }).select('position');
        const position = (lastTask?.position || 0) + POSITION_GAP;
        const status = definition.list === 'Done'
          ? 'done'
          : definition.list === 'In Progress' ? 'in_progress' : 'todo';
        const createdAt = dateFromOffset(-6 + ((taskIndex + projectIndex) % 6), 9 + taskIndex);
        task = await Task.create({
          seedTag: SEED_TAG,
          title: definition.title,
          description: `Sample task for ${title.toLowerCase()}. Check the details, update its status, and use the due date to explore your task views.`,
          list: list._id,
          project: project._id,
          owner: user._id,
          assignedTo: user._id,
          assignees: [user._id],
          createdBy: user._id,
          workspace: workspace._id,
          priority: definition.priority,
          dueDate: definition.dueDays === null ? null : dateFromOffset(definition.dueDays, 17),
          order: position / POSITION_GAP - 1,
          position,
          status,
          completedAt: status === 'done' ? createdAt : null,
          subtasks: taskIndex % 2 === 0
            ? [
              { title: 'Confirm scope and acceptance criteria', done: status === 'done', position: POSITION_GAP },
              { title: 'Share progress update', done: false, position: POSITION_GAP * 2 },
            ]
            : [],
          createdAt,
          updatedAt: createdAt,
        });
      }

      await ensureActivity({
        workspace: workspace._id,
        actor: user._id,
        action: 'task.created',
        entityType: 'task',
        entityId: task._id,
        eventKey: `task:${task._id}:created`,
        metadata: { projectId: project._id, listId: list._id },
        createdAt: task.createdAt,
      });
      await ensureActivity({
        workspace: workspace._id,
        actor: user._id,
        action: 'task.assigned',
        entityType: 'task',
        entityId: task._id,
        eventKey: `task:${task._id}:assigned`,
        metadata: { assigneeIds: [user._id] },
        createdAt: task.createdAt,
      });
      if (task.status !== 'todo') {
        await ensureActivity({
          workspace: workspace._id,
          actor: user._id,
          action: 'task.status_changed',
          entityType: 'task',
          entityId: task._id,
          eventKey: `task:${task._id}:status`,
          metadata: { status: task.status },
          createdAt: task.updatedAt,
        });
      }
    }
  }

  const counts = {
    projects: await Project.countDocuments({ workspace: workspace._id, seedTag: SEED_TAG, title: { $in: projectTitles } }),
    lists: await List.countDocuments({ seedTag: SEED_TAG, project: { $in: await Project.find({
      workspace: workspace._id, seedTag: SEED_TAG, title: { $in: projectTitles },
    }).distinct('_id') } }),
    tasks: await Task.countDocuments({ workspace: workspace._id, seedTag: SEED_TAG, project: { $in: await Project.find({
      workspace: workspace._id, seedTag: SEED_TAG, title: { $in: projectTitles },
    }).distinct('_id') } }),
  };
  output(`Personal workspace sample data: ${counts.projects} projects, ${counts.lists} lists, ${counts.tasks} tasks.`);
  output('All 12 tasks are assigned to your account and will appear in My Tasks.');
  return counts;
};

const ensureInvitations = async ({ workspace, inviter, output }) => {
  const inviteDefinitions = [
    { email: 'newhire@taskflow.demo', role: 'member', status: 'pending', days: 7 },
    { email: 'expired.partner@example.test', role: 'viewer', status: 'expired', days: -2 },
    { email: 'revoked.partner@example.test', role: 'admin', status: 'revoked', days: 7 },
  ];
  for (const definition of inviteDefinitions) {
    let invitation = await Invitation.findOne({
      seedTag: SEED_TAG,
      workspace: workspace._id,
      email: definition.email,
    }).select('+tokenHash');
    const expiresAt = dateFromOffset(definition.days, 23);
    if (!invitation) {
      const token = crypto.randomBytes(32).toString('hex');
      invitation = new Invitation({
        seedTag: SEED_TAG,
        workspace: workspace._id,
        email: definition.email,
        role: definition.role,
        invitedBy: inviter._id,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt,
        status: definition.status,
        createdAt: dateFromOffset(-2, 12),
      });
      await invitation.save();
      if (definition.status === 'pending') {
        output(`Pending invitation for ${definition.email}: ${CLIENT_URL()}/invite/${token}`);
      }
    } else {
      output(`Existing ${definition.status} invitation for ${definition.email} was left unchanged.`);
    }
    await ensureActivity({
      workspace: workspace._id,
      actor: inviter._id,
      action: definition.status === 'pending'
        ? 'member.invited'
        : definition.status === 'revoked' ? 'invitation.revoked' : 'invitation.created',
      entityType: 'invitation',
      entityId: invitation._id,
      eventKey: `invitation:${invitation._id}:${definition.status}`,
      metadata: { role: definition.role, status: definition.status },
      createdAt: invitation.createdAt,
    });
  }
};

const ensureComments = async ({ tasks, workspace, authors }) => {
  const chosenTasks = tasks.filter((_task, index) => index % 6 === 0).slice(0, 10);
  for (let taskIndex = 0; taskIndex < chosenTasks.length; taskIndex += 1) {
    const task = chosenTasks[taskIndex];
    const project = await Project.findById(task.project);
    for (let reply = 0; reply < 3; reply += 1) {
      const author = authors[(taskIndex + reply) % authors.length];
      const createdAt = dateFromOffset(-13 + ((taskIndex * 3 + reply) % 14), 9 + reply);
      const body = taskIndex === 0 && reply === 1
        ? 'Here is the longer handoff with the context gathered so far.\n\nThe first paragraph summarizes the user impact and the agreed scope. The second records the edge cases we should validate before release, including a keyboard-only pass and a narrow-screen check.\n\nAyesha, please add the final screenshots after the review.'
        : [
          'I checked the latest update and the expected behavior looks good from my side.',
          'Thanks — I will verify the remaining edge case and share a short handoff here.',
          'That works. I have added the follow-up to the next review so we can close the loop.',
        ][reply];
      let comment = await tagged(Comment, { task: task._id, author: author._id, body });
      if (!comment) {
        comment = await Comment.create({
          seedTag: SEED_TAG,
          workspace: workspace._id,
          project: project._id,
          task: task._id,
          author: author._id,
          body,
          deletedAt: taskIndex === 8 && reply === 2 ? dateFromOffset(-1, 16) : null,
          editedAt: taskIndex === 2 && reply === 1 ? dateFromOffset(0, 10) : null,
          createdAt,
          updatedAt: taskIndex === 2 && reply === 1 ? dateFromOffset(0, 10) : createdAt,
        });
      }
      const action = comment.deletedAt ? 'comment.deleted' : 'comment.created';
      await ensureActivity({
        workspace: workspace._id,
        actor: author._id,
        action,
        entityType: 'comment',
        entityId: comment._id,
        eventKey: `comment:${comment._id}:${action}`,
        metadata: { taskId: task._id },
        createdAt,
      });
      if (taskIndex === 2 && reply === 1) {
        await ensureActivity({
          workspace: workspace._id, actor: author._id, action: 'comment.updated',
          entityType: 'comment', entityId: comment._id,
          eventKey: `comment:${comment._id}:updated`,
          metadata: { taskId: task._id }, createdAt: comment.updatedAt,
        });
      }
    }
  }
};

const seedDatabase = async ({
  ownerEmail = null,
  reset = false,
  dryRun = false,
  personalOnly = false,
  output = () => {},
  env = process.env,
} = {}) => {
  assertNotProduction(env);
  if (personalOnly) {
    if (!ownerEmail) throw new Error('--personal-only requires --owner-email=<mail>.');
    if (reset) throw new Error('--personal-only cannot be combined with --reset.');
    return seedPersonalWorkspace({ ownerEmail, dryRun, output });
  }
  if (dryRun) {
    const plan = {
      users: USERS.length,
      workspaces: USERS.length + 1,
      memberships: USERS.length + 4 + (ownerEmail ? 1 : 0),
      invitations: 3,
      projects: TEAM_PROJECTS.length + 2 + (ownerEmail ? 2 : 0),
      lists: 21 + (ownerEmail ? 4 : 0),
      teamTasks: 60,
      comments: 30,
      activity: 'at least 60',
    };
    output(`Dry run plan: ${JSON.stringify(plan)}`);
    if (reset) output(`Reset scope: delete only documents tagged ${SEED_TAG}; preserve --owner-email account.`);
    return { dryRun: true, resetRequested: reset, ...plan };
  }
  const extraOwner = ownerEmail
    ? await User.findOne({ email: ownerEmail.toLowerCase() })
    : null;
  if (ownerEmail && !extraOwner) {
    throw new Error(`No existing account was found for --owner-email=${ownerEmail}.`);
  }
  if (reset) await resetSeedData({ ownerEmail, env });

  const users = [];
  for (const definition of USERS) users.push(await ensureUser(definition));
  const ayesha = users[0];
  const workspaceOwner = extraOwner || ayesha;
  const teamRole = (user, index) => {
    if (String(user._id) === String(workspaceOwner._id)) return 'owner';
    if (index === 0 && extraOwner) return 'admin';
    return USERS[index].role;
  };
  const teamUsers = [...users.slice(0, 4), ...(extraOwner ? [extraOwner] : [])]
    .filter((user, index, entries) => entries.findIndex((entry) => String(entry._id) === String(user._id)) === index);
  const teamWorkspace = await ensureWorkspace({
    name: 'Acme Studio',
    slug: 'acme-studio',
    owner: workspaceOwner,
    createdBy: ayesha,
    isPersonal: false,
  });

  for (let index = 0; index < teamUsers.length; index += 1) {
    const user = teamUsers[index];
    const demoIndex = users.findIndex((entry) => String(entry._id) === String(user._id));
    await ensureMembership({
      workspace: teamWorkspace,
      user,
      role: teamRole(user, demoIndex === -1 ? 4 : demoIndex),
      joinedAt: dateFromOffset(-14 + index, 12),
    });
  }
  for (const user of users) {
    const personalWorkspace = await ensureWorkspace({
      name: `${user.username}'s Workspace`,
      slug: `${user.username}-workspace`,
      owner: user,
      createdBy: user,
      isPersonal: true,
    });
    if (!(await Membership.exists({ workspace: personalWorkspace._id, user: user._id }))) {
      await ensureMembership({
        workspace: personalWorkspace,
        user,
        role: 'owner',
        joinedAt: personalWorkspace.createdAt,
      });
    }
    if (['ayesha', 'zain'].includes(user.username)) {
      await ensurePersonalProjects({ user, workspace: personalWorkspace });
    }
  }

  await ensureActivity({
    workspace: teamWorkspace._id, actor: workspaceOwner._id, action: 'workspace.created',
    entityType: 'workspace', entityId: teamWorkspace._id,
    eventKey: `workspace:${teamWorkspace._id}:created`, metadata: { name: teamWorkspace.name },
    createdAt: teamWorkspace.createdAt,
  });
  for (let index = 0; index < teamUsers.length; index += 1) {
    const user = teamUsers[index];
    const demoIndex = users.findIndex((entry) => String(entry._id) === String(user._id));
    const role = teamRole(user, demoIndex === -1 ? 4 : demoIndex);
    await ensureActivity({
      workspace: teamWorkspace._id, actor: workspaceOwner._id, action: 'member.joined',
      entityType: 'membership', entityId: await Membership.findOne({
        workspace: teamWorkspace._id, user: user._id,
      }).then((membership) => membership._id),
      eventKey: `workspace:${teamWorkspace._id}:membership:${user._id}`,
      metadata: {
        userId: user._id,
        role,
      },
      createdAt: dateFromOffset(-13 + index, 12),
    });
  }
  const tasks = await createTeamProjects({ workspace: teamWorkspace, owner: workspaceOwner, users, extraOwner });
  await ensureInvitations({ workspace: teamWorkspace, inviter: workspaceOwner, output });
  await ensureComments({ tasks, workspace: teamWorkspace, authors: users.slice(0, 3) });

  if (extraOwner) {
    const personalWorkspace = await ensureWorkspace({
      name: `${extraOwner.username}'s Workspace`,
      slug: `${extraOwner.username}-workspace`,
      owner: extraOwner,
      createdBy: extraOwner,
      isPersonal: true,
      useExistingPersonal: true,
    });
    await ensureMembership({
      workspace: personalWorkspace,
      user: extraOwner,
      role: 'owner',
      joinedAt: personalWorkspace.createdAt,
    });
    await ensurePersonalProjects({ user: extraOwner, workspace: personalWorkspace, isOptionalOwner: true });
  }
  const counts = {
    users: await User.countDocuments({ seedTag: SEED_TAG }),
    workspaces: await Workspace.countDocuments({ seedTag: SEED_TAG }),
    memberships: await Membership.countDocuments({ seedTag: SEED_TAG }),
    invitations: await Invitation.countDocuments({ seedTag: SEED_TAG }),
    projects: await Project.countDocuments({ seedTag: SEED_TAG }),
    lists: await List.countDocuments({ seedTag: SEED_TAG }),
    tasks: await Task.countDocuments({ seedTag: SEED_TAG }),
    labels: await Label.countDocuments({ seedTag: SEED_TAG }),
    comments: await Comment.countDocuments({ seedTag: SEED_TAG }),
    activity: await ActivityLog.countDocuments({ seedTag: SEED_TAG }),
    subtasks: (await Task.aggregate([
      { $match: { seedTag: SEED_TAG } },
      { $project: { count: { $size: { $ifNull: ['$subtasks', []] } } } },
      { $group: { _id: null, count: { $sum: '$count' } } },
    ]))[0]?.count || 0,
  };
  output('Seeded data summary');
  output('Category       | Count');
  output('---------------|------');
  for (const [category, count] of Object.entries(counts)) {
    output(`${category.padEnd(14)} | ${count}`);
  }
  output('');
  output('Demo logins (password for all: TaskFlow#Demo2026)');
  const demoTeamRoles = new Map([
    [USERS[0].email, extraOwner ? 'Admin' : 'Owner'],
    [USERS[1].email, extraOwner && extraOwner.email === USERS[1].email ? 'Owner' : 'Admin'],
    [USERS[2].email, extraOwner && extraOwner.email === USERS[2].email ? 'Owner' : 'Member'],
    [USERS[3].email, extraOwner && extraOwner.email === USERS[3].email ? 'Owner' : 'Viewer'],
    [USERS[4].email, extraOwner && extraOwner.email === USERS[4].email ? 'Owner' : 'Outsider'],
  ]);
  output('Email                              | Username | Role');
  for (const user of users) {
    output(`${user.email.padEnd(34)} | ${user.username.padEnd(8)} | ${demoTeamRoles.get(user.email)}`);
  }
  if (extraOwner) output(`${extraOwner.email} | ${extraOwner.username} | Owner`);
  output('');
  output('Open first: Dashboard; Customer Support Backlog > Backlog; Internal Wiki; Ideas Parking Lot; Ayesha Personal Workspace > My Private Notes.');
  return { ...counts, demoUsers: users.length, teamTasks: tasks.length };
};

const confirm = async (question, input = process.stdin, output = process.stdout) => {
  if (!input.isTTY) throw new Error('Confirmation is required; rerun with --yes to proceed non-interactively.');
  const terminal = readline.createInterface({ input, output });
  try {
    const answer = await new Promise((resolve) => terminal.question(question, resolve));
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    terminal.close();
  }
};

const runCli = async (argv = process.argv.slice(2), dependencies = {}) => {
  const env = dependencies.env || process.env;
  assertNotProduction(env);
  const options = parseArgs(argv);
  const uri = env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required to run the seed script.');
  const info = databaseInfo(uri);
  const output = dependencies.output || ((message) => console.log(message));
  output(`TaskFlow seed database: ${info.name} on ${info.host}`);
  if (!options.yes && !options.dryRun) {
    const accepted = await confirm(
      options.personalOnly
        ? `Add sample projects and tasks to the Personal Workspace for ${options.ownerEmail} in this database? [y/N] `
        : `${options.reset ? 'Reset and recreate' : 'Create'} the development demo data in this database? [y/N] `,
      dependencies.input || process.stdin,
      dependencies.terminalOutput || process.stdout
    );
    if (!accepted) {
      output('Seed cancelled.');
      return null;
    }
  }
  if (options.dryRun) {
    output('Dry run: no database writes will be performed.');
    return seedDatabase({ ...options, output, env });
  }
  const connect = dependencies.connect || ((connectionString) =>
    mongoose.connect(connectionString, { autoIndex: false }));
  const disconnect = dependencies.disconnect || (() => mongoose.disconnect());
  try {
    if (env.DNS_SERVERS) {
      dns.setServers(env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean));
    }
    await connect(uri);
    const result = await seedDatabase({ ...options, output, env });
    output(options.personalOnly
      ? 'Personal workspace sample data added.'
      : `${options.reset ? 'Reset complete. ' : ''}Seed complete: ${result.users} demo users, ${result.projects} projects, ${result.tasks} team tasks.`);
    return result;
  } finally {
    await disconnect();
  }
};

if (require.main === module) {
  runCli().catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  SEED_TAG,
  DEMO_PASSWORD,
  assertNotProduction,
  parseArgs,
  databaseInfo,
  resetSeedData,
  seedDatabase,
  seedPersonalWorkspace,
  runCli,
};
