const express = require('express');
const {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  listMembers,
  inviteMember,
  acceptInvitation,
  listInvitations,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  leaveWorkspace,
  transferOwnership,
  resendInvitation,
  deleteWorkspace,
} = require('../controllers/workspaceController');
const { createProject, getProjectsByWorkspace } = require('../controllers/projectController');
const { listActivity } = require('../controllers/activityController');
const { getWorkspaceMyTasks } = require('../controllers/taskController');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const validateObjectIds = require('../middleware/validateObjectIds');

const router = express.Router();
const invitationManagementLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many invitation requests. Please try again later.' },
});
router.use(protect);
router.get('/', listWorkspaces);
router.post('/', createWorkspace);
router.post('/invitations/accept', invitationManagementLimit, acceptInvitation);
router.get('/:workspaceId/projects', validateObjectIds('workspaceId'), getProjectsByWorkspace);
router.post('/:workspaceId/projects', validateObjectIds('workspaceId'), createProject);
router.get('/:workspaceId/my-tasks', validateObjectIds('workspaceId'), getWorkspaceMyTasks);
router.get('/:workspaceId/activity', validateObjectIds('workspaceId'), listActivity);
router.get('/:workspaceId/members', validateObjectIds('workspaceId'), listMembers);
router.patch('/:workspaceId/members/:userId', validateObjectIds('workspaceId', 'userId'), updateMemberRole);
router.delete('/:workspaceId/members/:userId', validateObjectIds('workspaceId', 'userId'), removeMember);
router.get('/:workspaceId/invitations', validateObjectIds('workspaceId'), listInvitations);
router.post('/:workspaceId/invitations', invitationManagementLimit, validateObjectIds('workspaceId'), inviteMember);
router.post('/:workspaceId/invitations/:invitationId/resend', invitationManagementLimit,
  validateObjectIds('workspaceId', 'invitationId'), resendInvitation);
router.delete('/:workspaceId/invitations/:invitationId', invitationManagementLimit,
  validateObjectIds('workspaceId', 'invitationId'), revokeInvitation);
router.post('/:workspaceId/leave', validateObjectIds('workspaceId'), leaveWorkspace);
router.post('/:workspaceId/transfer-ownership', validateObjectIds('workspaceId'), transferOwnership);
router.delete('/:workspaceId', validateObjectIds('workspaceId'), deleteWorkspace);
router.route('/:workspaceId')
  .get(validateObjectIds('workspaceId'), getWorkspace)
  .patch(validateObjectIds('workspaceId'), updateWorkspace);

module.exports = router;
