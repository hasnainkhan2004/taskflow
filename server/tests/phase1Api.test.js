const request = require('supertest');
const app = require('../app');

const createWorkspace = async (suffix = 'one') => {
  const credentials = {
    username: `phase_${suffix}`,
    email: `phase_${suffix}@example.test`,
    password: 'Strong!Unrelated456',
  };
  const signup = await request(app).post('/api/auth/register').send(credentials);
  const cookie = signup.headers['set-cookie'][0].split(';')[0];
  const api = request(app);
  const projectResponse = await api
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ title: `Project ${suffix}` });
  const project = projectResponse.body;
  const firstList = (await api
    .post('/api/lists')
    .set('Cookie', cookie)
    .send({ title: 'Todo', project: project._id })).body;
  const secondList = (await api
    .post('/api/lists')
    .set('Cookie', cookie)
    .send({ title: 'In progress', project: project._id })).body;

  const createTask = async (title, overrides = {}) => (
    (await api
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({
        title,
        list: firstList._id,
        project: project._id,
        ...overrides,
      })).body
  );

  return { api, cookie, project, firstList, secondList, createTask };
};

describe('phase 1 task APIs', () => {
  test('status endpoint sets and clears completedAt', async () => {
    const workspace = await createWorkspace();
    const task = await workspace.createTask('Ship feature');
    const detail = await workspace.api
      .get(`/api/tasks/${task._id}`)
      .set('Cookie', workspace.cookie);
    const done = await workspace.api
      .patch(`/api/tasks/${task._id}/status`)
      .set('Cookie', workspace.cookie)
      .send({ status: 'done' });
    const reopened = await workspace.api
      .patch(`/api/tasks/${task._id}/status`)
      .set('Cookie', workspace.cookie)
      .send({ status: 'in_progress' });

    expect(detail.status).toBe(200);
    expect(detail.body.title).toBe(task.title);
    expect(done.status).toBe(200);
    expect(done.body.completedAt).toBeTruthy();
    expect(reopened.body.status).toBe('in_progress');
    expect(reopened.body.completedAt).toBeNull();
  });

  test('moves tasks within and across lists and rejects an invalid target list', async () => {
    const workspace = await createWorkspace();
    const first = await workspace.createTask('First');
    const second = await workspace.createTask('Second');
    const insertBefore = await workspace.api
      .patch(`/api/tasks/${second._id}/move`)
      .set('Cookie', workspace.cookie)
      .send({ listId: workspace.firstList._id, beforeTaskId: first._id });
    expect(insertBefore.status).toBe(200);
    expect(insertBefore.body.position).toBeLessThan(first.position);

    const acrossLists = await workspace.api
      .patch(`/api/tasks/${second._id}/move`)
      .set('Cookie', workspace.cookie)
      .send({ listId: workspace.secondList._id });
    expect(acrossLists.status).toBe(200);
    expect(String(acrossLists.body.list)).toBe(workspace.secondList._id);

    const invalid = await workspace.api
      .patch(`/api/tasks/${first._id}/move`)
      .set('Cookie', workspace.cookie)
      .send({ listId: '0123456789abcdef01234567' });
    expect(invalid.status).toBe(400);
  });

  test('moves a task to another list through the task editor and appends it', async () => {
    const workspace = await createWorkspace();
    const task = await workspace.createTask('Move me');
    const existing = await workspace.createTask('Already there', { list: workspace.secondList._id });
    const moved = await workspace.api
      .put(`/api/tasks/${task._id}`)
      .set('Cookie', workspace.cookie)
      .send({ list: workspace.secondList._id });

    expect(moved.status).toBe(200);
    expect(String(moved.body.list)).toBe(workspace.secondList._id);
    expect(moved.body.position).toBeGreaterThan(existing.position);
  });

  test('sorts task priorities from high to low', async () => {
    const workspace = await createWorkspace();
    await workspace.createTask('Low', { priority: 'Low' });
    await workspace.createTask('Medium', { priority: 'Medium' });
    await workspace.createTask('High', { priority: 'High' });
    const sorted = await workspace.api
      .get(`/api/projects/${workspace.project._id}/tasks?sort=priority`)
      .set('Cookie', workspace.cookie);

    expect(sorted.status).toBe(200);
    expect(sorted.body.data.map((task) => task.priority)).toEqual(['High', 'Medium', 'Low']);
  });

  test('reorders lists and persists their fractional positions', async () => {
    const workspace = await createWorkspace();
    const thirdList = (await workspace.api
      .post('/api/lists')
      .set('Cookie', workspace.cookie)
      .send({ title: 'Done', project: workspace.project._id })).body;
    const moved = await workspace.api
      .patch(`/api/lists/${thirdList._id}/move`)
      .set('Cookie', workspace.cookie)
      .send({ beforeListId: workspace.firstList._id });
    const ordered = await workspace.api
      .get(`/api/lists/project/${workspace.project._id}`)
      .set('Cookie', workspace.cookie);

    expect(moved.status).toBe(200);
    expect(ordered.body.map((list) => list._id)).toEqual([
      thirdList._id,
      workspace.firstList._id,
      workspace.secondList._id,
    ]);
  });

  test('supports subtask create, update, and delete', async () => {
    const workspace = await createWorkspace();
    const task = await workspace.createTask('Parent task');
    const added = await workspace.api
      .post(`/api/tasks/${task._id}/subtasks`)
      .set('Cookie', workspace.cookie)
      .send({ title: 'First step' });
    const updated = await workspace.api
      .patch(`/api/tasks/${task._id}/subtasks/${added.body._id}`)
      .set('Cookie', workspace.cookie)
      .send({ title: 'Updated step', done: true });
    const deleted = await workspace.api
      .delete(`/api/tasks/${task._id}/subtasks/${added.body._id}`)
      .set('Cookie', workspace.cookie);

    expect(added.status).toBe(201);
    expect(updated.body).toMatchObject({ title: 'Updated step', done: true });
    expect(deleted.status).toBe(200);
  });

  test('creates, filters, sorts, and deletes labels with task cleanup', async () => {
    const workspace = await createWorkspace();
    const createdLabel = await workspace.api
      .post(`/api/projects/${workspace.project._id}/labels`)
      .set('Cookie', workspace.cookie)
      .send({ name: 'Urgent', color: '#f2674a' });
    const task = await workspace.createTask('Urgent launch', {
      priority: 'High',
      labels: [createdLabel.body._id],
    });
    const filtered = await workspace.api
      .get(`/api/projects/${workspace.project._id}/tasks?q=launch&priority=High&label=${createdLabel.body._id}&sort=createdAt&order=desc`)
      .set('Cookie', workspace.cookie);
    const updatedLabel = await workspace.api
      .patch(`/api/labels/${createdLabel.body._id}`)
      .set('Cookie', workspace.cookie)
      .send({ name: 'Hot', color: '#ef4444' });
    const removed = await workspace.api
      .delete(`/api/labels/${createdLabel.body._id}`)
      .set('Cookie', workspace.cookie);
    const cleanTask = await workspace.api
      .get(`/api/projects/${workspace.project._id}/tasks`)
      .set('Cookie', workspace.cookie);

    expect(createdLabel.status).toBe(201);
    expect(filtered.body).toMatchObject({ page: 1, limit: 500, total: 1 });
    expect(filtered.body.data[0]._id).toBe(task._id);
    expect(updatedLabel.body.name).toBe('Hot');
    expect(removed.status).toBe(200);
    expect(cleanTask.body.data[0].labels).toEqual([]);
  });

  test('returns project task counts for dashboard cards', async () => {
    const workspace = await createWorkspace();
    const first = await workspace.createTask('Incomplete', {
      dueDate: new Date(Date.now() - 86400000).toISOString(),
    });
    await workspace.api
      .patch(`/api/tasks/${first._id}/status`)
      .set('Cookie', workspace.cookie)
      .send({ status: 'todo' });
    const complete = await workspace.createTask('Complete');
    await workspace.api
      .patch(`/api/tasks/${complete._id}/status`)
      .set('Cookie', workspace.cookie)
      .send({ status: 'done' });
    const projects = await workspace.api
      .get('/api/projects')
      .set('Cookie', workspace.cookie);

    expect(projects.body[0]).toMatchObject({
      totalTasks: 2,
      doneTasks: 1,
      overdueTasks: 1,
    });
  });

  test('prevents another user from accessing new task, subtask, label, and project-task APIs', async () => {
    const owner = await createWorkspace('owner');
    const task = await owner.createTask('Private task');
    const otherSignup = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'phase_other',
        email: 'phase_other@example.test',
        password: 'Strong!Unrelated456',
      });
    const otherCookie = otherSignup.headers['set-cookie'][0].split(';')[0];

    const status = await request(app)
      .patch(`/api/tasks/${task._id}/status`)
      .set('Cookie', otherCookie)
      .send({ status: 'done' });
    const move = await request(app)
      .patch(`/api/tasks/${task._id}/move`)
      .set('Cookie', otherCookie)
      .send({ listId: owner.firstList._id });
    const addSubtask = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .set('Cookie', otherCookie)
      .send({ title: 'Unauthorized' });
    const taskList = await request(app)
      .get(`/api/projects/${owner.project._id}/tasks`)
      .set('Cookie', otherCookie);
    const labels = await request(app)
      .get(`/api/projects/${owner.project._id}/labels`)
      .set('Cookie', otherCookie);
    const labelCreate = await request(app)
      .post(`/api/projects/${owner.project._id}/labels`)
      .set('Cookie', otherCookie)
      .send({ name: 'Private', color: '#f2674a' });
    const subtaskUpdate = await request(app)
      .patch(`/api/tasks/${task._id}/subtasks/0123456789abcdef01234567`)
      .set('Cookie', otherCookie)
      .send({ done: true });
    const subtaskDelete = await request(app)
      .delete(`/api/tasks/${task._id}/subtasks/0123456789abcdef01234567`)
      .set('Cookie', otherCookie);
    const listMove = await request(app)
      .patch(`/api/lists/${owner.firstList._id}/move`)
      .set('Cookie', otherCookie)
      .send({});

    expect(status.status).toBe(404);
    expect(move.status).toBe(404);
    expect(addSubtask.status).toBe(404);
    expect(taskList.status).toBe(404);
    expect(labels.status).toBe(404);
    expect(labelCreate.status).toBe(404);
    expect(subtaskUpdate.status).toBe(404);
    expect(subtaskDelete.status).toBe(404);
    expect(listMove.status).toBe(404);
  });
});
