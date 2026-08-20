import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit, registerAndLogin } from './helpers.js';

// Route nộp bài (`POST /api/rooms/submit`) đẩy việc chấm điểm vào hàng đợi
// BullMQ (`examSubmitQueue`) thay vì chấm đồng bộ ngay trong request — môi
// trường test không có Redis thật, nên mock thẳng module hàng đợi để kiểm
// tra ĐÚNG hành vi của controller (trả 202+jobId, truy vấn trạng thái job)
// mà không cần dựng Redis. Logic chấm điểm THẬT (processExamSubmission)
// được test riêng, trực tiếp, không qua hàng đợi — xem nhóm test bên dưới.
const mockJobs = new Map();
let jobCounter = 0;

vi.mock('../utils/queue.js', async (importOriginal) => {
  // Giữ nguyên các export thật khác (processExamSubmission, quizGenQueue,
  // redisConnection...) — chỉ thay riêng examSubmitQueue bằng bản giả lập.
  const actual = await importOriginal();
  return {
    ...actual,
    examSubmitQueue: {
      add: vi.fn(async (_name, data) => {
        const id = `mock-job-${++jobCounter}`;
        mockJobs.set(id, { data, state: 'waiting' });
        return { id };
      }),
      getJob: vi.fn(async (id) => {
        const record = mockJobs.get(id);
        if (!record) return null;
        return {
          id,
          getState: async () => record.state,
          returnvalue: record.returnvalue,
          failedReason: record.failedReason
        };
      })
    }
  };
});

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

describe('POST /api/rooms/submit (nộp bài — đẩy vào hàng đợi)', () => {
  it('nộp bài hợp lệ -> 202, trả jobId, KHÔNG chấm điểm ngay trong response', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });

    const res = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${accessToken}`).send({
      quizId: quiz._id,
      mode: 'practice',
      answers: [{ questionIndex: 0, selectedAnswers: ['A'] }]
    });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
    expect(res.body).not.toHaveProperty('attempt');
    expect(res.body.message).toMatch(/Đã nhận bài thi/);
  });

  it('quizId không tồn tại -> vẫn kiểm tra được TRƯỚC khi đẩy vào hàng đợi -> 404 (không tạo job thừa)', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const res = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${accessToken}`).send({
      quizId: '000000000000000000000000',
      mode: 'practice',
      answers: []
    });
    expect(res.status).toBe(404);
  });

  it('nộp bài lần 2 cho cùng 1 roomId (kiểm tra trước khi enqueue) -> 400 "chỉ được phép thi 1 lần duy nhất"', async () => {
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const roomRes = await request(app).post('/api/rooms').set('Authorization', `Bearer ${adminToken}`).send({ quizId: quiz._id });
    const roomId = roomRes.body.room._id;

    const { accessToken: userToken, user: submitUser } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const bodyPayload = { roomId, quizId: quiz._id, mode: 'exam', answers: [{ questionIndex: 0, selectedAnswers: ['A'] }] };

    // Lần 1 chỉ đẩy vào hàng đợi (202) — cần gọi processExamSubmission trực
    // tiếp (kèm userId, vì route thật lấy userId từ req.user.id chứ không
    // phải từ body) để THỰC SỰ tạo ExamAttempt trong DB, mô phỏng đúng việc
    // worker đã xử lý xong trước khi có yêu cầu nộp lần 2.
    const { processExamSubmission } = await import('../utils/queue.js');
    await processExamSubmission({ ...bodyPayload, userId: submitUser.id });

    const second = await request(app).post('/api/rooms/submit').set('Authorization', `Bearer ${userToken}`).send(bodyPayload);
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/1 lần duy nhất/);
  });
});

