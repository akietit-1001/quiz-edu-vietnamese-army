import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit } from './helpers.js';

let app, unit;

beforeAll(async () => {
  await ensureDbConnected();
  app = await getApp();
  unit = await createTestUnit();
});

describe('POST /api/auth/register', () => {
  it('đăng ký Chiến sĩ (soldier) hợp lệ -> 201, trả về accessToken + user, đặt cookie refreshToken', async () => {
    const res = await request(app).post('/api/auth/register').send({
      personnelType: 'soldier',
      username: `soldier_${Date.now()}`,
      password: 'Password@123',
      fullName: 'Nguyễn Văn Test',
      dateOfBirth: '2000-01-01',
      rank: 'Binh nhì',
      position: 'Chiến sĩ',
      unitId: unit._id.toString()
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({
      username: expect.any(String),
      personnelType: 'soldier',
      fullName: 'Nguyễn Văn Test',
      role: expect.stringMatching(/^(user|master-admin)$/),
      rank: 'Binh nhì',
      position: 'Chiến sĩ',
      twoFactorEnabled: false
    });
    expect(res.body.user.unit).toMatchObject({ id: expect.any(String), name: expect.any(String), level: 3 });
    // Trường password KHÔNG được lộ ra response — kiểm tra rõ ràng.
    expect(res.body.user.password).toBeUndefined();
    // refreshToken phải nằm trong cookie httpOnly, không trả trong JSON body.
    expect(res.body.refreshToken).toBeUndefined();
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie.some(c => c.startsWith('refreshToken=') && /HttpOnly/i.test(c))).toBe(true);
  });

  it('thiếu unitId -> 400 với message rõ ràng, không phải lỗi 500 mơ hồ', async () => {
    const res = await request(app).post('/api/auth/register').send({
      personnelType: 'soldier',
      username: `nounits_${Date.now()}`,
      password: 'x',
      fullName: 'No Unit',
      dateOfBirth: '2000-01-01'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đơn vị/i);
  });

  it('unitId không tồn tại trong DB -> 400 "Đơn vị không hợp lệ"', async () => {
    const res = await request(app).post('/api/auth/register').send({
      personnelType: 'soldier',
      username: `badunit_${Date.now()}`,
      password: 'x',
      fullName: 'Bad Unit',
      dateOfBirth: '2000-01-01',
      unitId: '000000000000000000000000'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Đơn vị không hợp lệ');
  });

  it('đăng ký trùng username -> 400', async () => {
    const username = `dupuser_${Date.now()}`;
    const payload = {
      personnelType: 'soldier', username, password: 'x', fullName: 'Dup',
      dateOfBirth: '2000-01-01', unitId: unit._id.toString()
    };
    const first = await request(app).post('/api/auth/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/auth/register').send(payload);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/đã được sử dụng/i);
  });
});

describe('POST /api/auth/login', () => {
  it('đăng nhập đúng mật khẩu -> 200, trả accessToken', async () => {
    const username = `logintest_${Date.now()}`;
    await request(app).post('/api/auth/register').send({
      personnelType: 'soldier', username, password: 'Password@123', fullName: 'Login Test',
      dateOfBirth: '2000-01-01', unitId: unit._id.toString()
    });

    const res = await request(app).post('/api/auth/login').send({ identifier: username, password: 'Password@123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.username).toBe(username);
  });

  it('sai mật khẩu -> 401 "Tài khoản hoặc mật khẩu không chính xác" (không tiết lộ user tồn tại hay không)', async () => {
    const username = `wrongpass_${Date.now()}`;
    await request(app).post('/api/auth/register').send({
      personnelType: 'soldier', username, password: 'RightPassword', fullName: 'Wrong Pass Test',
      dateOfBirth: '2000-01-01', unitId: unit._id.toString()
    });
    const res = await request(app).post('/api/auth/login').send({ identifier: username, password: 'WrongPassword' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });

  it('tài khoản không tồn tại -> 401 với CÙNG message như sai mật khẩu (đúng thông lệ bảo mật, không lộ thông tin)', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'khong_ton_tai_12345', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Tài khoản hoặc mật khẩu không chính xác');
  });
});

describe('Middleware xác thực (authMiddleware) trên route được bảo vệ', () => {
  it('gọi route cần đăng nhập (GET /api/quizzes) mà không có token -> 401', async () => {
    const res = await request(app).get('/api/quizzes');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token/i);
  });

  it('token giả mạo/không hợp lệ -> 401', async () => {
    const res = await request(app).get('/api/quizzes').set('Authorization', 'Bearer token.gia.mao');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/không hợp lệ|hết hạn/i);
  });

  it('token hợp lệ -> vượt qua middleware, req.user được gán đúng', async () => {
    const username = `tokentest_${Date.now()}`;
    const reg = await request(app).post('/api/auth/register').send({
      personnelType: 'soldier', username, password: 'x', fullName: 'Token Test',
      dateOfBirth: '2000-01-01', unitId: unit._id.toString()
    });
    const res = await request(app).get('/api/quizzes').set('Authorization', `Bearer ${reg.body.accessToken}`);
    // Không còn 401 nữa — nghĩa là middleware xác thực token thành công
    expect(res.status).not.toBe(401);
  });
});

describe('Phân quyền theo vai trò (roleMiddleware) trên route quản lý quân nhân', () => {
  it('role "user" gọi GET /api/users (yêu cầu sub-admin trở lên) -> 403', async () => {
    const username = `plainuser_${Date.now()}`;
    const reg = await request(app).post('/api/auth/register').send({
      personnelType: 'soldier', username, password: 'x', fullName: 'Plain User',
      dateOfBirth: '2000-01-01', unitId: unit._id.toString()
    });
    // Nếu đây vô tình là user đầu tiên trong toàn bộ test-run, hệ thống sẽ tự
    // gán role master-admin (đúng logic register) — bỏ qua case đó để test
    // luôn phản ánh đúng ý định "role user bị chặn".
    if (reg.body.user.role !== 'user') return;

    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/không có quyền/i);
  });
});
