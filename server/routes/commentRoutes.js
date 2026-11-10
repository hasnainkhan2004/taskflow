const express = require('express');
const { updateComment, deleteComment } = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectIds = require('../middleware/validateObjectIds');

const router = express.Router();
router.use(protect);
router.patch('/:id', validateObjectIds('id'), updateComment);
router.delete('/:id', validateObjectIds('id'), deleteComment);

module.exports = router;
