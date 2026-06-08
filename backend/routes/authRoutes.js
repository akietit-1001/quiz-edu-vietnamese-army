import express from 'express';
import { register, login, verify2FA, verifyRegister, setup2FA, enable2FA, disable2FA, refreshToken, logout } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.post('/verify-register', verifyRegister);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// Authenticated 2FA setup routes
router.post('/setup-2fa', authMiddleware, setup2FA);
router.post('/enable-2fa', authMiddleware, enable2FA);
router.post('/disable-2fa', authMiddleware, disable2FA);

export default router;
