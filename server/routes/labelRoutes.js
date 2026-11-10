const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  updateLabel,
  deleteLabel,
} = require('../controllers/labelController');
const { updateLabelValidation } = require('../validators/labelValidators');
const validateObjectIds = require('../middleware/validateObjectIds');

const router = express.Router();
router.use(protect);
router.patch('/:id', validateObjectIds('id'), updateLabelValidation, updateLabel);
router.delete('/:id', validateObjectIds('id'), deleteLabel);

module.exports = router;
