import express from 'express';
import { createBankQuestion, getBankQuestions, updateBankQuestion, deleteBankQuestion, autoGenerateQuiz } from '../controllers/bankController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

router.use(authMiddleware);

// Retrieve bank questions (available to admins & sub-admins for viewing)
router.get('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), getBankQuestions);

// Central Bank CRUD operations (Admins, Master-Admin, and Sub-Admins based on permissions)
router.post('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), createBankQuestion);
router.put('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateBankQuestion);
router.delete('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteBankQuestion);

// Auto-generation route
router.post('/generate', roleMiddleware(['master-admin', 'admin', 'sub-admin']), autoGenerateQuiz);

export default router;
