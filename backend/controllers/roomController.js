import ExamRoom from '../models/ExamRoom.js';
import Quiz from '../models/Quiz.js';
import ExamAttempt from '../models/ExamAttempt.js';
import xlsx from 'xlsx';
import { Packer } from 'docx';
import { generateResultsDOCX } from '../utils/documentTemplates.js';
import { examSubmitQueue } from '../utils/queue.js';

// 1. CREATE EXAM ROOM
export const createRoom = async (req, res) => {
  try {
    const { quizId, showResultImmediately, antiCheatEnabled } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi được chọn' });
    }

    // Generate unique 6-character room code
    let roomCode;
    let codeExists = true;
    while (codeExists) {
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await ExamRoom.findOne({ roomCode });
      if (!existing) codeExists = false;
    }

    const room = await ExamRoom.create({
      roomCode,
      hostId: req.user.id,
      quizId,
      status: 'waiting',
      settings: {
        showResultImmediately: showResultImmediately !== undefined ? showResultImmediately : true,
        antiCheatEnabled: antiCheatEnabled !== undefined ? antiCheatEnabled : true
      },
      participants: []
    });

    res.status(201).json({
      message: 'Tạo phòng thi thành công',
      room
    });
  } catch (error) {
    console.error('Lỗi tạo phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo phòng thi' });
  }
};

// 2. GET ROOM BY CODE
export const getRoomByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await ExamRoom.findOne({ roomCode: code.toUpperCase() })
      .populate('quizId', 'title duration passingScorePercent questions.questionType questions.questionText questions.options')
      .populate('hostId', 'fullName rank position unit');

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi với mã đã nhập' });
    }

    // Check if there is a pending invitation for this user for this room, if so, auto-accept it
    const Invitation = (await import('../models/Invitation.js')).default;
    const pendingInv = await Invitation.findOne({
      roomId: room._id,
      recipientId: req.user.id,
      status: 'pending'
    });
    
    if (pendingInv) {
      pendingInv.status = 'accepted';
      await pendingInv.save();
      
      // If examinee, add to participants if not already there
      if (pendingInv.role === 'examinee') {
        const isAlreadyParticipant = room.participants.some(p => p.userId.toString() === req.user.id);
        if (!isAlreadyParticipant) {
          room.participants.push({ userId: req.user.id, status: 'waiting' });
          await room.save();
        }
      }
    }

    // Check if user is host or has examiner role in this room
    let userRoomRole = 'examinee';
    if (room.hostId._id.toString() === req.user.id) {
      userRoomRole = 'host';
    } else {
      const inv = await Invitation.findOne({
        roomId: room._id,
        recipientId: req.user.id,
        status: 'accepted'
      });
      if (inv && inv.role === 'examiner') {
        userRoomRole = 'examiner';
      }
    }

    const roomObj = room.toObject();
    roomObj.userRoomRole = userRoomRole;

    res.status(200).json(roomObj);
  } catch (error) {
    console.error('Lỗi tìm phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tìm phòng thi' });
  }
};

// 3. START/OPEN EXAM ROOM (Host triggers)
export const startRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await ExamRoom.findById(id);

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi' });
    }

    if (room.hostId.toString() !== req.user.id && req.user.role !== 'master-admin') {
      return res.status(403).json({ message: 'Đồng chí không phải chủ phòng, không thể mở phòng thi' });
    }

    room.status = 'active';
    room.startTime = new Date();
    await room.save();

    res.status(200).json({ message: 'Đã mở đề thi, cuộc thi bắt đầu!', room });
  } catch (error) {
    console.error('Lỗi mở phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi bắt đầu phòng thi' });
  }
};

// 4. END/CLOSE EXAM ROOM (Host triggers or timer expires)
export const endRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await ExamRoom.findById(id);

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi' });
    }

    if (room.hostId.toString() !== req.user.id && req.user.role !== 'master-admin') {
      return res.status(403).json({ message: 'Đồng chí không thể đóng phòng thi này' });
    }

    room.status = 'finished';
    await room.save();

    res.status(200).json({ message: 'Đã đóng phòng thi thành công', room });
  } catch (error) {
    console.error('Lỗi đóng phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đóng phòng thi' });
  }
};

// 5. GET ROOM RESULTS FOR ADMIN
export const getRoomResults = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await ExamRoom.findById(id).populate('quizId', 'title');
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi' });
    }

    // Sorting parameters
    const { sortBy = 'completedAt', order = 'desc' } = req.query;
    const sortOrder = order === 'asc' ? 1 : -1;

    // Get attempts associated with this room
    const attempts = await ExamAttempt.find({ roomId: id })
      .populate('userId', 'fullName rank position unit email')
      .sort({ [sortBy]: sortOrder });

    res.status(200).json({
      room,
      attempts
    });
  } catch (error) {
    console.error('Lỗi lấy kết quả phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy kết quả thi' });
  }
};

