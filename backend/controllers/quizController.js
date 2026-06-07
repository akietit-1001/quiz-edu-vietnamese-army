import Quiz from '../models/Quiz.js';
import User from '../models/User.js';
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Packer } from 'docx';
import { generateQuizDOCX } from '../utils/documentTemplates.js';

// 1. CREATE MANUAL QUIZ
export const createQuiz = async (req, res) => {
  try {
    const { title, description, category, duration, passingScorePercent, questions, isPublic } = req.body;

    const quiz = await Quiz.create({
      title,
      description,
      category,
      creatorId: req.user.id,
      duration,
      passingScorePercent,
      questions,
      isPublic
    });

    res.status(201).json({
      message: 'Đăng đề thi mới thành công',
      quiz
    });
  } catch (error) {
    console.error('Lỗi tạo đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo đề thi' });
  }
};

// 2. GET ALL QUIZZES (Filter based on role)
export const getQuizzes = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};
    if (userRole === 'user' || userRole === 'sub-admin') {
      // Users and sub-admins can see public quizzes OR quizzes they created
      query = {
        $or: [
          { isPublic: true },
          { creatorId: userId }
        ]
      };
    }
    // master-admin and admin can see all quizzes in the database

    const quizzes = await Quiz.find(query).populate('creatorId', 'fullName rank unit');
    res.status(200).json(quizzes);
  } catch (error) {
    console.error('Lỗi lấy danh sách đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách đề thi' });
  }
};

// 3. GET SINGLE QUIZ BY ID OR SHARE CODE
export const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try finding by ID first, then fallback to shareCode
    let quiz;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      quiz = await Quiz.findById(id);
    } else {
      quiz = await Quiz.findOne({ shareCode: id.toUpperCase() });
    }

    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi yêu cầu' });
    }

    res.status(200).json(quiz);
  } catch (error) {
    console.error('Lỗi lấy thông tin đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tìm kiếm đề thi' });
  }
};

// 4. UPDATE QUIZ
export const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, duration, passingScorePercent, questions, isPublic } = req.body;
    const currentUser = req.user;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi cần chỉnh sửa' });
    }

    // Permission: Only creator, admin or master-admin can edit
    if (quiz.creatorId.toString() !== currentUser.id && currentUser.role === 'user') {
      return res.status(403).json({ message: 'Đồng chí không có quyền sửa đổi đề thi này' });
    }

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (category) quiz.category = category;
    if (duration) quiz.duration = duration;
    if (passingScorePercent) quiz.passingScorePercent = passingScorePercent;
    if (questions) quiz.questions = questions;
    if (isPublic !== undefined) quiz.isPublic = isPublic;

    await quiz.save();

    res.status(200).json({
      message: 'Cập nhật đề thi thành công',
      quiz
    });
  } catch (error) {
    console.error('Lỗi cập nhật đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật đề thi' });
  }
};

// 5. DELETE QUIZ
export const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi cần xóa' });
    }

    // Permission: creator or master-admin or admin
    if (quiz.creatorId.toString() !== currentUser.id && currentUser.role === 'user') {
      return res.status(403).json({ message: 'Đồng chí không có quyền xóa đề thi này' });
    }

    await Quiz.findByIdAndDelete(id);
    res.status(200).json({ message: 'Đã xóa đề thi khỏi hệ thống thành công' });
  } catch (error) {
    console.error('Lỗi xóa đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa đề thi' });
  }
};

// 6. EXPORT QUIZ TO DOCX (WORD)
export const exportQuizDocx = async (req, res) => {
  try {
    const { id } = req.params;
    const { upperUnit, currentUnit, province, position, showSignature, signerRank, signerName } = req.query;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: 'Không tìm thấy đề thi để xuất' });
    }

    const doc = generateQuizDOCX(
      quiz,
      req.user,
      upperUnit || 'BỘ QUỐC PHÒNG',
      currentUnit || req.user.unit || 'ĐƠN VỊ THI',
      province || 'Hà Nội',
      position,
      showSignature !== 'false',
      signerRank,
      signerName
    );

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=De_thi_${quiz.shareCode}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error('Lỗi xuất đề thi ra Word:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xuất đề thi ra file Word' });
  }
};

