import os from 'os';
import xlsx from 'xlsx';
import { Packer } from 'docx';
import ExamAttempt from '../models/ExamAttempt.js';
import ExamRoom from '../models/ExamRoom.js';
import Quiz from '../models/Quiz.js';
import User from '../models/User.js';
import Unit from '../models/Unit.js';
import OmrExam from '../models/OmrExam.js';
import { generateOmrResultsDOCX, generateOmrResultsXLSX } from '../utils/documentTemplates.js';

// Helper lấy danh sách IP mạng nội bộ (LAN) của máy chủ
export const getLocalNetworkIps = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

// Helper tính xếp loại quân sự
const calculateRank = (score, total) => {
  if (total === 0) return 'Yếu';
  const percentage = (score / total) * 100;
  if (percentage >= 90) return 'Xuất sắc';
  if (percentage >= 80) return 'Giỏi';
  if (percentage >= 65) return 'Khá';
  if (percentage >= 50) return 'Trung bình';
  return 'Yếu';
};

/**
 * ============================================================================
 * PHẦN 1: QUẢN LÝ PHIẾU KIỂM TRA OMR OFFLINE (OMR EXAM CRUD & BUSINESS RULES)
 * ============================================================================
 */

/**
 * 1. Lấy danh sách các Phiếu kiểm tra OMR Offline (có phân trang, tìm kiếm & thống kê)
 */
