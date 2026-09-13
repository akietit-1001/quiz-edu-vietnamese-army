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

  describe('QUẢN LÝ PHIẾU KIỂM TRA OMR OFFLINE (OMR EXAM CRUD & BUSINESS RULES)', () => {
    let createdOmrExam;

    it('5. POST /api/omr/exams -> Tạo mới phiếu kiểm tra OMR Offline thành công', async () => {
      const res = await request(app)
        .post('/api/omr/exams')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: createdQuiz._id,
          title: 'Đợt kiểm tra Điều lệnh năm 2026',
          upperUnit: 'BỘ QUỐC PHÒNG',
          currentUnit: 'TRUNG ĐOÀN 1',
          province: 'Đồng Tháp',
          examCodes: ['101', '102', '103', '104'],
          description: 'Kiểm tra trên giấy trắc nghiệm chuẩn OMR'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.exam).toBeDefined();
      expect(res.body.exam.code).toMatch(/^OMR-[A-Z0-9]{4}$/);
      expect(res.body.exam.title).toBe('Đợt kiểm tra Điều lệnh năm 2026');
      expect(res.body.exam.totalQuestions).toBe(4);
      expect(res.body.exam.examCodes).toEqual(['101', '102', '103', '104']);

      createdOmrExam = res.body.exam;
    });

    it('6. POST /api/omr/exams -> CHỐNG TRÙNG LẶP: Chặn tạo phiếu mới khi đề thi đã có phiếu đang hoạt động', async () => {
      const res = await request(app)
        .post('/api/omr/exams')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: createdQuiz._id,
          title: 'Tạo phiếu trùng lặp cho cùng đề thi'
        });

      expect(res.status).toBe(400);
      expect(res.body.conflict).toBe(true);
      expect(res.body.message).toContain('đã được tạo Phiếu làm bài trước đó');
      expect(res.body.existingExam).toBeDefined();
      expect(res.body.existingExam._id).toBe(createdOmrExam._id);
    });

    it('7. GET /api/omr/exams -> Lấy danh sách phiếu kiểm tra OMR kèm theo thống kê', async () => {
      const res = await request(app)
        .get('/api/omr/exams')
        .set('Authorization', `Bearer ${adminUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.exams)).toBe(true);
      expect(res.body.exams.length).toBeGreaterThan(0);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalExams).toBeGreaterThan(0);
    });

    it('8. GET /api/omr/exams/:id -> Lấy chi tiết phiếu kiểm tra OMR', async () => {
      const res = await request(app)
        .get(`/api/omr/exams/${createdOmrExam._id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.exam.code).toBe(createdOmrExam.code);
    });

    it('9. PUT /api/omr/exams/:id -> Cập nhật thông tin phiếu kiểm tra OMR', async () => {
      const res = await request(app)
        .put(`/api/omr/exams/${createdOmrExam._id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          title: 'Đợt kiểm tra Điều lệnh năm 2026 (Cập nhật)',
          currentUnit: 'TRUNG ĐOÀN 1 - TIỂU ĐOÀN 2'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.exam.title).toBe('Đợt kiểm tra Điều lệnh năm 2026 (Cập nhật)');
      expect(res.body.exam.currentUnit).toBe('TRUNG ĐOÀN 1 - TIỂU ĐOÀN 2');
    });

    it('10. DELETE /api/omr/exams/:id -> Xóa phiếu OMR -> sau đó cho phép tạo phiếu mới thành công', async () => {
      const delRes = await request(app)
        .delete(`/api/omr/exams/${createdOmrExam._id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Sau khi xóa phiếu cũ, tạo lại phiếu cho đề thi này phải thành công
      const reCreateRes = await request(app)
        .post('/api/omr/exams')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: createdQuiz._id,
          title: 'Tạo phiếu mới sau khi đã xóa phiếu cũ'
        });

      expect(reCreateRes.status).toBe(201);
      expect(reCreateRes.body.success).toBe(true);
      expect(reCreateRes.body.exam.title).toBe('Tạo phiếu mới sau khi đã xóa phiếu cũ');
      expect(reCreateRes.body.exam.totalQuestions).toBe(4); // Khớp chuẩn 4 câu của createdQuiz
    });

    it('11. POST /api/omr/submit-scan -> Khớp số câu và chấm đúng theo đáp án của mã đề biến thể', async () => {
      const adminId = adminUser.user.id || adminUser.user._id;

      // Tạo đề biến thể mã 102 với đáp án hoán vị: Câu 1=D, Câu 2=C, Câu 3=B, Câu 4=A
      const variantQuiz = await Quiz.create({
        title: 'Kiểm tra Điều lệnh Quản lý Bộ đội - Mã 102',
        category: 'Điều lệnh',
        duration: 30,
        passingScorePercent: 50,
        creatorId: adminId,
        unitId: unit._id,
        parentQuizId: createdQuiz._id,
        examCode: '102',
        questions: [
          { questionType: 'multiple-choice', questionText: 'Câu 1?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['D'] },
          { questionType: 'multiple-choice', questionText: 'Câu 2?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['C'] },
          { questionType: 'multiple-choice', questionText: 'Câu 3?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['B'] },
          { questionType: 'multiple-choice', questionText: 'Câu 4?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['A'] }
        ]
      });

      // Gửi bài scan với mã đề 102 và tô: 1=D, 2=C, 3=B, 4=A -> Đạt 4/4 điểm
      const scanRes = await request(app)
        .post('/api/omr/submit-scan')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: createdQuiz._id,
          examCode: '102',
          sbd: 'sbd001',
          detectedAnswers: [
            { questionIndex: 1, selectedOption: 'D' },
            { questionIndex: 2, selectedOption: 'C' },
            { questionIndex: 3, selectedOption: 'B' },
            { questionIndex: 4, selectedOption: 'A' }
          ]
        });

      expect(scanRes.status).toBe(201);
      expect(scanRes.body.success).toBe(true);
      expect(scanRes.body.attempt.score).toBe(4);
      expect(scanRes.body.attempt.totalQuestions).toBe(4);
      expect(scanRes.body.attempt.rank).toBe('Xuất sắc');
    });

    it('12. POST /api/omr/exams/ensure -> Tự động tạo hoặc lấy bản ghi OmrExam khi in/tải phiếu', async () => {
      const adminId = adminUser.user.id || adminUser.user._id;

      // 12.1 Đảm bảo cho đề thi đã có phiếu active (trả về existed: true)
      const res1 = await request(app)
        .post('/api/omr/exams/ensure')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: createdQuiz._id,
          upperUnit: 'BỘ QUỐC PHÒNG',
          currentUnit: 'SƯ ĐOÀN 330'
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.existed).toBe(true);
      expect(res1.body.exam).toBeDefined();
      expect(res1.body.exam.code).toBeDefined();

      // 12.2 Kiểm tra với checkOnly: true (chỉ xem, chưa xác nhận in -> KHÔNG tạo bản ghi trong DB)
      const freshQuiz = await Quiz.create({
        title: 'Kiểm tra Bắn súng AK bài 1',
        category: 'Quân sự',
        duration: 20,
        passingScorePercent: 60,
        creatorId: adminId,
        unitId: unit._id,
        questions: [
          { questionType: 'multiple-choice', questionText: 'Cự ly bắn mục tiêu bia số 4 là bao nhiêu?', options: ['100m', '200m', '300m', '400m'], correctAnswers: ['100m'] }
        ]
      });

      const checkRes = await request(app)
        .post('/api/omr/exams/ensure')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: freshQuiz._id,
          checkOnly: true
        });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.success).toBe(true);
      expect(checkRes.body.existed).toBe(false);
      expect(checkRes.body.exam).toBeNull();

      // 12.3 Khi người dùng bấm xác nhận in (checkOnly: false -> Tạo mới bản ghi vào DB)
      const res2 = await request(app)
        .post('/api/omr/exams/ensure')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          quizId: freshQuiz._id,
          title: 'Phiếu kiểm tra: Bắn súng AK bài 1',
          upperUnit: 'QUÂN KHU 9',
          currentUnit: 'LỮ ĐOÀN 950',
          examCodes: ['101', '102'],
          checkOnly: false
        });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      expect(res2.body.created).toBe(true);
      expect(res2.body.exam.code).toMatch(/^OMR-/);
      expect(res2.body.exam.upperUnit).toBe('QUÂN KHU 9');
      expect(res2.body.exam.currentUnit).toBe('LỮ ĐOÀN 950');
      expect(res2.body.exam.totalQuestions).toBe(1); // 1 câu hỏi
      expect(res2.body.exam.examCodes).toEqual(['101', '102']);
    });
  });
});
