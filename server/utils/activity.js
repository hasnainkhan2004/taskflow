const ActivityLog = require('../models/ActivityLog');

const logActivity = (workspace, actor, action, entityType, entityId, metadata = {}, options = {}) =>
  ActivityLog.create({
    workspace,
    actor,
    action,
    entityType,
    entityId,
    metadata,
    ...(options.seedTag ? { seedTag: options.seedTag } : {}),
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
  });

module.exports = { logActivity };
