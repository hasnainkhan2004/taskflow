const express = require('express');
const router = express.Router();
const {
  getTaskById,
  createTask,
  getTasksByProjectLegacy,
  updateTask,
  deleteTask,
  updateTaskStatus,
  moveTask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  updateTaskAssignees,
  getMyTasks,
  getTaskActivity,
} = require('../controllers/taskController');
const { listComments, createComment, deleteComment } = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');
const {
  createTaskValidation,
  updateTaskValidation,
  statusValidation,
  moveTaskValidation,
  subtaskValidation,
  updateSubtaskValidation,
  deleteSubtaskValidation,
} = require('../validators/taskValidators');
const validateObjectIds = require('../middleware/validateObjectIds');

router.use(protect);

router.get('/my', getMyTasks);
router.post('/', createTaskValidation, createTask);
router.get('/project/:projectId', validateObjectIds('projectId'), getTasksByProjectLegacy);
router.get('/:taskId/comments', validateObjectIds('taskId'), listComments);
router.post('/:taskId/comments', validateObjectIds('taskId'), createComment);
router.delete('/:taskId/comments/:commentId', validateObjectIds('taskId', 'commentId'), deleteComment);
router.get('/:id/activity', validateObjectIds('id'), getTaskActivity);
router.put('/:id/assignees', validateObjectIds('id'), updateTaskAssignees);
router.patch('/:id/assignees', validateObjectIds('id'), updateTaskAssignees);
router.get('/:id', validateObjectIds('id'), getTaskById);
router.patch('/:id/status', statusValidation, updateTaskStatus);
router.patch('/:id/move', moveTaskValidation, moveTask);
router.post('/:id/subtasks', subtaskValidation, addSubtask);
router.patch('/:id/subtasks/:subtaskId', validateObjectIds('id', 'subtaskId'), updateSubtaskValidation, updateSubtask);
router.delete('/:id/subtasks/:subtaskId', validateObjectIds('id', 'subtaskId'), deleteSubtaskValidation, deleteSubtask);
router.put('/:id', validateObjectIds('id'), updateTaskValidation, updateTask);
router.delete('/:id', validateObjectIds('id'), deleteTask);

module.exports = router;