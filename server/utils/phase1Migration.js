const mongoose = require('mongoose');
const Task = require('../models/Task');
const List = require('../models/List');
const Label = require('../models/Label');

const migratePhase1 = async (database = mongoose.connection.db) => {
  const taskCollection = database.collection(Task.collection.name);
  const listCollection = database.collection(List.collection.name);

  await taskCollection.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'todo', completedAt: null } }
  );
  await taskCollection.updateMany(
    { subtasks: { $exists: false } },
    { $set: { subtasks: [] } }
  );
  await taskCollection.updateMany(
    { labels: { $exists: false } },
    { $set: { labels: [] } }
  );

  const listsWithUnpositionedTasks = await taskCollection.distinct('list', {
    position: { $exists: false },
  });
  for (const listId of listsWithUnpositionedTasks) {
    const tasks = await taskCollection.find({ list: listId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    const positions = new Set(
      tasks.filter((task) => Number.isFinite(task.position)).map((task) => task.position)
    );
    let nextPosition = 1024;
    for (const task of tasks) {
      if (Number.isFinite(task.position)) continue;
      while (positions.has(nextPosition)) nextPosition += 1024;
      await taskCollection.updateOne(
        { _id: task._id, position: { $exists: false } },
        { $set: { position: nextPosition } }
      );
      positions.add(nextPosition);
      nextPosition += 1024;
    }
  }

  const projectsWithUnpositionedLists = await listCollection.distinct('project', {
    position: { $exists: false },
  });
  for (const projectId of projectsWithUnpositionedLists) {
    const lists = await listCollection.find({ project: projectId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    const positions = new Set(
      lists.filter((list) => Number.isFinite(list.position)).map((list) => list.position)
    );
    let nextPosition = 1024;
    for (const list of lists) {
      if (Number.isFinite(list.position)) continue;
      while (positions.has(nextPosition)) nextPosition += 1024;
      await listCollection.updateOne(
        { _id: list._id, position: { $exists: false } },
        { $set: { position: nextPosition } }
      );
      positions.add(nextPosition);
      nextPosition += 1024;
    }
  }

  await Promise.all([
    Task.createIndexes(),
    List.createIndexes(),
    Label.createIndexes(),
  ]);
};

module.exports = migratePhase1;
