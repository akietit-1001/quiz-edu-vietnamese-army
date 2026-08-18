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

describe('PATCH /api/units/:id/move (di chuyển đơn vị)', () => {
  it('di chuyển 1 đơn vị sang cha khác -> level tự tính lại theo cha mới', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongA = await createTestUnit({ name: 'Phòng A di chuyển', level: 2, parentId: rootUnit._id });
    const phongB = await createTestUnit({ name: 'Phòng B di chuyển', level: 2, parentId: rootUnit._id });
    const ban = await createTestUnit({ name: 'Ban di chuyển', level: 3, parentId: phongA._id });

    const res = await request(app)
      .patch(`/api/units/${ban._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newParentId: phongB._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.parentId).toBe(phongB._id.toString());
    expect(res.body.level).toBe(3); // phongB.level (2) + 1
  });

  it('di chuyển kéo theo tính lại level cho toàn bộ cây con', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongC = await createTestUnit({ name: 'Phòng C sâu', level: 2, parentId: rootUnit._id });
    const trungDoan = await createTestUnit({ name: 'Trung đoàn sâu', level: 2, parentId: rootUnit._id });
    const banCon = await createTestUnit({ name: 'Ban con sâu', level: 3, parentId: trungDoan._id });
    const daiDoiChau = await createTestUnit({ name: 'Đại đội cháu sâu', level: 4, parentId: banCon._id });

    const res = await request(app)
      .patch(`/api/units/${trungDoan._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newParentId: phongC._id.toString() });

    expect(res.status).toBe(200);

    const Unit = (await import('../models/Unit.js')).default;
    const refreshedBan = await Unit.findById(banCon._id);
    const refreshedDaiDoi = await Unit.findById(daiDoiChau._id);
    expect(refreshedBan.level).toBe(4); // trungDoan giờ level 3, ban con = 4
    expect(refreshedDaiDoi.level).toBe(5);
  });

  it('không cho di chuyển đơn vị vào chính hậu duệ của nó -> 400', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongD = await createTestUnit({ name: 'Phòng D vòng lặp', level: 2, parentId: rootUnit._id });
    const banD = await createTestUnit({ name: 'Ban D vòng lặp', level: 3, parentId: phongD._id });

    const res = await request(app)
      .patch(`/api/units/${phongD._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newParentId: banD._id.toString() });

    expect(res.status).toBe(400);
  });

  it('không cho di chuyển đơn vị gốc -> 400', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongE = await createTestUnit({ name: 'Phòng E gốc', level: 2, parentId: rootUnit._id });

    const res = await request(app)
      .patch(`/api/units/${rootUnit._id}/move`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newParentId: phongE._id.toString() });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/units/:id?cascade=true (xoá cả cây con)', () => {
  it('xoá cả cây con khi không còn quân nhân nào bên trong -> 200, xoá hết', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongF = await createTestUnit({ name: 'Phòng F xoá cây', level: 2, parentId: rootUnit._id });
    const banF = await createTestUnit({ name: 'Ban F xoá cây', level: 3, parentId: phongF._id });

    const res = await request(app)
      .delete(`/api/units/${phongF._id}?cascade=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const Unit = (await import('../models/Unit.js')).default;
    expect(await Unit.findById(phongF._id)).toBeNull();
    expect(await Unit.findById(banF._id)).toBeNull();
  });

  it('còn quân nhân ở bất kỳ đơn vị nào trong cây con -> chặn, không xoá gì cả', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const phongG = await createTestUnit({ name: 'Phòng G có người', level: 2, parentId: rootUnit._id });
    const banG = await createTestUnit({ name: 'Ban G có người', level: 3, parentId: phongG._id });
    await registerAndLogin(app, { role: 'user', unitId: banG._id });

    const res = await request(app)
      .delete(`/api/units/${phongG._id}?cascade=true`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);

    const Unit = (await import('../models/Unit.js')).default;
    expect(await Unit.findById(phongG._id)).not.toBeNull();
    expect(await Unit.findById(banG._id)).not.toBeNull();
  });
});

describe('PUT /api/units/:id/positions (chức vụ theo đơn vị)', () => {
  it('cập nhật danh sách chức vụ -> lưu đúng, khử trùng lặp và bỏ chuỗi rỗng', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const banH = await createTestUnit({ name: 'Ban H chức vụ', level: 3, parentId: rootUnit._id });

    const res = await request(app)
      .put(`/api/units/${banH._id}/positions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ positions: ['Trưởng ban', 'Trợ lý', 'Trưởng ban', '  ', ''] });

    expect(res.status).toBe(200);
    expect(res.body.positions).toEqual(['Trưởng ban', 'Trợ lý']);
  });

  it('gửi positions không phải mảng -> 400', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'master-admin', unitId: rootUnit._id });
    const banI = await createTestUnit({ name: 'Ban I chức vụ', level: 3, parentId: rootUnit._id });

    const res = await request(app)
      .put(`/api/units/${banI._id}/positions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ positions: 'không phải mảng' });

    expect(res.status).toBe(400);
  });
});
