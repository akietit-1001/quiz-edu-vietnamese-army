import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, updateProfile, changePassword } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

router.use(authMiddleware);

// Self profile update
router.put('/profile', updateProfile);

// Change password
router.put('/change-password', changePassword);

// Get users is available to admin, master-admin, and sub-admin
router.get('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), getUsers);

// CRUD operations are allowed for master-admin, admin, and sub-admin
router.post('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), createUser);
router.put('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateUser);
router.delete('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteUser);

export default router;
