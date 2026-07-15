const express = require('express');
const router = express.Router();
const { createTask, getTasksByProject, updateTask, deleteTask } = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createTask);
router.get('/project/:projectId', getTasksByProject);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;