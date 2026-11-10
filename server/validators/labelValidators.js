const { body, param } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { LABEL_COLORS } = require('../models/Label');

const labelValidation = [
  param('projectId').isMongoId(),
  body('name').isString().trim().isLength({ min: 1, max: 30 }),
  body('color').isIn(LABEL_COLORS),
  validateRequest,
];

const updateLabelValidation = [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 30 }),
  body('color').optional().isIn(LABEL_COLORS),
  validateRequest,
];

module.exports = { labelValidation, updateLabelValidation };
