import express from 'express';
import { register, login, verify2FA, verifyRegister, setup2FA, enable2FA, disable2FA, refreshToken, logout, forgotPassword, resetPassword, revokeTrustedDevices } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/verify-2fa', otpLimiter, verify2FA);
router.post('/verify-register', otpLimiter, verifyRegister);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);

// Authenticated 2FA setup routes
router.post('/setup-2fa', authMiddleware, setup2FA);
router.post('/enable-2fa', authMiddleware, enable2FA);
router.post('/disable-2fa', authMiddleware, disable2FA);
router.post('/revoke-trusted-devices', authMiddleware, revokeTrustedDevices);

export default router;
