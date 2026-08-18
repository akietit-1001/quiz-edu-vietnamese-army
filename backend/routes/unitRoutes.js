import express from 'express';
import {
  getPublicUnitTree,
  getUnitTree,
  getMyParentUnit,
  createUnit,
  renameUnit,
  deleteUnit,
  moveUnit,
  reorderUnit,
  updateUnitPositions
} from '../controllers/unitController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

// Public — dùng cho dropdown chọn đơn vị ở trang Đăng ký, không cần đăng nhập
router.get('/public/tree', getPublicUnitTree);

router.use(authMiddleware);

router.get('/', getUnitTree);
router.get('/my-parent', getMyParentUnit);
router.post('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), createUnit);
router.put('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), renameUnit);
router.patch('/:id/move', roleMiddleware(['master-admin', 'admin', 'sub-admin']), moveUnit);
router.patch('/:id/reorder', roleMiddleware(['master-admin', 'admin', 'sub-admin']), reorderUnit);
router.put('/:id/positions', roleMiddleware(['master-admin', 'admin', 'sub-admin']), updateUnitPositions);
router.delete('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteUnit);

export default router;
