import express from 'express';
import {
  getOmrSession,
  submitOmrScan,
  updateOmrAttempt,
  deleteOmrAttempt
} from '../controllers/omrController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

router.use(authMiddleware);

// Xem thông tin phiên chấm
router.get('/session/:sessionCode', getOmrSession);

// Nộp bài thi OMR (Cán bộ / Giám thị)
router.post('/submit-scan', roleMiddleware(['master-admin', 'admin', 'sub-admin']), submitOmrScan);

// Cập nhật và xóa bài thi OMR (Cán bộ / Giám thị)
router.put('/attempt/:attemptId', roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateOmrAttempt);
router.delete('/attempt/:attemptId', roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteOmrAttempt);

export default router;
