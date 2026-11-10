const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectsByWorkspace,
  getProjectById,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { getTasksByProject } = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { queryValidation } = require('../validators/taskValidators');
const { getProjectLabels, createProjectLabel } = require('../controllers/labelController');
const { labelValidation } = require('../validators/labelValidators');
const validateObjectIds = require('../middleware/validateObjectIds');

// Har route protected hai — pehle login zaroori hai
router.use(protect);

router.post('/', validateObjectIds('workspaceId'), createProject);
router.get('/', getProjects);

router.get('/workspace/:workspaceId', validateObjectIds('workspaceId'), getProjectsByWorkspace);
router.get('/:projectId/tasks', validateObjectIds('projectId'), queryValidation, getTasksByProject);
router.get('/:projectId/labels', validateObjectIds('projectId'), getProjectLabels);
router.post('/:projectId/labels', validateObjectIds('projectId'), labelValidation, createProjectLabel);
router.route('/:id')
  .get(validateObjectIds('id'), getProjectById)
  .put(validateObjectIds('id'), updateProject)
  .delete(validateObjectIds('id'), deleteProject);

module.exports = router;