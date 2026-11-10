const { body, param } = require('express-validator');
const { getPasswordErrors } = require('../utils/passwordRules');
const validateRequest = require('../middleware/validateRequest');

const registerValidation = [
  body('username')
    .isString().withMessage('Username is required')
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3 to 30 characters')
    .matches(/^[a-z0-9_]+$/).withMessage('Use only letters, numbers, and underscores'),
  body('email')
    .isString().withMessage('Email is required')
    .bail()
    .trim()
    .customSanitizer((email) => email.toLowerCase())
    .isEmail().withMessage('Enter a valid email address')
    .isLength({ max: 254 }).withMessage('Email is too long'),
  body('password')
    .isString().withMessage('Password is required')
    .bail()
    .custom((password, { req }) => {
      const errors = getPasswordErrors(password, req.body.username, req.body.email);
      if (errors.length) {
        throw new Error(errors[0]);
      }
      return true;
    }),
  validateRequest,
];

const loginValidation = [
  body('identifier')
    .isString().withMessage('Username or email is required')
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ min: 1, max: 254 }).withMessage('Enter a valid username or email'),
  body('password')
    .isString().withMessage('Password is required')
    .bail()
    .notEmpty().withMessage('Password is required'),
  validateRequest,
];

const forgotPasswordValidation = [
  body('email')
    .isString().withMessage('Email is required')
    .bail()
    .trim()
    .customSanitizer((email) => email.toLowerCase())
    .isEmail().withMessage('Enter a valid email address')
    .isLength({ max: 254 }).withMessage('Email is too long'),
  validateRequest,
];

const resetPasswordValidation = [
  param('token')
    .isHexadecimal().withMessage('Reset link is invalid or expired')
    .isLength({ min: 64, max: 64 }).withMessage('Reset link is invalid or expired'),
  body('password')
    .isString().withMessage('Password is required')
    .bail()
    .custom((password) => {
      const errors = getPasswordErrors(password);
      if (errors.length) {
        throw new Error(errors[0]);
      }
      return true;
    }),
  validateRequest,
];

module.exports = {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
};
