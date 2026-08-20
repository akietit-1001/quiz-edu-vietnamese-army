import express from 'express';
import { getAiUsageSummary } from '../controllers/aiUsageController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

router.use(authMiddleware);

// Dữ liệu chi phí AI toàn hệ thống — chỉ master-admin được xem
router.get('/summary', roleMiddleware(['master-admin']), getAiUsageSummary);

export default router;
