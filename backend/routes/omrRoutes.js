import express from 'express';
import {
  getOmrSession,
  submitOmrScan,
  updateOmrAttempt,
  deleteOmrAttempt
} from '../controllers/omrController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

// Xem thông tin phiên chấm (cho phép cả camera điện thoại quét qua mã QR)
router.get('/session/:sessionCode', optionalAuthMiddleware, getOmrSession);

// Nộp bài thi OMR (từ camera điện thoại hoặc cán bộ)
router.post('/submit-scan', optionalAuthMiddleware, submitOmrScan);

// Cập nhật và xóa bài thi OMR (Cán bộ / Giám thị)
router.put('/attempt/:attemptId', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateOmrAttempt);
router.delete('/attempt/:attemptId', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteOmrAttempt);

export default router;
