const mongoose = require('mongoose');

const makeUsername = async (user) => {
  const rawBase = String(user.name || user.email?.split('@')[0] || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  const base = rawBase.length >= 3 ? rawBase : `user_${rawBase || 'account'}`.slice(0, 30);
  let username = base;
  let suffix = 1;

  while (await mongoose.connection.collection('users').findOne({ username })) {
    const ending = `_${suffix}`;
    username = `${base.slice(0, 30 - ending.length)}${ending}`;
    suffix += 1;
  }

  return username;
};

const migrateLegacyData = async () => {
  const users = mongoose.connection.collection('users');
  const legacyUsers = users.find({
    $or: [{ username: { $exists: false } }, { username: null }],
  });
  for await (const user of legacyUsers) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: { username: await makeUsername(user) },
        $unset: { name: '' },
      }
    );
  }

  const projects = mongoose.connection.collection('projects');
  const lists = mongoose.connection.collection('lists');
  const tasks = mongoose.connection.collection('tasks');
  const projectCursor = projects.find({ owner: { $exists: true } }).project({ _id: 1, owner: 1 });
  for await (const project of projectCursor) {
    await Promise.all([
      lists.updateMany(
        { project: project._id, $or: [{ owner: { $exists: false } }, { owner: null }] },
        { $set: { owner: project.owner } }
      ),
      tasks.updateMany(
        { project: project._id, $or: [{ owner: { $exists: false } }, { owner: null }] },
        { $set: { owner: project.owner } }
      ),
    ]);
  }
};

module.exports = migrateLegacyData;
