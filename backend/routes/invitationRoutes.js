import express from 'express';
import { sendInvitation, getMyInvitations, respondToInvitation } from '../controllers/invitationController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Send invitation, fetch my invitations, respond to invitation
router.post('/', sendInvitation);
router.get('/', getMyInvitations);
router.put('/:id/respond', respondToInvitation);

export default router;
