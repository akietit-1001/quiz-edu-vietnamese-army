import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Unit from '../models/Unit.js';

// Script này CHỈ chạy thủ công (npm run migrate:unit), không tự chạy khi
// server khởi động. Đọc trực tiếp field `unit` (string) cũ còn sót lại
// trong MongoDB (đã bị bỏ khỏi User schema) qua raw driver, cố khớp với
// tên đơn vị mới trong Unit, rồi ghi `unitId` tương ứng.
//
// User nào không khớp được sẽ KHÔNG bị đoán bừa — chỉ in ra báo cáo để bạn
// tự gán tay qua giao diện Quản lý người dùng sau khi deploy.

const normalize = (str) => (str || '').toLowerCase().trim();

const run = async () => {
  await connectDB();

  const unitCount = await Unit.countDocuments();
  if (unitCount === 0) {
    console.error('Chưa có đơn vị nào trong hệ thống. Chạy "npm run seed:units" trước.');
    process.exit(1);
  }

  const allUnits = await Unit.find().select('name');
  const usersCollection = mongoose.connection.db.collection('users');

  // Chỉ lấy user còn field `unit` string cũ và chưa có `unitId`
  const legacyUsers = await usersCollection
    .find({ unit: { $exists: true, $type: 'string' }, unitId: { $exists: false } })
    .toArray();

  console.log(`Tìm thấy ${legacyUsers.length} user còn dùng "unit" dạng chữ cũ.`);

  const matched = [];
  const unmatched = [];

  for (const user of legacyUsers) {
    const legacyUnit = normalize(user.unit);

    // 1. Khớp chính xác tên đơn vị
    let match = allUnits.find((u) => normalize(u.name) === legacyUnit);

    // 2. Khớp kiểu chuỗi con (tên đơn vị mới nằm trong chuỗi cũ, hoặc ngược lại)
    if (!match) {
      match = allUnits.find(
        (u) => legacyUnit.includes(normalize(u.name)) || normalize(u.name).includes(legacyUnit)
      );
    }

    if (match) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { unitId: match._id }, $unset: { unit: '' } }
      );
      matched.push({ email: user.email, oldUnit: user.unit, newUnit: match.name });
    } else {
      unmatched.push({ email: user.email, oldUnit: user.unit });
    }
  }

  console.log(`\n✓ Đã khớp và cập nhật: ${matched.length}`);
  matched.forEach((m) => console.log(`  - ${m.email}: "${m.oldUnit}" → "${m.newUnit}"`));

  console.log(`\n⚠ Chưa khớp được (cần bạn tự gán tay qua giao diện): ${unmatched.length}`);
  unmatched.forEach((m) => console.log(`  - ${m.email}: "${m.oldUnit}"`));

  process.exit(0);
};

run().catch((error) => {
  console.error('Lỗi migrate unit:', error.message);
  process.exit(1);
});
