import express from 'express';
import {
  getPublicUnitTree,
  getUnitTree,
  createUnit,
  renameUnit,
  deleteUnit
} from '../controllers/unitController.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = express.Router();

// Public — dùng cho dropdown chọn đơn vị ở trang Đăng ký, không cần đăng nhập
router.get('/public/tree', getPublicUnitTree);

router.use(authMiddleware);

router.get('/', getUnitTree);
router.post('/', roleMiddleware(['master-admin', 'admin', 'sub-admin']), createUnit);
router.put('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), renameUnit);
router.delete('/:id', roleMiddleware(['master-admin', 'admin', 'sub-admin']), deleteUnit);

export default router;
