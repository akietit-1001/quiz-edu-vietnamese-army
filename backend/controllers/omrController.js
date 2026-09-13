import os from 'os';
import xlsx from 'xlsx';
import { Packer } from 'docx';
import ExamAttempt from '../models/ExamAttempt.js';
import ExamRoom from '../models/ExamRoom.js';
import Quiz from '../models/Quiz.js';
import User from '../models/User.js';
import Unit from '../models/Unit.js';
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
 * 1. Khởi tạo / Lấy thông tin phiên quét OMR
 * Hỗ trợ cả 3 chế độ:
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

    // 1. Kiểm tra phòng thi theo roomCode
    if (cleanCode.length >= 3) {
      room = await ExamRoom.findOne({ roomCode: cleanCode })
        .populate('quizId')
        .populate('participants.userId', 'fullName rank position unitId username');
    }

    if (room && room.quizId) {
      quiz = room.quizId;
    } else if (cleanCode.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanCode)) {
      // 2. Nếu sessionCode là Quiz ID
      quiz = await Quiz.findById(cleanCode);
    }

    // Lấy danh sách toàn bộ đề thi gốc để hỗ trợ chọn / lọc đề trên giao diện
    const allQuizzes = await Quiz.find({ parentQuizId: null })
      .select('title category duration questions')
      .sort({ createdAt: -1 });

    // Lấy danh sách các bài đã chấm trong phiên này
    let query = {};
    if (room) {
      query = { roomId: room._id };
    } else if (quiz) {
      query = { quizId: quiz._id, mode: 'omr_scan' };
    } else {
      // Phiên độc lập offline: lấy toàn bộ bài OMR gần nhất
      query = { mode: 'omr_scan' };
    }

    const existingAttempts = await ExamAttempt.find(query)
      .populate('userId', 'fullName rank position username unitId')
      .populate('quizId', 'title questions')
      .populate('examinerId', 'fullName')
      .sort({ completedAt: -1 })
      .limit(300);

    res.json({
      success: true,
      sessionCode: cleanCode,
      isStandalone: !room && !quiz,
      serverIps: getLocalNetworkIps(),
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
 * 2. Gửi và chấm điểm bài thi OMR (từ Điện thoại hoặc Desktop)
 * Tự động tìm đúng Đề thi từ thông tin QR trên tờ phiếu giấy (quizId)
 */
export const submitOmrScan = async (req, res) => {
  try {
    const {
      sessionCode,
      roomId,
      quizId,
      sbd,
      examCode,
      detectedAnswers, // [{ questionIndex: 1, selectedOption: 'A' }]
      scannedImageUrl,
      candidateFullName,
      candidateUnit
    } = req.body;

    let targetQuizId = quizId;
    let quiz = null;

    // 1. Tìm đề thi: Trước hết theo quizId đọc từ QR trên tờ phiếu làm bài
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

    // Nếu vẫn chưa có quiz, fallback lấy đề thi gần nhất
    if (!quiz) {
      quiz = await Quiz.findOne().sort({ createdAt: -1 });
    }

    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi phù hợp trong hệ thống để chấm điểm.' });
    }

    // 2. Tìm hoặc gán thí sinh (User)
    let matchedUser = null;
    const cleanSbd = String(sbd || '').trim();

    if (cleanSbd) {
      // Tìm theo username hoặc SBD
      matchedUser = await User.findOne({
        $or: [
          { username: cleanSbd.toLowerCase() },
          { username: `sbd_${cleanSbd}` },
          { fullName: { $regex: cleanSbd, $options: 'i' } }
        ]
      }).populate('unitId', 'name');
    }

    // Nếu không tìm thấy, fallback gán cho chính tài khoản đang chấm (Examiner) kèm candidateInfo
    const examinerId = req.user ? req.user.id : null;
    const assignedUserId = matchedUser ? matchedUser._id : (examinerId || null);
    const candidateInfo = {
      sbd: cleanSbd || '---',
      fullName: matchedUser ? matchedUser.fullName : (candidateFullName || (cleanSbd ? `Thí sinh SBD ${cleanSbd}` : 'Thí sinh Chưa rõ')),
      unitName: matchedUser ? (matchedUser.unitId?.name || '') : (candidateUnit || ''),
      rank: matchedUser ? matchedUser.rank : 'Chiến sĩ'
    };

    // 3. Chấm điểm bài thi OMR theo đáp án của Đề thi nhận diện được
    let correctCount = 0;
    const totalQ = quiz.questions?.length || 40;
    const formattedAnswers = [];

    quiz.questions?.forEach((q, idx) => {
      const qIndex = idx + 1;
      const detected = Array.isArray(detectedAnswers)
        ? detectedAnswers.find(a => a.questionIndex === qIndex)
        : null;

      const chosenOption = detected ? detected.selectedOption : null;
      const selectedAnswers = chosenOption ? [chosenOption] : [];

      // So khớp đáp án
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

    // 4. Tạo bản ghi ExamAttempt
    const attempt = new ExamAttempt({
      userId: assignedUserId,
      roomId: roomId || null,
      quizId: quiz._id,
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

    // 5. Nếu có roomId, cập nhật trạng thái trong ExamRoom
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

    // 6. Bắn thông báo Realtime qua Socket.io về Bàn chấm thi trên Máy tính
    const io = req.app?.get('socketio');
    if (io) {
      const channel = sessionCode ? `omr_${sessionCode.toUpperCase()}` : (roomId ? `omr_${roomId}` : null);
      if (channel) {
        io.to(channel).emit('omrNewScan', populatedAttempt);
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
 * 3. Chỉnh sửa thủ công thông tin / đáp án bài thi OMR trên Máy tính
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
    if (examCode !== undefined) attempt.examCode = examCode;

    // Nếu có cập nhật lại câu trả lời -> tính lại điểm
    if (Array.isArray(answers)) {
      let newScore = 0;
      const totalQ = quiz.questions.length;
      const updatedFormattedAnswers = [];

      quiz.questions.forEach((q, idx) => {
        const qIndex = idx + 1;
        const updatedAns = answers.find(a => a.questionIndex === qIndex);
        const selectedOption = updatedAns
          ? (Array.isArray(updatedAns.selectedAnswers) ? updatedAns.selectedAnswers[0] : updatedAns.selectedOption)
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
      attempt.isPassed = newScore >= Math.ceil(totalQ * 0.5);
      attempt.rank = calculateRank(newScore, totalQ);
    }

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
 * 4. Xóa bài chấm OMR (nếu bị quét trùng)
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
 * 5. Xuất báo cáo kết quả chấm thi OMR Offline (.xlsx, .docx, .csv)
 */
export const exportOmrResults = async (req, res) => {
  try {
    const {
      format = 'xlsx',
      quizId,
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
    if (quizId && quizId !== 'ALL' && quizId !== 'all') {
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
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=Bao_cao_OMR_${sessionCode || 'Offline'}.csv`);
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
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Bao_cao_OMR_${sessionCode || 'Offline'}.xlsx`);
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
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Bao_cao_OMR_${sessionCode || 'Offline'}.docx`);
      return res.send(buffer);
    }

    return res.status(400).json({ message: 'Định dạng xuất file không được hỗ trợ' });
  } catch (error) {
    console.error('Lỗi xuất báo cáo OMR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi xuất báo cáo OMR: ' + error.message });
  }
};

