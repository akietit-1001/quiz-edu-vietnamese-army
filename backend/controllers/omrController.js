import os from 'os';
import ExamAttempt from '../models/ExamAttempt.js';
import ExamRoom from '../models/ExamRoom.js';
import Quiz from '../models/Quiz.js';
import User from '../models/User.js';

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
 */
export const getOmrSession = async (req, res) => {
  try {
    const { sessionCode } = req.params;
    const cleanCode = String(sessionCode || '').trim().toUpperCase();

    // Tìm phòng thi theo roomCode trước
    let room = await ExamRoom.findOne({ roomCode: cleanCode })
      .populate('quizId')
      .populate('participants.userId', 'fullName rank position unitId username');

    let quiz = null;
    if (room && room.quizId) {
      quiz = room.quizId;
    } else {
      // Nếu sessionCode là Quiz ID
      quiz = await Quiz.findById(cleanCode);
    }

    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin đề thi hoặc phòng thi tương ứng.' });
    }

    // Lấy danh sách các bài đã chấm trong phiên này
    const query = room ? { roomId: room._id } : { quizId: quiz._id, mode: 'omr_scan' };
    const existingAttempts = await ExamAttempt.find(query)
      .populate('userId', 'fullName rank position username')
      .populate('examinerId', 'fullName')
      .sort({ completedAt: -1 });

    res.json({
      success: true,
      sessionCode: cleanCode,
      serverIps: getLocalNetworkIps(),
      room: room ? {
        _id: room._id,
        roomCode: room.roomCode,
        status: room.status,
        participants: room.participants
      } : null,
      quiz: {
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
      },
      existingAttempts
    });
  } catch (error) {
    console.error('Lỗi lấy thông tin phiên OMR:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tải phiên chấm OMR' });
  }
};

/**
 * 2. Gửi và chấm điểm bài thi OMR (từ Điện thoại hoặc Desktop)
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

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Đề thi không tồn tại' });
    }

    // 1. Tìm hoặc gán thí sinh (User)
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
      });
    }

    // Nếu không tìm thấy, fallback gán cho chính tài khoản đang chấm (Examiner) kèm candidateInfo
    const examinerId = req.user ? req.user.id : null;
    const assignedUserId = matchedUser ? matchedUser._id : (examinerId || null);
    const candidateInfo = {
      sbd: cleanSbd,
      fullName: matchedUser ? matchedUser.fullName : (candidateFullName || `Thí sinh SBD ${cleanSbd || 'Chưa rõ'}`),
      unitName: matchedUser ? (matchedUser.unitId?.name || '') : (candidateUnit || ''),
      rank: matchedUser ? matchedUser.rank : 'Chiến sĩ'
    };

    // 2. Chấm điểm bài thi
    let correctCount = 0;
    const totalQ = quiz.questions.length;
    const formattedAnswers = [];

    quiz.questions.forEach((q, idx) => {
      const qIndex = idx + 1;
      const detected = Array.isArray(detectedAnswers)
        ? detectedAnswers.find(a => a.questionIndex === qIndex)
        : null;

      const chosenOption = detected ? detected.selectedOption : null;
      const selectedAnswers = chosenOption ? [chosenOption] : [];

      // So khớp đáp án:
      // Đáp án trong hệ thống có thể lưu là '0', '1', '2', '3' (index) hoặc 'A', 'B', 'C', 'D' hoặc text
      let isCorrect = false;
      if (chosenOption && q.correctAnswers && q.correctAnswers.length > 0) {
        const correctSet = q.correctAnswers.map(ans => String(ans).trim().toUpperCase());
        const letterToIndex = { 'A': '0', 'B': '1', 'C': '2', 'D': '3' };
        const chosenIndex = letterToIndex[chosenOption.toUpperCase()];

        if (
          correctSet.includes(chosenOption.toUpperCase()) ||
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

    // 3. Tạo bản ghi ExamAttempt
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

    // 4. Nếu có roomId, cập nhật trạng thái trong ExamRoom
    if (roomId) {
      const room = await ExamRoom.findById(roomId);
      if (room) {
        const pIndex = room.participants.findIndex(p => p.userId.toString() === assignedUserId.toString());
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
      .populate('examinerId', 'fullName');

    // 5. Bắn thông báo Realtime qua Socket.io về Màn hình Máy tính
    const io = req.app?.get('socketio');
    if (io) {
      const channel = sessionCode ? `omr_${sessionCode.toUpperCase()}` : (roomId ? `omr_${roomId}` : null);
      if (channel) {
        io.to(channel).emit('omrNewScan', populatedAttempt);
      }
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
