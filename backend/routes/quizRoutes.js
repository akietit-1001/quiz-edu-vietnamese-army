import express from 'express';
import multer from 'multer';
import { createQuiz, getQuizzes, getQuizById, updateQuiz, deleteQuiz, importQuiz, exportQuizDocx, exportQuizDocxBulk, generateQuizFromFile, getQuizGenStatus, regenerateQuestion, shareQuiz, revokeQuizShare, getQuizShares, updateQuizSharePermission } from '../controllers/quizController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// Tạo mới đề thi (thủ công, import file, sinh bằng AI) — chỉ dành cho
// sub-admin trở lên, đúng như README mô tả ("user": chỉ làm đề/tham gia thi,
// không soạn đề). Sửa/xóa/xem KHÔNG bị chặn theo role ở đây vì đã được kiểm
// soát chi tiết hơn trong controller (chủ đề, master-admin, hoặc người được
// chia sẻ quyền Sửa — kể cả khi họ là role "user").
const canAuthorQuiz = roleMiddleware(['master-admin', 'admin', 'sub-admin']);

// Get and CRUD quizzes
router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/', canAuthorQuiz, createQuiz);
router.put('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

// Share/revoke/list private sharing (chia sẻ riêng, độc lập với isPublic)
router.post('/:id/share', shareQuiz);
router.get('/:id/shares', getQuizShares);
router.put('/:id/share/:userId', updateQuizSharePermission);
router.delete('/:id/share/:userId', revokeQuizShare);

// Export/Import routes
router.get('/:id/export', exportQuizDocx);
router.post('/export-bulk', exportQuizDocxBulk);
router.post('/import', canAuthorQuiz, upload.single('file'), importQuiz);
router.post('/generate-from-file', canAuthorQuiz, aiGenerationLimiter, upload.array('files', 10), generateQuizFromFile);
router.get('/generate-status/:jobId', getQuizGenStatus);
router.post('/regenerate-question', canAuthorQuiz, aiGenerationLimiter, regenerateQuestion);

export default router;