export const getOmrExams = async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && status !== 'ALL' && status !== 'all') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { code: searchRegex },
        { title: searchRegex },
        { currentUnit: searchRegex },
        { upperUnit: searchRegex }
      ];
    }

    const totalCount = await OmrExam.countDocuments(filter);
    const exams = await OmrExam.find(filter)
      .populate('quizId', 'title category duration questions')
      .populate('creatorId', 'fullName rank position unitId')
      .populate('unitId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Tính thống kê chi tiết cho từng đợt thi OMR (số bài đã chấm, điểm TB, tỷ lệ đạt)
    const examIds = exams.map(e => e._id);
    const quizIds = exams.map(e => e.quizId?._id).filter(Boolean);

    const attempts = await ExamAttempt.find({
      $or: [
        { omrExamId: { $in: examIds } },
        { quizId: { $in: quizIds }, mode: 'omr_scan' }
      ]
    }).select('omrExamId quizId score totalQuestions isPassed rank');

    const examsWithStats = exams.map(exam => {
      const relatedAttempts = attempts.filter(a =>
        (a.omrExamId && a.omrExamId.toString() === exam._id.toString()) ||
        (!a.omrExamId && exam.quizId && a.quizId?.toString() === exam.quizId._id.toString())
      );

      const attemptCount = relatedAttempts.length;
      const totalScore = relatedAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
      const avgScore = attemptCount > 0 ? +(totalScore / attemptCount).toFixed(1) : 0;
      const passCount = relatedAttempts.filter(a => a.isPassed).length;
      const passRate = attemptCount > 0 ? +((passCount / attemptCount) * 100).toFixed(1) : 0;

      return {
        ...exam.toObject(),
        attemptCount,
        avgScore,
        passCount,
        passRate
      };
    });

    // Thống kê toàn bộ hệ thống OMR
    const allActiveExamsCount = await OmrExam.countDocuments({ status: 'active' });
    const allOmrAttempts = await ExamAttempt.find({ mode: 'omr_scan' }).select('score totalQuestions isPassed');
    const totalOmrScanned = allOmrAttempts.length;
    const overallAvgScore = totalOmrScanned > 0
      ? +(allOmrAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalOmrScanned).toFixed(1)
      : 0;
    const overallPassCount = allOmrAttempts.filter(a => a.isPassed).length;
    const overallPassRate = totalOmrScanned > 0
      ? +((overallPassCount / totalOmrScanned) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      exams: examsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      summary: {
        totalExams: totalCount,
        activeExams: allActiveExamsCount,
        totalScanned: totalOmrScanned,
        overallAvgScore,
        overallPassRate
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tải danh sách phiếu OMR: ' + error.message });
  }
};

/**
 * 2. Lấy chi tiết một Phiếu kiểm tra OMR theo ID hoặc Mã phiếu (code)
 */
export const getOmrExamById = async (req, res) => {
  try {
    const { id } = req.params;
    let exam = null;

    if (id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
      exam = await OmrExam.findById(id)
        .populate('quizId')
        .populate('creatorId', 'fullName rank position unitId')
        .populate('unitId', 'name');
    } else {
      exam = await OmrExam.findOne({ code: id.toUpperCase() })
        .populate('quizId')
        .populate('creatorId', 'fullName rank position unitId')
        .populate('unitId', 'name');
    }

    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm tra OMR' });
    }

    const attempts = await ExamAttempt.find({
      $or: [
        { omrExamId: exam._id },
        { quizId: exam.quizId?._id, mode: 'omr_scan' }
      ]
    })
      .populate('userId', 'fullName rank position username unitId')
      .populate('examinerId', 'fullName')
      .sort({ completedAt: -1 });

    const attemptCount = attempts.length;
    const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
    const avgScore = attemptCount > 0 ? +(totalScore / attemptCount).toFixed(1) : 0;
    const passCount = attempts.filter(a => a.isPassed).length;
    const passRate = attemptCount > 0 ? +((passCount / attemptCount) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      exam: {
        ...exam.toObject(),
        attemptCount,
        avgScore,
        passCount,
        passRate
      },
      attempts
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tải chi tiết phiếu OMR: ' + error.message });
  }
};

/**
 * 3. Tạo mới Phiếu kiểm tra OMR Offline
 * RÀNG BUỘC CHẶT CHẼ: Mỗi đề thi (quizId) chỉ được có 1 phiếu đang active.
 * Nếu muốn tạo mới bắt buộc phải xóa phiếu cũ trước đó.
 */
export const createOmrExam = async (req, res) => {
  try {
    const {
      quizId,
      title,
      upperUnit,
      currentUnit,
      province,
      examCodes,
      description,
      roomCode
    } = req.body;

    if (!quizId) {
      return res.status(400).json({ message: 'Vui lòng chọn đề thi để tạo phiếu làm bài.' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Đề thi không tồn tại trong hệ thống.' });
    }

    // QUY TẮC CHỐNG TRÙNG: Kiểm tra nếu đề thi này đã được tạo Phiếu OMR trước đó
    const existingExam = await OmrExam.findOne({ quizId: quiz._id, status: 'active' })
      .populate('quizId', 'title')
      .populate('creatorId', 'fullName');

    if (existingExam) {
      const createdDateStr = new Date(existingExam.createdAt).toLocaleDateString('vi-VN');
      return res.status(400).json({
        conflict: true,
        message: `Đề thi "${quiz.title}" đã được tạo Phiếu làm bài trước đó (Mã phiếu: ${existingExam.code}, Ngày tạo: ${createdDateStr}). Đồng chí vui lòng vào phiếu làm bài đã có để In lại / Chấm thi hoặc XÓA phiếu cũ trước khi tạo mới.`,
        existingExam
      });
    }

    // Sinh mã phiếu duy nhất (OMR-XXXX)
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `OMR-${randomSuffix}`;
      const found = await OmrExam.findOne({ code });
      if (!found) isUnique = true;
    }

    const creatorId = req.user?.id || req.user?._id;
    const unitId = req.user?.unitId?._id || req.user?.unitId || null;
    const totalQuestions = quiz.questions?.length || 40;

    const parsedExamCodes = Array.isArray(examCodes) && examCodes.length > 0
      ? examCodes.map(c => String(c).trim()).filter(Boolean)
      : ['101'];

    const newOmrExam = new OmrExam({
      code,
      title: title?.trim() || `Phiếu kiểm tra: ${quiz.title}`,
      quizId: quiz._id,
      creatorId,
      unitId,
      upperUnit: upperUnit?.trim() || 'BỘ QUỐC PHÒNG',
      currentUnit: currentUnit?.trim() || 'ĐƠN VỊ TỔ CHỨC THI',
      province: province?.trim() || 'Đồng Tháp',
      examCodes: parsedExamCodes,
      totalQuestions,
      roomCode: roomCode?.trim().toUpperCase() || '',
      description: description?.trim() || '',
      status: 'active'
    });

    await newOmrExam.save();

    const populatedExam = await OmrExam.findById(newOmrExam._id)
      .populate('quizId', 'title category duration questions')
      .populate('creatorId', 'fullName rank position')
      .populate('unitId', 'name');

    res.status(201).json({
      success: true,
      message: 'Tạo phiếu làm bài thi OMR thành công!',
      exam: populatedExam
    });
  } catch (error) {
    console.error('Lỗi tạo phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo phiếu OMR: ' + error.message });
  }
};

/**
 * 3.1. Đảm bảo tồn tại Phiếu kiểm tra OMR trong DB (Nếu đã có thì lấy ra, nếu chưa có thì tự động tạo mới)
 * Phục vụ tính năng: Khi người dùng in/tải một phiếu OMR cho đề thi, hệ thống tự động sinh bản ghi OmrExam trong DB.
 */
export const ensureOmrExam = async (req, res) => {
  try {
    const {
      quizId,
      title,
      upperUnit,
      currentUnit,
      province,
      examCodes,
      description,
      roomCode,
      totalQuestions: reqTotalQ
    } = req.body;

    if (!quizId) {
      return res.status(400).json({ message: 'Thiếu thông tin ID đề thi.' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Đề thi không tồn tại trong hệ thống.' });
    }

    // 1. Kiểm tra nếu đã có phiếu OMR đang active cho đề thi này
    let existingExam = await OmrExam.findOne({ quizId: quiz._id, status: 'active' })
      .populate('quizId', 'title category duration questions')
      .populate('creatorId', 'fullName rank position')
      .populate('unitId', 'name');

    if (existingExam) {
      let changed = false;
      if (upperUnit && existingExam.upperUnit !== upperUnit.trim()) {
        existingExam.upperUnit = upperUnit.trim();
        changed = true;
      }
      if (currentUnit && existingExam.currentUnit !== currentUnit.trim()) {
        existingExam.currentUnit = currentUnit.trim();
        changed = true;
      }
      if (province && existingExam.province !== province.trim()) {
        existingExam.province = province.trim();
        changed = true;
      }
      if (reqTotalQ && existingExam.totalQuestions !== Number(reqTotalQ)) {
        existingExam.totalQuestions = Number(reqTotalQ);
        changed = true;
      }
      if (roomCode !== undefined && existingExam.roomCode !== roomCode.trim().toUpperCase()) {
        existingExam.roomCode = roomCode.trim().toUpperCase();
        changed = true;
      }
      if (Array.isArray(examCodes) && examCodes.length > 0) {
        const parsed = examCodes.map(c => String(c).trim()).filter(Boolean);
        if (JSON.stringify(existingExam.examCodes) !== JSON.stringify(parsed)) {
          existingExam.examCodes = parsed;
          changed = true;
        }
      }
      if (changed) {
        await existingExam.save();
      }

      return res.json({
        success: true,
        exam: existingExam,
        existed: true,
        message: 'Đã tìm thấy phiếu OMR tương ứng trong cơ sở dữ liệu.'
      });
    }

    // 2. Nếu chưa có -> Tự động tạo mới bản ghi OmrExam
    let code = '';
    let isUnique = false;
    while (!isUnique) {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `OMR-${randomSuffix}`;
      const found = await OmrExam.findOne({ code });
      if (!found) isUnique = true;
    }

    const creatorId = req.user?.id || req.user?._id || quiz.creatorId;
    const unitId = req.user?.unitId?._id || req.user?.unitId || quiz.unitId || null;
    const totalQuestions = reqTotalQ || quiz.questions?.length || 40;

    const parsedExamCodes = Array.isArray(examCodes) && examCodes.length > 0
      ? examCodes.map(c => String(c).trim()).filter(Boolean)
      : ['101'];

    const newOmrExam = new OmrExam({
      code,
      title: title?.trim() || `Phiếu kiểm tra: ${quiz.title}`,
      quizId: quiz._id,
      creatorId,
      unitId,
      upperUnit: upperUnit?.trim() || 'BỘ QUỐC PHÒNG',
      currentUnit: currentUnit?.trim() || 'ĐƠN VỊ TỔ CHỨC THI',
      province: province?.trim() || 'Đồng Tháp',
      examCodes: parsedExamCodes,
      totalQuestions,
      roomCode: roomCode?.trim().toUpperCase() || '',
      description: description?.trim() || 'Tự động khởi tạo khi in phiếu làm bài trắc nghiệm OMR',
      status: 'active'
    });

    await newOmrExam.save();

    const populatedExam = await OmrExam.findById(newOmrExam._id)
      .populate('quizId', 'title category duration questions')
      .populate('creatorId', 'fullName rank position')
      .populate('unitId', 'name');

    res.status(201).json({
      success: true,
      exam: populatedExam,
      created: true,
      message: 'Đã tự động khởi tạo dữ liệu phiếu OMR trong cơ sở dữ liệu!'
    });
  } catch (error) {
    console.error('Lỗi đảm bảo phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi khởi tạo phiếu OMR: ' + error.message });
  }
};

/**
 * 4. Cập nhật thông tin Phiếu kiểm tra OMR
 */
export const updateOmrExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      upperUnit,
      currentUnit,
      province,
      examCodes,
      description,
      status,
      roomCode
    } = req.body;

    const exam = await OmrExam.findById(id);
    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm tra OMR' });
    }

    if (title !== undefined) exam.title = title.trim();
    if (upperUnit !== undefined) exam.upperUnit = upperUnit.trim();
    if (currentUnit !== undefined) exam.currentUnit = currentUnit.trim();
    if (province !== undefined) exam.province = province.trim();
    if (description !== undefined) exam.description = description.trim();
    if (roomCode !== undefined) exam.roomCode = roomCode.trim().toUpperCase();
    if (status !== undefined) exam.status = status;
    if (Array.isArray(examCodes) && examCodes.length > 0) {
      exam.examCodes = examCodes.map(c => String(c).trim()).filter(Boolean);
    }

    await exam.save();

    const populatedExam = await OmrExam.findById(exam._id)
      .populate('quizId', 'title category duration questions')
      .populate('creatorId', 'fullName rank position')
      .populate('unitId', 'name');

    res.json({
      success: true,
      message: 'Cập nhật phiếu OMR thành công!',
      exam: populatedExam
    });
  } catch (error) {
    console.error('Lỗi cập nhật phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật phiếu OMR: ' + error.message });
  }
};

