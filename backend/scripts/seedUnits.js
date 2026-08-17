import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db.js';
import Unit from '../models/Unit.js';

// Cây đơn vị mẫu ban đầu. Idempotent — chạy lại nhiều lần không tạo trùng,
// chỉ cập nhật nếu đã tồn tại (khớp theo parentId + name).
const SEED_TREE = {
  name: 'Bộ CHQS tỉnh Đồng Tháp',
  level: 1,
  children: [
    {
      name: 'Phòng Tham mưu',
      level: 2,
      children: [
        { name: 'Đại đội Thông tin 1', level: 3 },
        { name: 'Đại đội Thông tin 2', level: 3 }
      ]
    }
  ]
};

const upsertUnit = async (node, parentId) => {
  const unit = await Unit.findOneAndUpdate(
    { parentId: parentId || null, name: node.name },
    { name: node.name, level: node.level, parentId: parentId || null },
    { upsert: true, new: true }
  );
  console.log(`✓ [L${unit.level}] ${unit.name} (${unit._id})`);

  for (const child of node.children || []) {
    await upsertUnit(child, unit._id);
  }
};

const run = async () => {
  await connectDB();
  await upsertUnit(SEED_TREE, null);
  console.log('Seed đơn vị hoàn tất.');
  process.exit(0);
};

run().catch((error) => {
  console.error('Lỗi seed đơn vị:', error.message);
  process.exit(1);
});
