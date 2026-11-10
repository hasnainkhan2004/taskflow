const mongoose = require('mongoose');

const validateObjectIds = (...fields) => (req, res, next) => {
  const invalid = fields.some((field) => {
    const value = req.params[field] || (req.body && req.body[field]);
    return value !== undefined && value !== null && value !== '' && !mongoose.isValidObjectId(value);
  });
  if (invalid) return res.status(400).json({ message: 'Invalid identifier' });
  return next();
};

module.exports = validateObjectIds;
