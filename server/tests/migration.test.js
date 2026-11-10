const mongoose = require('mongoose');
const User = require('../models/User');
const migrateLegacyData = require('../utils/migrateLegacyData');
const migratePhase1 = require('../utils/phase1Migration');

describe('legacy data migration', () => {
  test('backfills usernames and child-record owners before indexes are created', async () => {
    await User.collection.dropIndex('username_1');
    const userId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: userId,
      name: 'Casey Morgan',
      email: 'casey@example.com',
      password: 'legacy-hash',
      createdAt: new Date(),
    });

    await mongoose.connection.collection('projects').insertOne({
      _id: projectId,
      owner: userId,
    });
    await mongoose.connection.collection('lists').insertOne({ project: projectId });
    await mongoose.connection.collection('tasks').insertOne({ project: projectId });

    try {
      await migrateLegacyData();
      const migratedUser = await User.collection.findOne({ _id: userId });
      const migratedList = await mongoose.connection.collection('lists').findOne({ project: projectId });
      const migratedTask = await mongoose.connection.collection('tasks').findOne({ project: projectId });

      expect(migratedUser.username).toBe('casey_morgan');
      expect(migratedUser.name).toBeUndefined();
      expect(migratedList.owner).toEqual(userId);
      expect(migratedTask.owner).toEqual(userId);
    } finally {
      await User.createIndexes();
    }
  });
});

describe('phase 1 migration', () => {
  test('backfills task and list fields idempotently and orders legacy data', async () => {
    const projectId = new mongoose.Types.ObjectId();
    const listIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const older = new Date('2024-01-01T00:00:00.000Z');
    const newer = new Date('2024-02-01T00:00:00.000Z');

    await mongoose.connection.collection('lists').insertMany([
      { _id: listIds[0], project: projectId, createdAt: older },
      { _id: listIds[1], project: projectId, createdAt: newer },
    ]);
    await mongoose.connection.collection('tasks').insertMany([
      { _id: new mongoose.Types.ObjectId(), project: projectId, list: listIds[0], createdAt: newer, title: 'second' },
      { _id: new mongoose.Types.ObjectId(), project: projectId, list: listIds[0], createdAt: older, title: 'first' },
    ]);

    await migratePhase1();
    const migrated = await mongoose.connection.collection('tasks')
      .find({ list: listIds[0] }).sort({ position: 1 }).toArray();
    const firstPositions = migrated.map((task) => task.position);
    await migratePhase1();
    const migratedAgain = await mongoose.connection.collection('tasks')
      .find({ list: listIds[0] }).sort({ position: 1 }).toArray();
    const migratedLists = await mongoose.connection.collection('lists')
      .find({ project: projectId }).sort({ position: 1 }).toArray();

    expect(migrated.map((task) => task.title)).toEqual(['first', 'second']);
    expect(firstPositions).toEqual([1024, 2048]);
    expect(migratedAgain.map((task) => task.position)).toEqual(firstPositions);
    expect(migratedAgain.every((task) => task.status === 'todo')).toBe(true);
    expect(migratedAgain.every((task) => Array.isArray(task.subtasks) && Array.isArray(task.labels))).toBe(true);
    expect(migratedLists.map((list) => list.position)).toEqual([1024, 2048]);
  });
});
