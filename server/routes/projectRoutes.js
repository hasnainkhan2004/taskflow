const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

// Har route protected hai — pehle login zaroori hai
router.use(protect);

router.route('/').post(createProject).get(getProjects);

router.route('/:id').get(getProjectById).put(updateProject).delete(deleteProject);

module.exports = router;