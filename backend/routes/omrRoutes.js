import express from 'express';
import {
  getOmrExams,
  getOmrExamById,
  createOmrExam,
  ensureOmrExam,
  updateOmrExam,
  deleteOmrExam,
  getOmrSession,
  submitOmrScan,
  updateOmrAttempt,
  deleteOmrAttempt,
  exportOmrResults
} from '../controllers/omrController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

// 1. Quản lý danh sách và CRUD Phiếu kiểm tra OMR Offline
router.get('/exams', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), getOmrExams);
router.post('/exams/ensure', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), ensureOmrExam);
router.get('/exams/:id', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), getOmrExamById);
router.post('/exams', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), createOmrExam);
router.put('/exams/:id', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateOmrExam);
router.delete('/exams/:id', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteOmrExam);

// 2. Xuất báo cáo kết quả thi OMR (đặt trước :sessionCode để tránh match nhầm)
router.get('/export/results', optionalAuthMiddleware, exportOmrResults);

// 3. Xem thông tin phiên chấm (cho phép cả camera điện thoại quét qua mã QR)
router.get('/session/:sessionCode', optionalAuthMiddleware, getOmrSession);

// 4. Nộp bài thi OMR (từ camera điện thoại hoặc cán bộ)
router.post('/submit-scan', optionalAuthMiddleware, submitOmrScan);

// 5. Cập nhật và xóa bài thi OMR (Cán bộ / Giám thị)
router.put('/attempt/:attemptId', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateOmrAttempt);
router.delete('/attempt/:attemptId', authMiddleware, roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteOmrAttempt);

export default router;

