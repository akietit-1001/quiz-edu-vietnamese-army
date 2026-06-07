import express from 'express';
import multer from 'multer';
import { createQuiz, getQuizzes, getQuizById, updateQuiz, deleteQuiz, importQuiz, exportQuizDocx } from '../controllers/quizController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// Get and CRUD quizzes
router.get('/', getQuizzes);
router.get('/:id', getQuizById);
router.post('/', createQuiz);
router.put('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

// Export/Import routes
router.get('/:id/export', exportQuizDocx);
router.post('/import', upload.single('file'), importQuiz);

export default router;
