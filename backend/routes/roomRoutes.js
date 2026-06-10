import express from 'express';
import { createRoom, getRoomByCode, startRoom, endRoom, getRoomResults, exportRoomResults, submitExam, getExamSubmitStatus, getMyRooms, deleteRoom, updateRoomDuration } from '../controllers/roomController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

router.use(authMiddleware);

// Create and join rooms
router.post('/', roleMiddleware(['master-admin', 'admin']), createRoom);
router.get('/', roleMiddleware(['master-admin', 'admin']), getMyRooms);
router.get('/code/:code', getRoomByCode);
router.delete('/:id', roleMiddleware(['master-admin', 'admin']), deleteRoom);
router.put('/:id/duration', roleMiddleware(['master-admin', 'admin']), updateRoomDuration);

// Start/End rooms (Host only)
router.put('/:id/start', roleMiddleware(['master-admin', 'admin']), startRoom);
router.put('/:id/end', roleMiddleware(['master-admin', 'admin']), endRoom);

// Get results and export results (Host only)
router.get('/:id/results', roleMiddleware(['master-admin', 'admin']), getRoomResults);
router.get('/:id/results/export', roleMiddleware(['master-admin', 'admin']), exportRoomResults);

// Submit exam answers (Available to all roles - user/sub-admin/admin/master-admin when taking the exam)
router.post('/submit', submitExam);
router.get('/submit-status/:jobId', getExamSubmitStatus);

export default router;
