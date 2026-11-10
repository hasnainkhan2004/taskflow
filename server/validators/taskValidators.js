const { body, param, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');

const objectId = (value) => /^[a-f\d]{24}$/i.test(value);
const taskId = param('id').custom(objectId).withMessage('Invalid task ID');

const createTaskValidation = [
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 10000 }),
  body('list').isString().custom(objectId),
  body('project').isString().custom(objectId),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('dueDate').optional({ nullable: true }).isISO8601(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('labels').optional().isArray({ max: 50 }),
  body('labels.*').optional().isString().custom(objectId),
  body('assignees').optional().isArray({ max: 50 }),
  body('assignees.*').optional().isString().custom(objectId),
  validateRequest,
];

const updateTaskValidation = [
  taskId,
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().trim().isLength({ max: 10000 }),
  body('list').optional().isString().custom(objectId),
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('dueDate').optional({ nullable: true }).isISO8601(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('labels').optional().isArray({ max: 50 }),
  body('labels.*').optional().isString().custom(objectId),
  body('assignees').optional().isArray({ max: 50 }),
  body('assignees.*').optional().isString().custom(objectId),
  validateRequest,
];

const statusValidation = [
  taskId,
  body('status').isIn(['todo', 'in_progress', 'done']),
  validateRequest,
];

const moveTaskValidation = [
  taskId,
  body('listId').isString().custom(objectId),
  body('beforeTaskId').optional().isString().custom(objectId),
  body('afterTaskId').optional().isString().custom(objectId),
  validateRequest,
];

const subtaskValidation = [
  taskId,
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  validateRequest,
];

const updateSubtaskValidation = [
  taskId,
  param('subtaskId').custom(objectId).withMessage('Invalid subtask ID'),
  body().custom((bodyValue) =>
    Object.hasOwn(bodyValue, 'title') || Object.hasOwn(bodyValue, 'done')
  ).withMessage('Provide a title or done value'),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('done').optional().isBoolean().toBoolean(),
  validateRequest,
];

const deleteSubtaskValidation = [
  taskId,
  param('subtaskId').custom(objectId).withMessage('Invalid subtask ID'),
  validateRequest,
];

const queryValidation = [
  param('projectId').custom(objectId).withMessage('Invalid project ID'),
  query('status').optional().isIn(['todo', 'in_progress', 'done']),
  query('priority').optional().isIn(['Low', 'Medium', 'High']),
  query('label').optional().isString().custom(objectId),
  query('due').optional().isIn(['overdue', 'today', 'week', 'none']),
  query('sort').optional().isIn(['position', 'dueDate', 'priority', 'createdAt']),
  query('order').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('q').optional().isString().trim().isLength({ max: 200 }),
  validateRequest,
];

module.exports = {
  createTaskValidation,
  updateTaskValidation,
  statusValidation,
  moveTaskValidation,
  subtaskValidation,
  updateSubtaskValidation,
  deleteSubtaskValidation,
  queryValidation,
};
