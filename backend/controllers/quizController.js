import Quiz from '../models/Quiz.js';
import User from '../models/User.js';
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { Packer } from 'docx';
import { generateQuizDOCX } from '../utils/documentTemplates.js';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { quizGenQueue } from '../utils/queue.js';
import { convertDocToDocx } from '../utils/docConverter.js';

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];

const sanitizeQuizPayload = (category, questions) => {
  let finalCategory = category;
  if (category && !CATEGORIES.includes(category)) {
    finalCategory = 'Khác';
  }

  let sanitizedQuestions = questions;
  if (questions && Array.isArray(questions)) {
    sanitizedQuestions = questions.map(q => {
      let type = q.questionType;
      if (type === 'multiple_choice') type = 'multiple-choice';
      if (type === 'true_false') type = 'true-false';
      if (type === 'fill_in_the_blank') type = 'fill-in-the-blank';
      
      let answers = q.correctAnswers;
      if (!Array.isArray(answers)) {
        answers = answers !== undefined && answers !== null ? [String(answers)] : [];
      } else {
        answers = answers.map(String);
      }

      return {
        questionType: type,
        questionText: q.questionText || '',
        options: q.options || [],
        correctAnswers: answers,
        explanation: q.explanation || ''
      };
    });
  }

  return { finalCategory, sanitizedQuestions };
};

