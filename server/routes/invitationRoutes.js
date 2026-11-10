const express = require('express');
const rateLimit = require('express-rate-limit');
const { param } = require('express-validator');
const {
  getInvitationPreview,
  acceptInvitationToken,
  declineInvitation,
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const invitationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many invitation requests. Please try again later.' },
});
const validateToken = [
  param('token').isHexadecimal().isLength({ min: 64, max: 64 }),
  validateRequest,
];

router.get('/:token', invitationLimit, validateToken, getInvitationPreview);
router.post('/:token/accept', invitationLimit, validateToken, protect, acceptInvitationToken);
router.post('/:token/decline', invitationLimit, validateToken, protect, declineInvitation);

module.exports = router;
