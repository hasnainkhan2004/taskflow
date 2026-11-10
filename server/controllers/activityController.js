const ActivityLog = require('../models/ActivityLog');
const { getMembership } = require('../utils/permissions');

const listActivity = async (req, res, next) => {
  try {
    if (!(await getMembership(req.user._id, req.params.workspaceId))) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = { workspace: req.params.workspaceId };
    const [data, total] = await Promise.all([
      ActivityLog.find(filter).populate('actor', 'username').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit),
      ActivityLog.countDocuments(filter),
    ]);
    return res.json({ data, page, limit, total });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listActivity };
