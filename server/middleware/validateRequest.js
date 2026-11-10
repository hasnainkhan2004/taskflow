const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const errors = {};
  result.array().forEach(({ path, msg }) => {
    errors[path] = msg;
  });
  return res.status(400).json({
    message: 'Please check the highlighted fields.',
    errors,
  });
};

module.exports = validateRequest;