// 1. CREATE MANUAL QUIZ
export const createQuiz = async (req, res) => {
  try {
    const { title, description, category, duration, passingScorePercent, questions, isPublic, documentHash } = req.body;

    const { finalCategory, sanitizedQuestions } = sanitizeQuizPayload(category, questions);

    const quiz = await Quiz.create({
      title,
      description,
      category: finalCategory,
      creatorId: req.user.id,
      duration,
      passingScorePercent,
      questions: sanitizedQuestions,
      isPublic,
      documentHash: documentHash || null
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

    const quizzes = await Quiz.find(query).populate('creatorId', 'fullName rank unit').sort({ createdAt: -1 });
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

    const { finalCategory, sanitizedQuestions } = sanitizeQuizPayload(category, questions);

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (category) quiz.category = finalCategory;
    if (duration) quiz.duration = duration;
    if (passingScorePercent) quiz.passingScorePercent = passingScorePercent;
    if (questions) quiz.questions = sanitizedQuestions;
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
    const { upperUnit, currentUnit, province, position, showSignature, signerRank, signerName, marginTop, marginBottom, marginLeft, marginRight, orientation } = req.query;

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
      signerName,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      orientation
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
    let fileExtension = req.file.originalname.split('.').pop().toLowerCase();

    if (fileExtension === 'doc') {
      try {
        console.log('[importQuiz] Converting uploaded .doc file to .docx...');
        const docxBuffer = await convertDocToDocx(req.file.buffer);
        req.file.buffer = docxBuffer;
        req.file.originalname = req.file.originalname.substring(0, req.file.originalname.lastIndexOf('.')) + '.docx';
        fileExtension = 'docx';
        console.log('[importQuiz] Conversion successful!');
      } catch (convErr) {
        console.error('[importQuiz] Conversion failed:', convErr.message);
        return res.status(400).json({
          message: `Lỗi tự động chuyển đổi từ .doc sang .docx: ${convErr.message}. Vui lòng tự chuyển đổi bằng cách chọn "Lưu dưới dạng" (Save As) thành định dạng .docx rồi tải lại.`
        });
      }
    }

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
      return res.status(400).json({ message: 'Định dạng file không được hỗ trợ (.xlsx, .xls, .csv, .doc, .docx, .pdf)' });
    }

    if (questions.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy câu hỏi hợp lệ trong tài liệu' });
    }

    const { finalCategory, sanitizedQuestions } = sanitizeQuizPayload(category, questions);

    const quiz = await Quiz.create({
      title: title || `Đề thi import - ${req.file.originalname}`,
      category: finalCategory || 'Khác',
      creatorId: req.user.id,
      duration: duration || 45,
      passingScorePercent: passingScorePercent || 50,
      questions: sanitizedQuestions,
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

// Helper to run python script for markitdown conversion
const extractMarkdownUsingMarkItDown = (filePath) => {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonCmd, [
      path.join(process.cwd(), 'scripts/convert_to_md.py'),
      filePath
    ], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('error', (err) => {
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(error || `Python process exited with code ${code}`));
      } else {
        resolve(result);
      }
    });
  });
};


// 8. GENERATE QUIZ FROM FILE USING AI & MARKITDOWN
// Helper to parse a single uploaded tệp (PDF, DOCX, DOC, TXT)
const parseFileToText = async (file) => {
  let fileBuffer = file.buffer;
  let originalName = file.originalname;
  let fileExtension = originalName.split('.').pop().toLowerCase();

  // Nếu là file .doc cũ, chuyển đổi sang .docx trước bằng LibreOffice
  if (fileExtension === 'doc') {
    console.log(`[parseFileToText] Converting legacyl .doc file to .docx: ${originalName}`);
    fileBuffer = await convertDocToDocx(fileBuffer);
    fileExtension = 'docx';
  }

  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExtension}`);
  fs.writeFileSync(tempFilePath, fileBuffer);

  try {
    // 1. Chạy Python MarkItDown để trích xuất Markdown
    try {
      return await extractMarkdownUsingMarkItDown(tempFilePath);
    } catch (parseError) {
      console.warn(`[parseFileToText] MarkItDown thất bại cho ${originalName}, chuyển sang bộ phân tích dự phòng. Lỗi:`, parseError.message);
      
      // Bộ phân tích dự phòng local JS
      if (fileExtension === 'docx') {
        const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
        return docxResult.value;
      } else if (fileExtension === 'pdf') {
        const pdfResult = await pdfParse(fileBuffer);
        return pdfResult.text;
      } else if (fileExtension === 'txt' || fileExtension === 'md') {
        return fileBuffer.toString('utf-8');
      } else {
        throw new Error(`Định dạng đuôi file '.${fileExtension}' của tệp ${originalName} không được hỗ trợ bởi bộ phân tích dự phòng.`);
      }
    }
  } finally {
    // Dọn dẹp file tạm
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error(`[parseFileToText] Lỗi xóa file tạm: ${tempFilePath}`, err.message);
      }
    }
  }
};

// 8. GENERATE QUIZ FROM FILE USING AI & MARKITDOWN (Hỗ trợ nhiều file, giới hạn dung lượng)
export const generateQuizFromFile = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ít nhất một file tài liệu.' });
    }

    // 1. Giới hạn tổng dung lượng các file tải lên (Tối đa 10MB) để tránh quá tải
    const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
    if (totalSizeBytes > MAX_TOTAL_SIZE) {
      return res.status(400).json({
        message: `Tổng dung lượng các tệp tải lên vượt quá giới hạn cho phép (Tối đa 10MB). Tổng dung lượng hiện tại: ${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB.`
      });
    }

    // 2. Tính toán Hash kết hợp của tất cả các file để kiểm tra cache
    const fileHashes = files.map(file => {
      return crypto.createHash('sha256').update(file.buffer).digest('hex');
    });
    const combinedHash = crypto.createHash('sha256').update(fileHashes.sort().join('|')).digest('hex');

    // Kiểm tra DB xem đề thi đã từng được sinh từ các tài liệu này chưa
    const cachedQuiz = await Quiz.findOne({ documentHash: combinedHash });
    if (cachedQuiz) {
      return res.status(200).json({
        message: 'Tổ hợp tài liệu này đã được sinh đề thi trước đó. Hệ thống đã tự động lấy từ bộ nhớ đệm.',
        quiz: {
          title: cachedQuiz.title,
          description: cachedQuiz.description,
          category: cachedQuiz.category,
          duration: cachedQuiz.duration,
          questions: cachedQuiz.questions,
          documentHash: combinedHash
        }
      });
    }

    const { numQuestions, category } = req.body;
    const count = parseInt(numQuestions) || 10;

    // 3. Trích xuất chữ của tất cả các file
    let combinedMarkdownText = '';
    const fileListNames = files.map(f => f.originalname).join(', ');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await parseFileToText(file);
        if (text && text.trim().length > 0) {
          combinedMarkdownText += `\n\n--- BẮT ĐẦU TÀI LIỆU ${i + 1}: ${file.originalname} ---\n${text}\n--- KẾT THÚC TÀI LIỆU ${i + 1} ---\n`;
        }
      } catch (err) {
        console.error(`Lỗi phân tích file ${file.originalname}:`, err.message);
        return res.status(400).json({
          message: `Lỗi phân tích file "${file.originalname}": ${err.message}. Vui lòng kiểm tra lại tệp tin.`
        });
      }
    }

    if (!combinedMarkdownText || combinedMarkdownText.trim().length === 0) {
      return res.status(400).json({ message: 'Không thể trích xuất văn bản từ các tài liệu đã tải lên.' });
    }

    // 4. Giới hạn độ dài văn bản trích xuất (Tối đa 100,000 ký tự ~ 35-40 trang) để tối ưu chi phí và token
    const MAX_EXTRACTED_CHARACTERS = 100000;
    if (combinedMarkdownText.length > MAX_EXTRACTED_CHARACTERS) {
      return res.status(400).json({
        message: `Tổng nội dung chữ trích xuất từ các tài liệu quá lớn (${combinedMarkdownText.length.toLocaleString()} ký tự). Vui lòng rút gọn tài liệu lại dưới ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} ký tự để tránh vượt ngưỡng Token và phí API Google Cloud.`
      });
    }

    // --- PHẦN SINH ĐỀ AI TRỰC TIẾP (KHÔNG DÙNG HÀNG ĐỢI REDIS KHI DEPLOY FIREBASE) ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Hệ thống chưa được cấu hình API Key của Gemini.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      Bạn là một trợ lý giảng dạy quân sự chuyên nghiệp tại Học viện Kỹ thuật Quân sự.
      Hãy đọc các tài liệu định dạng dưới đây và tạo ra một đề thi trắc nghiệm gồm chính xác ${count} câu hỏi chất lượng cao dựa trên nội dung tài liệu.
      Bạn cần tổng hợp kiến thức từ tất cả các tài liệu được cung cấp ở trên một cách hài hòa, phù hợp.
      Mức độ từ dễ đến khó nên được phân bổ đều, đảm bảo có sự đa dạng về chủ đề và nội dung câu hỏi dựa trên các tài liệu đã cho.

      Nội dung các tài liệu:
      ${combinedMarkdownText}

      Yêu cầu đầu ra bắt buộc phải tuân thủ schema JSON định dạng sau (không viết bất cứ văn bản dẫn giải nào ngoài JSON này):
      {
        "title": "Tiêu đề đề thi sinh ra tự động",
        "description": "Mô tả ngắn gọn về đề thi",
        "duration": ${count * 2},
        "category": "${category || 'Khác'}",
        "questions": [
          {
            "questionType": "multiple-choice",
            "questionText": "Nội dung câu hỏi trắc nghiệm?",
            "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
            "correctAnswers": ["2"],
            "explanation": "Giải thích chi tiết vì sao đáp án này đúng dựa trên tài liệu"
          }
        ]
      }

      Lưu ý quan trọng:
      - Trường "correctAnswers" phải là một mảng chứa 1 chuỗi số, đại diện cho chỉ mục của đáp án đúng trong mảng options (ví dụ: ["0"] cho đáp án A, ["1"] cho đáp án B, ["2"] cho đáp án C, ["3"] cho đáp án D...).
      - PHẢI PHÂN BỐ NGẪU NHIÊN VÀ ĐỀU VỊ TRÍ ĐÁP ÁN ĐÚNG giữa các lựa chọn A, B, C, D (chỉ mục "0", "1", "2", "3"). Tuyệt đối không được luôn luôn đặt đáp án đúng ở vị trí đầu tiên (đáp án A / chỉ mục "0"). Hãy xáo trộn ngẫu nhiên và bám sát chính xác nội dung thực tế của tài liệu.
      - Đảm bảo các câu hỏi có tính thực tế, rõ ràng và bám sát chính xác tài liệu đã cho.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let quizData = JSON.parse(responseText);

    const quiz = {
      title: quizData.title || `Đề thi AI - ${files[0].originalname} + ${files.length - 1} tài liệu khác`,
      description: quizData.description || `Đề thi được sinh tự động bằng AI từ danh sách tài liệu: ${fileListNames}`,
      category: category || 'Khác',
      duration: quizData.duration || count * 2,
      questions: quizData.questions,
      documentHash: combinedHash
    };

    res.status(200).json({
      message: 'Sinh đề thi thành công bằng AI!',
      quiz
    });

  } catch (error) {
    console.error('Lỗi tổng quát sinh đề thi AI:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi sinh câu hỏi từ tài liệu bằng AI: ' + error.message });
  }
};

// 8.5. GET AI QUIZ GENERATION STATUS BY JOB ID
export const getQuizGenStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    /*
    const job = await quizGenQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy tiến trình sinh đề thi này' });
    }

    const state = await job.getState(); // 'completed' | 'failed' | 'active' | 'waiting'
    
    if (state === 'completed') {
      return res.status(200).json({
        status: 'completed',
        quiz: job.returnvalue
      });
    }

    if (state === 'failed') {
      return res.status(500).json({
        status: 'failed',
        message: job.failedReason || 'Tiến trình sinh đề thi thất bại. Vui lòng thử lại.'
      });
    }

    // Otherwise, it is still running or waiting
    res.status(200).json({
      status: state, // 'active' or 'waiting'
      message: state === 'active' ? 'AI đang thiết lập cấu trúc câu hỏi...' : 'Yêu cầu đang nằm trong hàng đợi...'
    });
    */

    res.status(501).json({ message: 'Hàng đợi Redis đã tắt do hệ thống chuyển sang chế độ Firebase Cloud Functions.' });
  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái sinh đề AI:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra trạng thái' });
  }
};