describe('GET /api/rooms/submit-status/:jobId (theo dõi tiến trình)', () => {
  it('job đã hoàn thành -> 200, status="completed", trả kèm attempt', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const jobId = `mock-job-${++jobCounter}`;
    mockJobs.set(jobId, { state: 'completed', returnvalue: { score: 5, totalQuestions: 10, isPassed: true, rank: 'Khá' } });

    const res = await request(app).get(`/api/rooms/submit-status/${jobId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.attempt).toMatchObject({ score: 5, isPassed: true, rank: 'Khá' });
  });

  it('job lỗi -> 500, status="failed", trả message lỗi thật của job', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const jobId = `mock-job-${++jobCounter}`;
    mockJobs.set(jobId, { state: 'failed', failedReason: 'Không tìm thấy đề thi tương ứng' });

    const res = await request(app).get(`/api/rooms/submit-status/${jobId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('failed');
    expect(res.body.message).toBe('Không tìm thấy đề thi tương ứng');
  });

  it('job đang chờ/đang xử lý -> 200, status phản ánh đúng trạng thái hàng đợi', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const jobId = `mock-job-${++jobCounter}`;
    mockJobs.set(jobId, { state: 'active' });

    const res = await request(app).get(`/api/rooms/submit-status/${jobId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('jobId không tồn tại -> 404', async () => {
    const { accessToken } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const res = await request(app).get('/api/rooms/submit-status/khong-ton-tai').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('processExamSubmission() — logic chấm điểm thuần tuý (không qua hàng đợi)', () => {
  it('chấm đúng điểm, đạt ngưỡng -> isPassed=true, rank tương ứng khoảng điểm', async () => {
    const { processExamSubmission } = await import('../utils/queue.js');
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const { user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });

    const attempt = await processExamSubmission({
      userId: user.id,
      quizId: quiz._id,
      mode: 'practice',
      answers: [
        { questionIndex: 0, selectedAnswers: ['A'] }, // đúng
        { questionIndex: 1, selectedAnswers: ['A'] }  // sai (đáp án đúng là B)
      ]
    });

    expect(attempt.score).toBe(1);
    expect(attempt.totalQuestions).toBe(2);
    expect(attempt.isPassed).toBe(true); // 1/2 = 50%, passingScorePercent=50
    expect(attempt.rank).toBe('Trung bình');
  });

  it('chấm dưới ngưỡng đạt -> isPassed=false, rank="Yếu"', async () => {
    const { processExamSubmission } = await import('../utils/queue.js');
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const { user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });

    const attempt = await processExamSubmission({
      userId: user.id,
      quizId: quiz._id,
      mode: 'practice',
      answers: [
        { questionIndex: 0, selectedAnswers: ['B'] },
        { questionIndex: 1, selectedAnswers: ['A'] }
      ]
    });
    expect(attempt.score).toBe(0);
    expect(attempt.isPassed).toBe(false);
    expect(attempt.rank).toBe('Yếu');
  });

  it('quizId không tồn tại -> ném lỗi rõ ràng (worker thật sẽ bắt lỗi này và đánh dấu job failed)', async () => {
    const { processExamSubmission } = await import('../utils/queue.js');
    const { user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    await expect(processExamSubmission({
      userId: user.id,
      quizId: '000000000000000000000000',
      mode: 'practice',
      answers: []
    })).rejects.toThrow('Không tìm thấy đề thi tương ứng');
  });

  it('cùng userId + roomId nộp 2 lần -> lần 2 ném lỗi "chỉ được phép thi 1 lần duy nhất"', async () => {
    const { processExamSubmission } = await import('../utils/queue.js');
    const { accessToken: adminToken } = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
    const quiz = await createQuizWith2Questions(adminToken);
    const roomRes = await request(app).post('/api/rooms').set('Authorization', `Bearer ${adminToken}`).send({ quizId: quiz._id });
    const roomId = roomRes.body.room._id;

    const { user } = await registerAndLogin(app, { role: 'user', unitId: unit._id });
    const payload = { userId: user.id, roomId, quizId: quiz._id, mode: 'exam', answers: [] };
    await processExamSubmission(payload);
    await expect(processExamSubmission(payload)).rejects.toThrow('1 lần duy nhất');
  });
});