/**
 * 5. Xóa Phiếu kiểm tra OMR và toàn bộ kết quả bài thi liên kết
 */
export const deleteOmrExam = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await OmrExam.findById(id);
    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm tra OMR cần xóa' });
    }

    // Xóa tất cả các bài thi (ExamAttempt) liên kết với phiếu OMR này
    await ExamAttempt.deleteMany({
      $or: [
        { omrExamId: exam._id },
        { quizId: exam.quizId, mode: 'omr_scan' }
      ]
    });

    await OmrExam.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Đã xóa thành công phiếu làm bài "${exam.code}" và toàn bộ dữ liệu chấm thi liên kết.`
    });
  } catch (error) {
    console.error('Lỗi xóa phiếu OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa phiếu OMR: ' + error.message });
  }
};

/**
 * ============================================================================
 * PHẦN 2: CHẤM THI REALTIME, QUÉT CAMERA VÀ XUẤT BÁO CÁO
 * ============================================================================
 */

/**
 * 6. Khởi tạo / Lấy thông tin phiên quét OMR
 * Hỗ trợ cả 4 chế độ:
 * - Theo Mã phiếu OMR (code: OMR-XXXX) hoặc ObjectId của OmrExam
 * - Theo Mã phòng thi (roomCode)
 * - Theo Mã đề thi (quizId)
 * - Chế độ Độc lập Offline (Standalone Session) tự nhận diện đề từ phiếu làm bài
 */
export const getOmrSession = async (req, res) => {
  try {
    const { sessionCode } = req.params;
    const cleanCode = String(sessionCode || '').trim().toUpperCase();

    let room = null;
    let quiz = null;
    let omrExam = null;

    // 1. Kiểm tra nếu là OmrExam code (OMR-XXXX) hoặc ObjectId của OmrExam
    if (cleanCode.startsWith('OMR-')) {
      omrExam = await OmrExam.findOne({ code: cleanCode })
        .populate('quizId')
        .populate('creatorId', 'fullName rank position unitId')
        .populate('unitId', 'name');
    } else if (cleanCode.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanCode)) {
      omrExam = await OmrExam.findById(cleanCode)
        .populate('quizId')
        .populate('creatorId', 'fullName rank position unitId')
        .populate('unitId', 'name');
    }

    if (omrExam && omrExam.quizId) {
      quiz = omrExam.quizId;
    }

    // 2. Kiểm tra phòng thi theo roomCode nếu chưa có omrExam
    if (!omrExam && cleanCode.length >= 3) {
      room = await ExamRoom.findOne({ roomCode: cleanCode })
        .populate('quizId')
        .populate('participants.userId', 'fullName rank position unitId username');
      if (room && room.quizId) {
        quiz = room.quizId;
      }
    }

    // 3. Nếu cleanCode là Quiz ID
    if (!quiz && cleanCode.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanCode)) {
      quiz = await Quiz.findById(cleanCode);
      if (quiz && !omrExam) {
        omrExam = await OmrExam.findOne({ quizId: quiz._id, status: 'active' })
          .populate('quizId')
          .populate('creatorId', 'fullName rank position unitId');
      }
    }

    // Lấy danh sách toàn bộ đề thi gốc để hỗ trợ chọn / lọc đề trên giao diện
    const allQuizzes = await Quiz.find({ parentQuizId: null })
      .select('title category duration questions')
      .sort({ createdAt: -1 });

    // Lấy danh sách các bài đã chấm trong phiên này
    let query = {};
    if (omrExam) {
      query = {
        $or: [
          { omrExamId: omrExam._id },
          { quizId: omrExam.quizId?._id || omrExam.quizId, mode: 'omr_scan' }
        ]
      };
    } else if (room) {
      query = { roomId: room._id };
    } else if (quiz) {
      query = { quizId: quiz._id, mode: 'omr_scan' };
    } else {
      query = { mode: 'omr_scan' };
    }

    const existingAttempts = await ExamAttempt.find(query)
      .populate('userId', 'fullName rank position username unitId')
      .populate('quizId', 'title questions')
      .populate('examinerId', 'fullName')
      .sort({ completedAt: -1 })
      .limit(500);

    res.json({
      success: true,
      sessionCode: cleanCode,
      isStandalone: !room && !quiz && !omrExam,
      serverIps: getLocalNetworkIps(),
      omrExam: omrExam ? {
        _id: omrExam._id,
        code: omrExam.code,
        title: omrExam.title,
        upperUnit: omrExam.upperUnit,
        currentUnit: omrExam.currentUnit,
        province: omrExam.province,
        examCodes: omrExam.examCodes,
        totalQuestions: omrExam.totalQuestions,
        status: omrExam.status
      } : null,
      room: room ? {
        _id: room._id,
        roomCode: room.roomCode,
        status: room.status,
        participants: room.participants
      } : null,
      quiz: quiz ? {
        _id: quiz._id,
        title: quiz.title,
        totalQuestions: quiz.questions?.length || 0,
        questions: quiz.questions.map((q, idx) => ({
          questionIndex: idx + 1,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctAnswers: q.correctAnswers
        }))
      } : null,
      allQuizzes: allQuizzes.map(q => ({
        _id: q._id,
        title: q.title,
        category: q.category,
        totalQuestions: q.questions?.length || 0
      })),
      existingAttempts
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin phiên OMR:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tải phiên chấm OMR: ' + error.message });
  }
};

/**
 * 7. Gửi và chấm điểm bài thi OMR (từ Điện thoại hoặc Desktop)
 * Tự động tìm đúng Đề thi & Phiếu OMR từ thông tin QR trên tờ phiếu giấy
 */
export const submitOmrScan = async (req, res) => {
  try {
    const {
      sessionCode,
      roomId,
      quizId,
      omrExamId,
      batchCode,
      batchId,
      sbd,
      examCode,
      detectedAnswers, // [{ questionIndex: 1, selectedOption: 'A' }]
      scannedImageUrl,
      candidateFullName,
      candidateUnit
    } = req.body;

    let targetQuizId = quizId;
    let targetOmrExam = null;
    let quiz = null;

    // 1. Tìm OmrExam theo omrExamId, batchId hoặc batchCode
    const rawExamId = omrExamId || batchId;
    if (rawExamId && String(rawExamId).length === 24 && /^[0-9a-fA-F]{24}$/.test(String(rawExamId))) {
      targetOmrExam = await OmrExam.findById(rawExamId);
    } else if (batchCode) {
      targetOmrExam = await OmrExam.findOne({ code: String(batchCode).trim().toUpperCase() });
    }

    // Nếu sessionCode là mã OMR (e.g. OMR-XXXX)
    if (!targetOmrExam && sessionCode && String(sessionCode).toUpperCase().startsWith('OMR-')) {
      targetOmrExam = await OmrExam.findOne({ code: String(sessionCode).trim().toUpperCase() });
    }

    if (targetOmrExam) {
      targetQuizId = targetOmrExam.quizId;
    }

    // 2. Tìm đề thi: Theo targetQuizId
    if (targetQuizId && String(targetQuizId).length === 24 && /^[0-9a-fA-F]{24}$/.test(String(targetQuizId))) {
      quiz = await Quiz.findById(targetQuizId);
    }

    // Nếu chưa tìm thấy, thử tìm qua sessionCode nếu là Quiz ID hoặc Room
    if (!quiz && sessionCode) {
      const cleanCode = String(sessionCode).trim().toUpperCase();
      const room = await ExamRoom.findOne({ roomCode: cleanCode }).populate('quizId');
      if (room?.quizId) {
        quiz = room.quizId;
      } else if (cleanCode.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanCode)) {
        quiz = await Quiz.findById(cleanCode);
      }
    }

    // Nếu vẫn chưa có targetOmrExam nhưng có quiz, tìm OmrExam đang active của quiz này
    if (!targetOmrExam && quiz) {
      targetOmrExam = await OmrExam.findOne({ quizId: quiz._id, status: 'active' });
    }

    // Fallback lấy đề thi gần nhất
    if (!quiz) {
      quiz = await Quiz.findOne().sort({ createdAt: -1 });
      if (quiz && !targetOmrExam) {
        targetOmrExam = await OmrExam.findOne({ quizId: quiz._id, status: 'active' });
      }
    }

    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi phù hợp trong hệ thống để chấm điểm.' });
    }

    // 3. Tìm hoặc gán thí sinh (User)
    let matchedUser = null;
    const cleanSbd = String(sbd || '').trim();

    if (cleanSbd) {
      matchedUser = await User.findOne({
        $or: [
          { username: cleanSbd.toLowerCase() },
          { username: `sbd_${cleanSbd}` },
          { fullName: { $regex: cleanSbd, $options: 'i' } }
        ]
      }).populate('unitId', 'name');
    }

    const examinerId = req.user ? req.user.id : null;
    const assignedUserId = matchedUser ? matchedUser._id : (examinerId || null);
    const candidateInfo = {
      sbd: cleanSbd || '---',
      fullName: matchedUser ? matchedUser.fullName : (candidateFullName || (cleanSbd ? `Thí sinh SBD ${cleanSbd}` : 'Thí sinh Chưa rõ')),
      unitName: matchedUser ? (matchedUser.unitId?.name || '') : (candidateUnit || ''),
      rank: matchedUser ? matchedUser.rank : 'Chiến sĩ'
    };

    // 4. Tìm đề thi con/biến thể theo examCode (nếu có hoán vị mã đề)
    let scoringQuiz = quiz;
    if (examCode && quiz._id) {
      const cleanExamCode = String(examCode).trim();
      const variant = await Quiz.findOne({
        $or: [
          { parentQuizId: quiz._id, examCode: cleanExamCode },
          { _id: quiz._id, examCode: cleanExamCode }
        ]
      });
      if (variant && variant.questions && variant.questions.length > 0) {
        scoringQuiz = variant;
      }
    }

    // 5. Chấm điểm bài thi OMR theo đáp án của Đề thi nhận diện được
    let correctCount = 0;
    const totalQ = scoringQuiz.questions?.length || quiz.questions?.length || targetOmrExam?.totalQuestions || 40;
    const formattedAnswers = [];

    scoringQuiz.questions?.forEach((q, idx) => {
      const qIndex = idx + 1;
      const detected = Array.isArray(detectedAnswers)
        ? detectedAnswers.find(a => a.questionIndex === qIndex)
        : null;

      const chosenOption = detected ? detected.selectedOption : null;
      const selectedAnswers = chosenOption ? [chosenOption] : [];

      let isCorrect = false;
      if (chosenOption && q.correctAnswers && q.correctAnswers.length > 0) {
        const correctSet = q.correctAnswers.map(ans => String(ans).trim().toUpperCase());
        const letterToIndex = { 'A': '0', 'B': '1', 'C': '2', 'D': '3' };
        const chosenIndex = letterToIndex[String(chosenOption).toUpperCase()];

        if (
          correctSet.includes(String(chosenOption).toUpperCase()) ||
          (chosenIndex && correctSet.includes(chosenIndex))
        ) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        correctCount++;
      }

      formattedAnswers.push({
        questionIndex: qIndex,
        selectedAnswers
      });
    });

    const isPassed = correctCount >= Math.ceil(totalQ * 0.5);
    const rank = calculateRank(correctCount, totalQ);

    // 6. Tạo bản ghi ExamAttempt liên kết chặt chẽ với OmrExam
    const attempt = new ExamAttempt({
      userId: assignedUserId,
      roomId: roomId || null,
      quizId: quiz._id,
      omrExamId: targetOmrExam ? targetOmrExam._id : null,
      mode: 'omr_scan',
      answers: formattedAnswers,
      score: correctCount,
      totalQuestions: totalQ,
      isPassed,
      rank,
      scannedImageUrl: scannedImageUrl || '',
      examCode: examCode || '101',
      candidateInfo,
      rawOmrAnswers: detectedAnswers || [],
      examinerId: examinerId || undefined,
      completedAt: new Date()
    });

    await attempt.save();

    // 6. Nếu có roomId, cập nhật trạng thái trong ExamRoom
    if (roomId) {
      const room = await ExamRoom.findById(roomId);
      if (room) {
        const pIndex = room.participants.findIndex(p => p.userId?.toString() === assignedUserId?.toString());
        if (pIndex !== -1) {
          room.participants[pIndex].status = 'finished';
          room.participants[pIndex].attemptId = attempt._id;
        } else if (matchedUser) {
          room.participants.push({
            userId: matchedUser._id,
            status: 'finished',
            role: 'examinee',
            attemptId: attempt._id
          });
        }
        await room.save();
      }
    }

    const populatedAttempt = await ExamAttempt.findById(attempt._id)
      .populate('userId', 'fullName rank position username unitId')
      .populate('quizId', 'title questions')
      .populate('examinerId', 'fullName');

    // 7. Bắn thông báo Realtime qua Socket.io về Bàn chấm thi trên Máy tính
    const io = req.app?.get('socketio');
    if (io) {
      const channel = sessionCode ? `omr_${sessionCode.toUpperCase()}` : (roomId ? `omr_${roomId}` : null);
      if (channel) {
        io.to(channel).emit('omrNewScan', populatedAttempt);
      }
      if (targetOmrExam?.code) {
        io.to(`omr_${targetOmrExam.code}`).emit('omrNewScan', populatedAttempt);
      }
      io.emit('omrNewScan', populatedAttempt);
    }

    res.status(201).json({
      success: true,
      message: 'Chấm bài OMR thành công!',
      attempt: populatedAttempt
    });
  } catch (error) {
    console.error('Lỗi gửi bài scan OMR:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xử lý bài thi OMR: ' + error.message });
  }
};

/**
 * 8. Chỉnh sửa thủ công thông tin / đáp án bài thi OMR trên Máy tính
 */
export const updateOmrAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { sbd, fullName, examCode, answers } = req.body;

    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    const quiz = await Quiz.findById(attempt.quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Đề thi không tồn tại' });
    }

    if (sbd !== undefined) attempt.candidateInfo.sbd = sbd;
    if (fullName !== undefined) attempt.candidateInfo.fullName = fullName;
    if (examCode !== undefined) attempt.examCode = String(examCode).trim();

    // 1. Tìm đề thi hoặc biến thể tương ứng với mã đề
    let scoringQuiz = quiz;
    const targetExamCode = examCode !== undefined ? String(examCode).trim() : attempt.examCode;
    if (targetExamCode && quiz._id) {
      const variant = await Quiz.findOne({
        $or: [
          { parentQuizId: quiz._id, examCode: targetExamCode },
          { _id: quiz._id, examCode: targetExamCode }
        ]
      });
      if (variant && variant.questions && variant.questions.length > 0) {
        scoringQuiz = variant;
      }
    }

    // 2. Tính lại điểm theo đáp án của scoringQuiz
    const currentAnswers = Array.isArray(answers) ? answers : (attempt.answers || []);
    let newScore = 0;
    const totalQ = scoringQuiz.questions?.length || quiz.questions.length;
    const updatedFormattedAnswers = [];

    scoringQuiz.questions.forEach((q, idx) => {
      const qIndex = idx + 1;
      const updatedAns = currentAnswers.find(a => a.questionIndex === qIndex);
      const selectedOption = updatedAns
        ? (Array.isArray(updatedAns.selectedAnswers) ? updatedAns.selectedAnswers[0] : (updatedAns.selectedOption || null))
        : null;

      let isCorrect = false;
      if (selectedOption && q.correctAnswers && q.correctAnswers.length > 0) {
        const correctSet = q.correctAnswers.map(ans => String(ans).trim().toUpperCase());
        const letterToIndex = { 'A': '0', 'B': '1', 'C': '2', 'D': '3' };
        const chosenIndex = letterToIndex[String(selectedOption).toUpperCase()];

        if (
          correctSet.includes(String(selectedOption).toUpperCase()) ||
          (chosenIndex && correctSet.includes(chosenIndex))
        ) {
          isCorrect = true;
        }
      }

      if (isCorrect) newScore++;

      updatedFormattedAnswers.push({
        questionIndex: qIndex,
        selectedAnswers: selectedOption ? [selectedOption] : []
      });
    });

    attempt.answers = updatedFormattedAnswers;
    attempt.score = newScore;
    attempt.totalQuestions = totalQ;
    attempt.isPassed = newScore >= Math.ceil(totalQ * 0.5);
    attempt.rank = calculateRank(newScore, totalQ);
    attempt.isManualEdited = true;
    await attempt.save();

    const populatedAttempt = await ExamAttempt.findById(attempt._id)
      .populate('userId', 'fullName rank position username unitId')
      .populate('quizId', 'title questions')
      .populate('examinerId', 'fullName');

    // Bắn realtime update qua Socket
    const io = req.app?.get('socketio');
    if (io) {
      io.emit('omrScanUpdated', populatedAttempt);
    }

    res.json({
      success: true,
      message: 'Cập nhật bài thi thành công!',
      attempt: populatedAttempt
    });
  } catch (error) {
    console.error('Lỗi cập nhật bài thi OMR:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật bài thi' });
  }
};

/**
 * 9. Xóa bài chấm OMR (nếu bị quét trùng)
 */
export const deleteOmrAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi cần xóa' });
    }

    await ExamAttempt.findByIdAndDelete(attemptId);

    const io = req.app?.get('socketio');
    if (io) {
      io.emit('omrScanDeleted', { attemptId });
    }

    res.json({ success: true, message: 'Đã xóa bài thi thành công' });
  } catch (error) {
    console.error('Lỗi xóa bài thi OMR:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa bài thi' });
  }
};

/**
 * 10. Xuất báo cáo kết quả chấm thi OMR Offline (.xlsx, .docx, .csv)
 */
export const exportOmrResults = async (req, res) => {
  try {
    const {
      format = 'xlsx',
      quizId,
      omrExamId,
      sessionCode,
      upperUnit,
      currentUnit,
      province,
      position,
      showSignature,
      signerRank,
      signerName,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      orientation
    } = req.query;

    let query = { mode: 'omr_scan' };
    if (omrExamId && omrExamId !== 'ALL' && omrExamId !== 'all') {
      query.omrExamId = omrExamId;
    } else if (quizId && quizId !== 'ALL' && quizId !== 'all') {
      query.quizId = quizId;
    }

    const attempts = await ExamAttempt.find(query)
      .populate({
        path: 'userId',
        select: 'fullName rank position unitId email username',
        populate: { path: 'unitId', select: 'name' }
      })
      .populate('quizId', 'title')
      .populate('examinerId', 'fullName')
      .sort({ completedAt: -1 });

    let defaultUpperUnit = 'BỘ QUỐC PHÒNG';
    if (req.user?.unitId?.parentId) {
      const parentUnit = await Unit.findById(req.user.unitId.parentId).select('name');
      if (parentUnit) defaultUpperUnit = parentUnit.name;
    }

    if (format === 'csv') {
      const data = attempts.map((att, idx) => {
        const correctRatio = att.totalQuestions ? Math.round((att.score / att.totalQuestions) * 100) : 0;
        return {
          'STT': idx + 1,
          'Số báo danh': att.candidateInfo?.sbd || att.userId?.username || '---',
          'Họ và tên': att.candidateInfo?.fullName || att.userId?.fullName || 'Thí sinh',
          'Cấp bậc': att.candidateInfo?.rank || att.userId?.rank || 'Chiến sĩ',
          'Đơn vị': att.candidateInfo?.unitName || att.userId?.unitId?.name || '',
          'Đề thi': att.quizId?.title || 'Bài thi trắc nghiệm',
          'Mã đề': att.examCode || '101',
          'Số câu đúng': `${att.score}/${att.totalQuestions}`,
          'Tỷ lệ (%)': correctRatio,
          'Kết quả': att.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT',
          'Xếp loại': att.rank,
          'Thời gian nộp': att.completedAt ? new Date(att.completedAt).toLocaleString('vi-VN') : ''
        };
      });

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Ket_qua_OMR');

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'csv' });
      const fileNameCsv = `Báo cáo kết quả OMR - ${sessionCode || 'Offline'}.csv`;
      const encodedCsv = encodeURIComponent(fileNameCsv);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedCsv}"; filename*=UTF-8''${encodedCsv}`);
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
      return res.send(Buffer.concat([bom, buffer]));
    }

    if (format === 'xlsx') {
      const workbook = await generateOmrResultsXLSX(
        attempts,
        req.user,
        upperUnit || defaultUpperUnit,
        currentUnit || req.user?.unitId?.name || 'ĐƠN VỊ THI',
        province || 'Đồng Tháp',
        position,
        showSignature !== 'false',
        signerRank,
        signerName
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const fileNameXlsx = `Báo cáo kết quả OMR - ${sessionCode || 'Offline'}.xlsx`;
      const encodedXlsx = encodeURIComponent(fileNameXlsx);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedXlsx}"; filename*=UTF-8''${encodedXlsx}`);
      return res.send(buffer);
    }

    if (format === 'docx') {
      const doc = generateOmrResultsDOCX(
        attempts,
        req.user,
        upperUnit || defaultUpperUnit,
        currentUnit || req.user?.unitId?.name || 'ĐƠN VỊ THI',
        province || 'Đồng Tháp',
        position,
        showSignature !== 'false',
        signerRank,
        signerName,
        'BÁO CÁO KẾT QUẢ CHẤM THI TRẮC NGHIỆM (PHIẾU OMR)',
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        orientation
      );

      const buffer = await Packer.toBuffer(doc);
      const fileNameDocx = `Báo cáo kết quả OMR - ${sessionCode || 'Offline'}.docx`;
      const encodedDocx = encodeURIComponent(fileNameDocx);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodedDocx}"; filename*=UTF-8''${encodedDocx}`);
      return res.send(buffer);
    }

    return res.status(400).json({ message: 'Định dạng xuất file không được hỗ trợ' });
  } catch (error) {
    console.error('Lỗi xuất báo cáo OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xuất báo cáo OMR: ' + error.message });
  }
};
