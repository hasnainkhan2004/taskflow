const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../validators/authValidators');

const router = express.Router();
const createAuthLimiter = (message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message },
});

router.post('/register', registerValidation, registerUser);
router.post(
  '/login',
  createAuthLimiter('Too many attempts. Please try again in 15 minutes.'),
  loginValidation,
  loginUser
);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.post(
  '/forgot-password',
  createAuthLimiter('Too many requests. Please try again in 15 minutes.'),
  forgotPasswordValidation,
  forgotPassword
);
router.post(
  '/reset-password/:token',
  createAuthLimiter('Too many attempts. Please try again in 15 minutes.'),
  resetPasswordValidation,
  resetPassword
);

module.exports = router;
