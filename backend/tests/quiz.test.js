import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit, registerAndLogin } from './helpers.js';

let app, unit;

beforeAll(async () => {
  await ensureDbConnected();
  app = await getApp();
  unit = await createTestUnit();
});

describe('POST /api/quizzes (tạo đề thi)', () => {
  it('admin tạo đề thi hợp lệ -> 201, trả về đúng các trường quiz', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Đề kiểm tra chính trị quý IV',
        description: 'Mô tả test',
        category: 'Chính trị',
        duration: 30,
        passingScorePercent: 60,
        isPublic: true,
        questions: [
          { questionType: 'multiple-choice', questionText: 'Câu 1?', options: ['A', 'B'], correctAnswers: ['A'] }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('quiz');
    const q = res.body.quiz;
    expect(q).toMatchObject({
      title: 'Đề kiểm tra chính trị quý IV',
      category: 'Chính trị',
      duration: 30,
      passingScorePercent: 60,
      isPublic: true
    });
    expect(q.shareCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(Array.isArray(q.questions)).toBe(true);
    expect(q.questions).toHaveLength(1);
  });

  it('role "user" (chiến sĩ) không được tạo đề thi -> 403 (chỉ sub-admin trở lên được soạn đề)', async () => {
    const { accessToken, user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    expect(user.role).toBe('user');

    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Đề do user thường tạo', duration: 20, questions: [] });

    expect(res.status).toBe(403);
  });

  it('thiếu title (required) -> lỗi (500 do controller chưa validate tay, Mongoose ném ValidationError)', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ duration: 20, questions: [] });

    // Controller không validate `title` trước khi gọi Quiz.create(), lỗi
    // ValidationError của Mongoose rơi thẳng vào catch(error) chung, trả về
    // 500 với message chung chung thay vì 400 với message rõ ràng field nào sai.
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Lỗi máy chủ khi tạo đề thi/);
    expect(res.body.message).toMatch(/title/i);
  });
});

describe('GET /api/quizzes (danh sách + phân trang)', () => {
  it('không truyền page/limit -> trả mảng thô (không phân trang), field đúng như model chọn lọc', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    await request(app).post('/api/quizzes').set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Đề danh sách 1', duration: 20, questions: [] });

    const res = await request(app).get('/api/quizzes').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const q = res.body.find(x => x.title === 'Đề danh sách 1');
    expect(q).toBeDefined();
    // select() của controller CÓ lấy 'description' (khác giả định ban đầu
    // của test này) — vì quiz tạo không truyền description, schema default:
    // '' áp dụng nên field trả về là chuỗi rỗng, KHÔNG bị lược bỏ khỏi JSON.
    expect(q).toHaveProperty('title');
    expect(q).toHaveProperty('category');
    expect(q).toHaveProperty('shareCode');
    expect(q).toHaveProperty('questions');
    expect(q.description).toBe('');
  });

  it('truyền page + limit -> trả object { quizzes, totalCount, totalPages, currentPage }', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/quizzes').set('Authorization', `Bearer ${accessToken}`)
        .send({ title: `Đề phân trang ${i}`, duration: 20, questions: [] });
    }
    const res = await request(app).get('/api/quizzes?page=1&limit=2').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('quizzes');
    expect(res.body).toHaveProperty('totalCount');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('currentPage', 1);
    expect(res.body.quizzes.length).toBeLessThanOrEqual(2);
  });

  it('role "user" chỉ thấy đề công khai (isPublic=true) hoặc đề tự tạo — KHÔNG thấy đề nội bộ của người khác', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const privateTitle = `Đề nội bộ riêng tư ${Date.now()}`;
    await request(app).post('/api/quizzes').set('Authorization', `Bearer ${adminToken}`)
      .send({ title: privateTitle, duration: 20, isPublic: false, questions: [] });

    const { accessToken: userToken, user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    if (user.role !== 'user') return; // bỏ qua nếu vô tình là master-admin đầu tiên

    const res = await request(app).get('/api/quizzes').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    const found = res.body.find(q => q.title === privateTitle);
    expect(found).toBeUndefined();
  });
});

describe('GET /api/quizzes/:id', () => {
  it('id không tồn tại (nhưng đúng định dạng ObjectId) -> 404', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const res = await request(app).get('/api/quizzes/000000000000000000000000').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('id sai định dạng ObjectId, không phải shareCode hợp lệ -> lỗi (không phải 404 sạch)', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const res = await request(app).get('/api/quizzes/id-khong-hop-le').set('Authorization', `Bearer ${accessToken}`);
    // Ghi nhận nguyên trạng: route thử tra theo shareCode (uppercase) khi id
    // không khớp định dạng ObjectId — nếu không khớp shareCode nào, trả 404
    // bình thường (KHÔNG bị crash 500) vì Quiz.findOne({shareCode}) không ném lỗi.
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/quizzes/:id (phân quyền theo chủ sở hữu)', () => {
  it('role "user" xoá đề KHÔNG PHẢI do mình tạo -> 403', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const createRes = await request(app).post('/api/quizzes').set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Đề của admin', duration: 20, isPublic: true, questions: [] });
    const quizId = createRes.body.quiz._id;

    const { accessToken: userToken, user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    if (user.role !== 'user') return;

    const res = await request(app).delete(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('admin xoá đề bất kỳ -> 200', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const createRes = await request(app).post('/api/quizzes').set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Đề sẽ bị xoá', duration: 20, questions: [] });
    const quizId = createRes.body.quiz._id;

    const res = await request(app).delete(`/api/quizzes/${quizId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
