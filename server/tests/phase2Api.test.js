jest.mock('../utils/email', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendInvitationEmail: jest.fn(async (_email, inviteUrl) => {
    global.invitationToken = new URL(inviteUrl).pathname.split('/').pop();
  }),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Task = require('../models/Task');
const Workspace = require('../models/Workspace');
const Membership = require('../models/Membership');
const Comment = require('../models/Comment');
const Invitation = require('../models/Invitation');

let sequence = 0;
const register = async (agent, role = 'user') => {
  sequence += 1;
  const username = `${role}${sequence}`;
  const email = `${username}@example.com`;
  const response = await agent.post('/api/auth/register').send({
    username, email, password: `Secret-${role}-${sequence}-!`,
  });
  expect(response.status).toBe(201);
  return { username, email, response };
};

describe('Phase 2 workspaces and task collaboration', () => {
  test('workspace slugs are unique and invitation uniqueness applies only to pending invites', async () => {
    await Workspace.init();
    await Invitation.init();
    const userId = new mongoose.Types.ObjectId();
    const first = await Workspace.create({
      name: 'Shared Name', owner: userId, createdBy: userId,
    });
    const second = await Workspace.create({
      name: 'Shared Name', owner: userId, createdBy: userId,
    });
    expect(first.slug).toBe('shared-name');
    expect(second.slug).toBe('shared-name-1');

    const invitation = {
      workspace: first._id,
      email: 'pending@example.com',
      role: 'member',
      invitedBy: userId,
      tokenHash: 'first-token-hash',
      expiresAt: new Date(Date.now() + 60_000),
    };
    const existing = await Invitation.create(invitation);
    await expect(Invitation.create({ ...invitation, tokenHash: 'duplicate-token-hash' }))
      .rejects.toMatchObject({ code: 11000 });
    existing.status = 'revoked';
    await existing.save();
    await expect(Invitation.create({ ...invitation, tokenHash: 'replacement-token-hash' }))
      .resolves.toMatchObject({ status: 'pending' });
  });

  test('registration creates a personal workspace and /me returns only safe workspace data', async () => {
    const agent = request.agent(app);
    const { response } = await register(agent);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.password).toBeUndefined();
    expect(me.body.user.workspaces).toHaveLength(1);
    expect(me.body.user.workspaces[0].role).toBe('owner');
    expect(me.body.user.workspaces[0].personal).toBe(true);
    expect(me.body.user.workspaces[0].isPersonal).toBe(true);
    expect(me.body.user.workspaces[0].slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(response.body.user.password).toBeUndefined();
    expect((await agent.get('/api/workspaces/not-an-object-id')).status).toBe(400);
  });

  test('an invitation grants membership, cannot grant owner, and nonmembers get 404', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];
    const outsider = request.agent(app);
    const invited = await register(outsider, 'invitee');
    const inviteResponse = await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: invited.email, role: 'member' });
    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.tokenHash).toBeUndefined();
    expect((await ownerAgent.get(`/api/workspaces/${workspace._id}/invitations`)).body[0].tokenHash).toBeUndefined();

    const projectResponse = await ownerAgent.post('/api/projects').send({ title: 'Private project' });
    expect(projectResponse.status).toBe(201);
    expect((await outsider.get(`/api/projects/${projectResponse.body._id}`)).status).toBe(404);

    const accepted = await outsider.post('/api/workspaces/invitations/accept')
      .send({ token: global.invitationToken });
    expect(accepted.status).toBe(200);
    expect((await Invitation.findById(inviteResponse.body._id)).status).toBe('accepted');
    expect((await outsider.get(`/api/projects/${projectResponse.body._id}`)).status).toBe(200);
    expect((await outsider.post('/api/workspaces/invitations/accept')
      .send({ token: global.invitationToken })).status).toBe(404);

    const ownerInvite = await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: 'owner-role@example.com', role: 'owner' });
    expect(ownerInvite.status).toBe(400);
  });

  test('workspace members can create projects and viewers are forbidden', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];

    const memberAgent = request.agent(app);
    const member = await register(memberAgent, 'projectmember');
    await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: member.email, role: 'member' });
    await memberAgent.post('/api/workspaces/invitations/accept')
      .send({ token: global.invitationToken });

    const memberProject = await memberAgent.post(`/api/workspaces/${workspace._id}/projects`)
      .send({ title: 'Member project', description: 'Created by a member.' });
    expect(memberProject.status).toBe(201);
    expect(String(memberProject.body.workspace)).toBe(String(workspace._id));

    const viewerAgent = request.agent(app);
    const viewer = await register(viewerAgent, 'projectviewer');
    await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: viewer.email, role: 'viewer' });
    await viewerAgent.post('/api/workspaces/invitations/accept')
      .send({ token: global.invitationToken });

    const viewerProject = await viewerAgent.post(`/api/workspaces/${workspace._id}/projects`)
      .send({ title: 'Forbidden project' });
    expect(viewerProject.status).toBe(403);
  });

  test('assignees must be workspace members and leaving removes assignments; last owner cannot leave', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];
    const memberAgent = request.agent(app);
    const member = await register(memberAgent, 'member');
    await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: member.email });
    await memberAgent.post('/api/workspaces/invitations/accept').send({ token: global.invitationToken });

    const project = (await ownerAgent.post('/api/projects').send({ title: 'Team' })).body;
    const list = (await ownerAgent.post('/api/lists').send({ title: 'Todo', project: project._id })).body;
    const invalidAssignee = await ownerAgent.post('/api/tasks').send({
      title: 'Invalid assignee', project: project._id, list: list._id, assignees: ['0123456789abcdef01234567'],
    });
    expect(invalidAssignee.status).toBe(400);
    const created = await ownerAgent.post('/api/tasks').send({
      title: 'Assigned task', project: project._id, list: list._id, assignees: [member.response.body.user._id],
    });
    expect(created.status).toBe(201);
    expect((await memberAgent.get('/api/tasks/my')).body.map((task) => task._id)).toContain(created.body._id);
    const comment = await ownerAgent.post(`/api/tasks/${created.body._id}/comments`)
      .send({ content: 'A collaboration note' });
    expect(comment.status).toBe(201);
    const updatedComment = await ownerAgent.patch(`/api/comments/${comment.body._id}`)
      .send({ content: 'Edited collaboration note' });
    expect(updatedComment.status).toBe(200);
    expect(updatedComment.body.content).toBe('Edited collaboration note');
    expect((await memberAgent.get(`/api/tasks/${created.body._id}/comments`)).body).toHaveLength(1);
    expect((await memberAgent.delete(`/api/comments/${comment.body._id}`)).status).toBe(403);
    expect((await ownerAgent.get(`/api/tasks/${created.body._id}/activity`)).body.data
      .some((entry) => entry.action === 'comment.updated')).toBe(true);
    expect((await ownerAgent.delete(`/api/comments/${comment.body._id}`)).status).toBe(200);
    expect((await Comment.findById(comment.body._id)).deletedAt).toBeInstanceOf(Date);
    const activity = await ownerAgent.get(`/api/workspaces/${workspace._id}/activity`);
    expect(activity.body.data.some((entry) => entry.action === 'comment.deleted')).toBe(true);

    expect((await ownerAgent.post(`/api/workspaces/${workspace._id}/leave`)).status).toBe(400);
    expect((await memberAgent.post(`/api/workspaces/${workspace._id}/leave`)).status).toBe(200);
    const refreshedTask = await Task.findById(created.body._id);
    expect(refreshedTask.assignees.map(String)).not.toContain(member.response.body.user._id);
    expect(refreshedTask.assignedTo).toBeNull();
    expect(await Membership.countDocuments({ workspace: workspace._id })).toBe(1);
  });

  test('only owners can invite admins and transfer ownership requires a workspace member', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];
    const adminAgent = request.agent(app);
    const admin = await register(adminAgent, 'admin');
    await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: admin.email, role: 'admin' });
    await adminAgent.post('/api/workspaces/invitations/accept').send({ token: global.invitationToken });
    const denied = await adminAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: 'another@example.com', role: 'admin' });
    expect(denied.status).toBe(403);
    const transfer = await ownerAgent.post(`/api/workspaces/${workspace._id}/transfer-ownership`)
      .send({ userId: admin.response.body.user._id });
    expect(transfer.status).toBe(200);
    expect((await Workspace.findById(workspace._id)).owner.toString()).toBe(admin.response.body.user._id);
  });

  test('token invitations preview, require login for decline, and support viewer, resend, and lifecycle states', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];
    const viewerAgent = request.agent(app);
    const viewer = await register(viewerAgent, 'viewer');
    let response = await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: viewer.email, role: 'viewer' });
    expect(response.status).toBe(201);
    const viewerToken = global.invitationToken;
    const preview = await request(app).get(`/api/invitations/${viewerToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invitation.tokenHash).toBeUndefined();
    expect(preview.body.workspace.name).toBeTruthy();
    expect((await request(app).post(`/api/invitations/${viewerToken}/decline`)).status).toBe(401);
    expect((await viewerAgent.post(`/api/invitations/${viewerToken}/accept`)).status).toBe(200);
    expect(await Membership.findOne({ workspace: workspace._id, user: viewer.response.body.user._id }).then((m) => m.role))
      .toBe('viewer');
    expect((await viewerAgent.post('/api/projects').send({ title: 'Forbidden', workspaceId: workspace._id })).status)
      .toBe(403);

    const decliner = request.agent(app);
    const declinedUser = await register(decliner, 'decliner');
    await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`).send({ email: declinedUser.email });
    const declineToken = global.invitationToken;
    expect((await decliner.post(`/api/invitations/${declineToken}/decline`)).status).toBe(200);
    const declined = await Membership.findOne({ workspace: workspace._id, user: declinedUser.response.body.user._id });
    expect(declined).toBeNull();
    expect((await request(app).get(`/api/invitations/${declineToken}`)).status).toBe(410);
    const declinedInvitation = await Invitation.findOne({ email: declinedUser.email, workspace: workspace._id });
    expect(declinedInvitation.status).toBe('declined');

    response = await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations`)
      .send({ email: 'resend@example.com' });
    const invitationId = response.body._id;
    const oldToken = global.invitationToken;
    expect((await ownerAgent.post(`/api/workspaces/${workspace._id}/invitations/${invitationId}/resend`)).status)
      .toBe(200);
    const newToken = global.invitationToken;
    expect(newToken).not.toBe(oldToken);
    expect((await request(app).get(`/api/invitations/${oldToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/invitations/${newToken}`)).status).toBe(200);
    expect((await ownerAgent.delete(`/api/workspaces/${workspace._id}/invitations/${invitationId}`)).status)
      .toBe(200);
    expect((await Invitation.findById(invitationId)).status).toBe('revoked');
    expect((await request(app).get(`/api/invitations/${newToken}`)).status).toBe(410);
    expect((await Workspace.findById(workspace._id))).toBeTruthy();
  });

  test('workspace task groups are scoped and workspace deletion cascades but rejects personal workspaces', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const personal = (await ownerAgent.get('/api/workspaces')).body[0];
    expect((await ownerAgent.delete(`/api/workspaces/${personal._id}`)).status).toBe(400);

    const workspace = (await ownerAgent.post('/api/workspaces').send({ name: 'Team workspace' })).body;
    expect((await ownerAgent.patch(`/api/workspaces/${workspace._id}`).send({ name: 'x'.repeat(61) })).status)
      .toBe(400);
    const project = (await ownerAgent.post('/api/projects').send({
      title: 'Grouped project', workspaceId: workspace._id,
    })).body;
    const list = (await ownerAgent.post('/api/lists').send({ title: 'Tasks', project: project._id })).body;
    const userId = (await ownerAgent.get('/api/auth/me')).body.user._id;
    const task = await ownerAgent.post('/api/tasks').send({
      title: 'Unscheduled assigned task', project: project._id, list: list._id,
      assignees: [userId],
    });
    expect(task.status).toBe(201);
    const grouped = await ownerAgent.get(`/api/workspaces/${workspace._id}/my-tasks`);
    expect(grouped.body.noDate.map((item) => item._id)).toContain(task.body._id);
    const now = new Date();
    const daysFromToday = (days) => {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      date.setHours(12, 0, 0, 0);
      return date;
    };
    const datedTasks = await Promise.all([
      [-1, 'overdue', 'todo'],
      [0, 'today', 'todo'],
      [3, 'thisWeek', 'todo'],
      [10, 'later', 'todo'],
      [0, 'done', 'done'],
    ].map(([offset, title, status]) => Task.create({
      title,
      project: project._id,
      list: list._id,
      workspace: workspace._id,
      owner: userId,
      createdBy: userId,
      assignees: [userId],
      dueDate: daysFromToday(offset),
      status,
    })));
    const taskGroups = (await ownerAgent.get(`/api/workspaces/${workspace._id}/my-tasks`)).body;
    expect(Object.keys(taskGroups.groups)).toEqual(['overdue', 'today', 'thisWeek', 'later', 'noDate']);
    expect(taskGroups.overdue.map((item) => item.title)).toContain('overdue');
    expect(taskGroups.today.map((item) => item.title)).toContain('today');
    expect(taskGroups.thisWeek.map((item) => item.title)).toContain('thisWeek');
    expect(taskGroups.later.map((item) => item.title)).toContain('later');
    expect(taskGroups.noDate.map((item) => item._id)).toContain(task.body._id);
    expect(taskGroups.tasks.some((item) => item.status === 'done')).toBe(false);
    expect(datedTasks.find((item) => item.status === 'done')).toBeTruthy();
    expect((await ownerAgent.delete(`/api/workspaces/${workspace._id}`)).status).toBe(200);
    expect(await Workspace.findById(workspace._id)).toBeNull();
    expect(await Task.findById(task.body._id)).toBeNull();
  });

  test('invitation token route validates token format and transfer rejects non-members', async () => {
    const ownerAgent = request.agent(app);
    await register(ownerAgent);
    const workspace = (await ownerAgent.get('/api/workspaces')).body[0];
    expect((await request(app).get('/api/invitations/not-a-token')).status).toBe(400);
    expect((await ownerAgent.post(`/api/workspaces/${workspace._id}/transfer-ownership`)
      .send({ userId: '0123456789abcdef01234567' })).status).toBe(404);
  });
});