// Helper to parse question text files (Word, PDF) using regex
const parseQuestionsFromText = (text) => {
  const questions = [];
  // Split text by lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect question: "Câu 1: ..." or "Câu 12. ..."
    const qMatch = line.match(/^Câu\s+(\d+)[:\.]\s*(.*)/i);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        questionType: 'multiple-choice', // default
        questionText: qMatch[2],
        options: [],
        correctAnswers: [],
        explanation: ''
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Detect option: "A. ..." or "B. ..."
    const optMatch = line.match(/^([A-D])[:\.]\s*(.*)/i);
    if (optMatch) {
      currentQuestion.options.push(optMatch[2]);
      continue;
    }

    // Detect answer: "Đáp án: A" or "Đáp án: Đúng"
    const ansMatch = line.match(/^Đáp\s+án[:\s]\s*(.*)/i);
    if (ansMatch) {
      const ansText = ansMatch[1].trim().toUpperCase();
      // If true-false
      if (ansText === 'ĐÚNG' || ansText === 'SAI' || ansText === 'TRUE' || ansText === 'FALSE') {
        currentQuestion.questionType = 'true-false';
        currentQuestion.options = ['Đúng', 'Sai'];
        currentQuestion.correctAnswers = [ansText === 'ĐÚNG' || ansText === 'TRUE' ? '0' : '1'];
      } else {
        // Option index A=0, B=1, C=2, D=3
        const code = ansText.charCodeAt(0) - 65; // A is 65
        if (code >= 0 && code < 4) {
          currentQuestion.correctAnswers = [code.toString()];
        } else {
          // Fill in the blank
          currentQuestion.questionType = 'fill-in-the-blank';
          currentQuestion.correctAnswers = [ansText];
        }
      }
      continue;
    }

    // Detect explanation: "Giải thích: ..."
    const expMatch = line.match(/^Giải\s+thích[:\s]\s*(.*)/i);
    if (expMatch) {
      currentQuestion.explanation = expMatch[1];
      continue;
    }

    // Append text if it is multiline question text
    if (!line.match(/^[A-D][:\.]/i) && !line.match(/^Đáp\s+án/i) && !line.match(/^Giải\s+thích/i)) {
      currentQuestion.questionText += '\n' + line;
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
};

// 7. IMPORT QUIZ FROM FILE (Excel, CSV, Word, PDF)
export const importQuiz = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng cung cấp file import' });
    }

    const { title, category, duration, passingScorePercent } = req.body;
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    let questions = [];

    if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'csv') {
      // Parse Excel/CSV
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);

      rows.forEach(row => {
        // Expected columns: QuestionText, Type, OptionA, OptionB, OptionC, OptionD, Answer, Explanation
        const type = row.Type || 'multiple-choice';
        const qText = row.QuestionText;
        const explanation = row.Explanation || '';
        
        let options = [];
        let correctAnswers = [];

        if (type === 'multiple-choice') {
          options = [row.OptionA, row.OptionB, row.OptionC, row.OptionD].filter(Boolean);
          // Answer index A->0, B->1 etc
          const ansIndex = (row.Answer || '').toUpperCase().charCodeAt(0) - 65;
          correctAnswers = [ansIndex.toString()];
        } else if (type === 'true-false') {
          options = ['Đúng', 'Sai'];
          const val = (row.Answer || '').toUpperCase();
          correctAnswers = [val === 'ĐÚNG' || val === 'TRUE' ? '0' : '1'];
        } else {
          correctAnswers = [row.Answer || ''];
        }

        questions.push({
          questionType: type,
          questionText: qText,
          options,
          correctAnswers,
          explanation
        });
      });

    } else if (fileExtension === 'docx') {
      // Parse Word
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      questions = parseQuestionsFromText(result.value);

    } else if (fileExtension === 'pdf') {
      // Parse PDF
      const data = await pdfParse(req.file.buffer);
      questions = parseQuestionsFromText(data.text);

    } else {
      return res.status(400).json({ message: 'Định dạng file không được hỗ trợ (.xlsx, .csv, .docx, .pdf)' });
    }

    if (questions.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy câu hỏi hợp lệ trong tài liệu' });
    }

    const quiz = await Quiz.create({
      title: title || `Đề thi import - ${req.file.originalname}`,
      category: category || 'Khác',
      creatorId: req.user.id,
      duration: duration || 45,
      passingScorePercent: passingScorePercent || 50,
      questions,
      isPublic: false
    });

    res.status(201).json({
      message: `Đã import thành công đề thi có ${questions.length} câu hỏi`,
      quiz
    });
  } catch (error) {
    console.error('Lỗi import đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi import đề thi từ file' });
  }
};