// 6. EXPORT ROOM RESULTS
export const exportRoomResults = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'xlsx', upperUnit, currentUnit, province, position, showSignature, signerRank, signerName, marginTop, marginBottom, marginLeft, marginRight, orientation } = req.query;

    const room = await ExamRoom.findById(id).populate('quizId', 'title');
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi' });
    }

    const attempts = await ExamAttempt.find({ roomId: id })
      .populate('userId', 'fullName rank position unit email');

    if (format === 'xlsx' || format === 'csv') {
      // Create spreadsheet
      const data = attempts.map(attempt => {
        const correctRatio = Math.round((attempt.score / attempt.totalQuestions) * 100);
        return {
          'Họ và tên': attempt.userId.fullName,
          'Gmail': attempt.userId.email,
          'Cấp bậc': attempt.userId.rank || 'Binh nhì',
          'Chức vụ': attempt.userId.position || 'Học viên',
          'Đơn vị': attempt.userId.unit,
          'Số câu đúng': `${attempt.score}/${attempt.totalQuestions}`,
          'Tỷ lệ (%)': correctRatio,
          'Kết quả': attempt.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT',
          'Xếp loại': attempt.rank,
          'Vi phạm chuyển tab': attempt.antiCheatViolations
        };
      });

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Ket_qua_thi');

      if (format === 'csv') {
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'csv' });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Ket_qua_phong_${room.roomCode}.csv`);
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
        return res.send(Buffer.concat([bom, buffer]));
      } else {
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Ket_qua_phong_${room.roomCode}.xlsx`);
        return res.send(buffer);
      }
    }

    if (format === 'docx') {
      const doc = generateResultsDOCX(
        room,
        attempts,
        req.user,
        upperUnit || 'BỘ QUỐC PHÒNG',
        currentUnit || req.user.unit || 'ĐƠN VỊ THI',
        province || 'Hà Nội',
        position,
        showSignature !== 'false',
        signerRank,
        signerName,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        orientation
      );

      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=Bao_cao_phong_${room.roomCode}.docx`);
      return res.send(buffer);
    }

    return res.status(400).json({ message: 'Định dạng xuất file không được hỗ trợ (chỉ chọn xlsx, csv hoặc docx)' });
  } catch (error) {
    console.error('Lỗi xuất kết quả phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xuất kết quả thi' });
  }
};

// 7. SUBMIT EXAM ANSWERS (User triggers - Queue-based)
export const submitExam = async (req, res) => {
  try {
    const { roomId, quizId, answers, mode, antiCheatViolations = 0 } = req.body;
    const userId = req.user.id;

    // Check if user has already submitted for this room (Only 1 attempt allowed in rooms)
    if (roomId) {
      const existingAttempt = await ExamAttempt.findOne({ userId, roomId });
      if (existingAttempt) {
        return res.status(400).json({ message: 'Đồng chí đã hoàn thành bài thi này và chỉ được phép thi 1 lần duy nhất' });
      }
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi tương ứng' });
    }

    // Queue the submission instead of synchronously calculating and saving to DB with auto-retry on temporary DB locks
    const job = await examSubmitQueue.add('submitAnswers', {
      userId,
      roomId,
      quizId,
      answers,
      mode,
      antiCheatViolations
    }, {
      attempts: 3, // Retry up to 3 times on database lock or transaction failures
      backoff: {
        type: 'exponential',
        delay: 1000 // Wait 1s, then 2s, 4s...
      }
    });

    res.status(202).json({
      message: 'Đã nhận bài thi. Tiến trình chấm điểm đang chạy...',
      jobId: job.id
    });
  } catch (error) {
    console.error('Lỗi nộp bài thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi nộp bài thi' });
  }
};

// 7.5. GET EXAM SUBMISSION STATUS BY JOB ID
export const getExamSubmitStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await examSubmitQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin nộp bài này' });
    }

    const state = await job.getState(); // 'completed' | 'failed' | 'active' | 'waiting'

    if (state === 'completed') {
      return res.status(200).json({
        status: 'completed',
        attempt: job.returnvalue
      });
    }

    if (state === 'failed') {
      return res.status(500).json({
        status: 'failed',
        message: job.failedReason || 'Tiến trình nộp bài thi bị lỗi. Vui lòng liên hệ giám thị.'
      });
    }

    res.status(200).json({
      status: state,
      message: 'Hệ thống đang chấm điểm bài thi của đồng chí...'
    });
  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái nộp bài:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra trạng thái nộp bài' });
  }
};

// 7.8. GET MY CREATED ROOMS (Host only)
export const getMyRooms = async (req, res) => {
  try {
    const rooms = await ExamRoom.find({ hostId: req.user.id })
      .populate('quizId', 'title duration')
      .sort({ createdAt: -1 });
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Lỗi lấy danh sách phòng thi của tôi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách phòng thi' });
  }
};
