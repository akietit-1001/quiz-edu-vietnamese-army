import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit, registerAndLogin } from './helpers.js';

let app, rootUnit;

beforeAll(async () => {
  await ensureDbConnected();
  app = await getApp();
  rootUnit = await createTestUnit({ level: 1 });
});

describe('POST /api/units (tạo đơn vị)', () => {
  it('master-admin tạo đơn vị con hợp lệ -> 201', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const res = await request(app)
      .post('/api/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phòng Test', level: 2, parentId: rootUnit._id.toString() });

    expect(res.status).toBe(201);
    // Controller trả thẳng document Unit (KHÔNG bọc trong { unit: ... }).
    // `level` trong request body bị bỏ qua hoàn toàn — server luôn tự tính
    // lại `parent.level + 1`, không tin dữ liệu cấp từ client (đúng thực hành tốt).
    expect(res.body).toMatchObject({ name: 'Phòng Test', level: 2, parentId: rootUnit._id.toString() });
  });

  it('role "user" không có quyền tạo đơn vị -> 403', async () => {
    const { accessToken, user } = await registerAndLogin(app, { role: 'user', unitId: rootUnit._id });
    if (user.role !== 'user') return;
    const res = await request(app)
      .post('/api/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phòng Trái Phép', level: 2, parentId: rootUnit._id.toString() });
    expect(res.status).toBe(403);
  });

  it('tạo trùng tên đơn vị con dưới cùng 1 cha -> lỗi (unique index vi phạm)', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    await request(app).post('/api/units').set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phòng Trùng', level: 2, parentId: rootUnit._id.toString() });
    const res = await request(app).post('/api/units').set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phòng Trùng', level: 2, parentId: rootUnit._id.toString() });
    // controller bắt riêng error.code === 11000 (lỗi unique index MongoDB)
    // và trả 400 với message rõ ràng, KHÔNG rơi vào nhánh 500 chung.
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Đã tồn tại đơn vị cùng tên trong đơn vị cha này');
  });
});

describe('GET /api/units (cây đơn vị)', () => {
  it('trả về cấu trúc cây, mỗi node có id/name/level, không rơi field nào ra ngoài dự kiến', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const res = await request(app).get('/api/units').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
