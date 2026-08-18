import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit, registerAndLogin } from './helpers.js';

let app, unit;

beforeAll(async () => {
  await ensureDbConnected();
  app = await getApp();
  unit = await createTestUnit();
});

async function createQuizWith2Questions(accessToken) {
  const res = await request(app).post('/api/quizzes').set('Authorization', `Bearer ${accessToken}`).send({
    title: 'Đề chấm điểm test',
    duration: 20,
    passingScorePercent: 50,
    isPublic: true,
    questions: [
      { questionType: 'multiple-choice', questionText: 'Câu 1', options: ['A', 'B'], correctAnswers: ['A'] },
      { questionType: 'multiple-choice', questionText: 'Câu 2', options: ['A', 'B'], correctAnswers: ['B'] }
    ]
  });
  return res.body.quiz;
}

describe('POST /api/rooms (tạo phòng thi)', () => {
  it('admin tạo phòng thi hợp lệ -> 201, roomCode 6 ký tự, mặc định bật chống gian lận', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(accessToken);

    const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${accessToken}`)
      .send({ quizId: quiz._id });

    expect(res.status).toBe(201);
    expect(res.body.room.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.room.status).toBe('waiting');
    expect(res.body.room.settings).toMatchObject({ antiCheatEnabled: true, showResultImmediately: true });
  });

  it('role "user" không được tạo phòng thi -> 403', async () => {
    const { accessToken, user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    if (user.role !== 'user') return;
    const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${accessToken}`).send({ quizId: '000000000000000000000000' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/rooms/submit (nộp bài & chấm điểm)', () => {
  it('[QUAN TRỌNG] chấm điểm chạy ĐỒNG BỘ trực tiếp trong request — trả 200 ngay kèm kết quả, KHÔNG phải 202 kèm jobId như thiết kế hàng đợi trong utils/queue.js', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const quiz = await createQuizWith2Questions(accessToken);

    const res = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${accessToken}`).send({
      quizId: quiz._id,
      mode: 'practice',
      answers: [
        { questionIndex: 0, selectedAnswers: ['A'] }, // đúng
        { questionIndex: 1, selectedAnswers: ['A'] }  // sai (đáp án đúng là B)
      ]
    });

    expect(res.status).toBe(200); // KHÔNG phải 202
    expect(res.body.attempt.score).toBe(1);
    expect(res.body.attempt.totalQuestions).toBe(2);
    expect(res.body.attempt.isPassed).toBe(true); // 1/2 = 50%, passingScorePercent=50 -> đạt
    expect(res.body.attempt.rank).toBe('Trung bình');
    expect(res.body).not.toHaveProperty('jobId');
  });

  it('chấm điểm dưới ngưỡng đạt -> isPassed=false, rank="Yếu"', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const quiz = await createQuizWith2Questions(accessToken);

    const res = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${accessToken}`).send({
      quizId: quiz._id,
      mode: 'practice',
      answers: [
        { questionIndex: 0, selectedAnswers: ['B'] }, // sai
        { questionIndex: 1, selectedAnswers: ['A'] }  // sai
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.attempt.score).toBe(0);
    expect(res.body.attempt.isPassed).toBe(false);
    expect(res.body.attempt.rank).toBe('Yếu');
  });

  it('quizId không tồn tại -> 404', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const res = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${accessToken}`).send({
      quizId: '000000000000000000000000',
      mode: 'practice',
      answers: []
    });
    expect(res.status).toBe(404);
  });

  it('nộp bài lần 2 cho cùng 1 roomId -> 400 "chỉ được phép thi 1 lần duy nhất"', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const roomRes = await request(app).post('/api/rooms').set('Authorization', `Bearer ${adminToken}`).send({ quizId: quiz._id });
    const roomId = roomRes.body.room._id;

    const { accessToken: userToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const payload = { roomId, quizId: quiz._id, mode: 'exam', answers: [{ questionIndex: 0, selectedAnswers: ['A'] }] };

    const first = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${userToken}`).send(payload);
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${userToken}`).send(payload);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/1 lần duy nhất/);
  });
});

describe('[TÍNH NĂNG BỊ TẮT] GET /api/rooms/submit-status/:jobId', () => {
  it('luôn trả 501 — endpoint theo dõi tiến trình chấm bài qua hàng đợi hiện chưa được bật (code xử lý thật đang bị comment)', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const res = await request(app).get('/api/rooms/submit-status/fake-job-id').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(501);
  });
});
