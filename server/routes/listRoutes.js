const express = require('express');
const router = express.Router();
const {
  createList,
  getListsByProject,
  updateList,
  deleteList,
  moveList,
} = require('../controllers/listController');
const { protect } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const validateObjectIds = require('../middleware/validateObjectIds');

router.use(protect);

router.post('/', validateObjectIds('project'), createList);
router.get('/project/:projectId', validateObjectIds('projectId'), getListsByProject);
router.patch(
  '/:id/move',
  param('id').isMongoId(),
  body('beforeListId').optional().isMongoId(),
  body('afterListId').optional().isMongoId(),
  validateRequest,
  moveList
);
router.put('/:id', validateObjectIds('id'), updateList);
router.delete('/:id', validateObjectIds('id'), deleteList);

module.exports = router;