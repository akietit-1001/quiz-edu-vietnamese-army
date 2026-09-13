import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, ensureDbConnected, createTestUnit, registerAndLogin } from './helpers.js';
import Quiz from '../models/Quiz.js';
import ExamRoom from '../models/ExamRoom.js';

let app, unit, adminUser, examineeUser;

beforeAll(async () => {
  await ensureDbConnected();
  app = await getApp();
  unit = await createTestUnit();
  adminUser = await registerAndLogin(app, { role: 'admin', unitId: unit._id });
  examineeUser = await registerAndLogin(app, { role: 'user', unitId: unit._id, username: 'sbd001' });
});

describe('HỆ THỐNG CHẤM THI OMR (OPTICAL MARK RECOGNITION)', () => {
  let createdQuiz, createdRoom;

  beforeAll(async () => {
    const adminId = adminUser.user.id || adminUser.user._id;
    const examineeId = examineeUser.user.id || examineeUser.user._id;

    // Tạo đề thi mẫu gồm 4 câu trắc nghiệm
    createdQuiz = await Quiz.create({
      title: 'Kiểm tra Điều lệnh Quản lý Bộ đội',
      category: 'Điều lệnh',
      duration: 30,
      passingScorePercent: 50,
      creatorId: adminId,
      unitId: unit._id,
      questions: [
        { questionType: 'multiple-choice', questionText: 'Câu 1?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['A'] },
        { questionType: 'multiple-choice', questionText: 'Câu 2?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['B'] },
        { questionType: 'multiple-choice', questionText: 'Câu 3?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['C'] },
        { questionType: 'multiple-choice', questionText: 'Câu 4?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['D'] }
      ]
    });

    // Tạo phòng thi mẫu
    createdRoom = await ExamRoom.create({
      roomCode: 'OMR001',
      hostId: adminId,
      quizId: createdQuiz._id,
      participants: [
        { userId: examineeId, role: 'examinee', status: 'waiting' }
      ]
    });
  });

  it('1. GET /api/omr/session/:sessionCode -> Trả về thông tin đề thi và cấu hình phiên chấm', async () => {
    const res = await request(app)
      .get(`/api/omr/session/${createdRoom.roomCode}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionCode).toBe('OMR001');
    expect(res.body.quiz.title).toBe('Kiểm tra Điều lệnh Quản lý Bộ đội');
    expect(res.body.quiz.totalQuestions).toBe(4);
    expect(res.body.room.roomCode).toBe('OMR001');
  });

  it('2. POST /api/omr/submit-scan -> Chấm điểm bài scan OMR chính xác theo đáp án', async () => {
    // Giả lập kết quả quét từ điện thoại: Câu 1=A (Đúng), Câu 2=B (Đúng), Câu 3=A (Sai), Câu 4=D (Đúng) -> 3/4 câu đúng
    const scanPayload = {
      sessionCode: createdRoom.roomCode,
      roomId: createdRoom._id,
      quizId: createdQuiz._id,
      sbd: 'sbd001',
      examCode: '101',
      candidateFullName: 'Nguyễn Văn A',
      candidateUnit: 'Đại đội 1',
      detectedAnswers: [
        { questionIndex: 1, selectedOption: 'A' },
        { questionIndex: 2, selectedOption: 'B' },
        { questionIndex: 3, selectedOption: 'A' },
        { questionIndex: 4, selectedOption: 'D' }
      ],
      scannedImageUrl: 'data:image/jpeg;base64,sampleBase64...'
    };

    const res = await request(app)
      .post('/api/omr/submit-scan')
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send(scanPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.attempt).toBeDefined();

    const attempt = res.body.attempt;
    expect(attempt.score).toBe(3); // 3 câu đúng (1, 2, 4)
    expect(attempt.totalQuestions).toBe(4);
    expect(attempt.isPassed).toBe(true);
    expect(attempt.rank).toBe('Khá'); // 75%
    expect(attempt.mode).toBe('omr_scan');
    expect(attempt.candidateInfo.sbd).toBe('sbd001');
  });

  it('3. PUT /api/omr/attempt/:attemptId -> Cho phép giám khảo sửa thủ công câu sai thành đúng và cập nhật điểm số', async () => {
    // Lấy bài thi vừa nộp
    const sessionRes = await request(app)
      .get(`/api/omr/session/${createdRoom.roomCode}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`);

    const attemptId = sessionRes.body.existingAttempts[0]._id;

    // Giám khảo xem lại ảnh thấy câu 3 học viên tô C nhưng tẩy mờ -> sửa câu 3 thành C (Đúng) -> 4/4 câu đúng
    const updateRes = await request(app)
      .put(`/api/omr/attempt/${attemptId}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`)
      .send({
        sbd: '001',
        fullName: 'Nguyễn Văn A (Đã đối soát)',
        answers: [
          { questionIndex: 1, selectedOption: 'A' },
          { questionIndex: 2, selectedOption: 'B' },
          { questionIndex: 3, selectedOption: 'C' },
          { questionIndex: 4, selectedOption: 'D' }
        ]
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.attempt.score).toBe(4);
    expect(updateRes.body.attempt.rank).toBe('Xuất sắc');
    expect(updateRes.body.attempt.isManualEdited).toBe(true);
    expect(updateRes.body.attempt.candidateInfo.fullName).toBe('Nguyễn Văn A (Đã đối soát)');
  });

  it('4. DELETE /api/omr/attempt/:attemptId -> Cho phép xóa bài thi quét trùng', async () => {
    const sessionRes = await request(app)
      .get(`/api/omr/session/${createdRoom.roomCode}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`);

    const attemptId = sessionRes.body.existingAttempts[0]._id;

    const deleteRes = await request(app)
      .delete(`/api/omr/attempt/${attemptId}`)
      .set('Authorization', `Bearer ${adminUser.accessToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });
});
