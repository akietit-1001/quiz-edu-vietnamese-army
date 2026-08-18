import request from 'supertest';
import mongoose from 'mongoose';

let appPromise;
export async function getApp() {
  if (!appPromise) {
    appPromise = import('../app.js').then(m => m.default);
  }
  return appPromise;
}

export async function ensureDbConnected() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

let unitCounter = 0;
export async function createTestUnit(overrides = {}) {
  const Unit = (await import('../models/Unit.js')).default;
  unitCounter += 1;
  const unit = await Unit.create({
    name: overrides.name || `Đơn vị test ${unitCounter}`,
    level: overrides.level ?? 3,
    parentId: overrides.parentId ?? null,
    order: overrides.order ?? 0
  });
  return unit;
}

let userCounter = 0;
/**
 * Đăng ký + đăng nhập một tài khoản test qua chính API thật (không insert
 * thẳng vào DB) để test luôn đi qua đúng luồng nghiệp vụ auth thực tế.
 * Trả về { user, accessToken }.
 */
export async function registerAndLogin(app, { role = 'user', unitId, personnelType = 'soldier' } = {}) {
  userCounter += 1;
  const username = `test_user_${userCounter}_${Date.now()}`;

  const regRes = await request(app).post('/api/auth/register').send({
    personnelType,
    username,
    password: 'Password@123',
    fullName: `Quân nhân Test ${userCounter}`,
    dateOfBirth: '2000-01-01',
    rank: 'Binh nhì',
    position: 'Chiến sĩ',
    unitId
  });

  if (regRes.status !== 201) {
    throw new Error(`registerAndLogin: đăng ký thất bại (${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }

  let { user, accessToken } = regRes.body;

  // Người dùng đầu tiên trong toàn bộ test-DB tự động là master-admin (đúng
  // logic thật của authController.register) — nếu cần role khác, nâng cấp
  // trực tiếp trong DB rồi đăng nhập lại để lấy access token phản ánh đúng role mới.
  if (role !== user.role) {
    const User = (await import('../models/User.js')).default;
    await User.updateOne({ _id: user.id }, { $set: { role } });
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: username,
      password: 'Password@123'
    });
    user = loginRes.body.user;
    accessToken = loginRes.body.accessToken;
  }

  return { user, accessToken, username };
}
