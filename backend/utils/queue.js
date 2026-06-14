import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import Quiz from '../models/Quiz.js';
import ExamAttempt from '../models/ExamAttempt.js';
import ExamRoom from '../models/ExamRoom.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ workers
});

connection.on('connect', () => {
  console.log('=== [Redis] Kết nối thành công tới Redis Server ===');
});
connection.on('error', (err) => {
  console.error('=== [Redis] Lỗi kết nối Redis:', err.message, '===');
});

// Define Queues
export const quizGenQueue = new Queue('quizGen', { connection });
export const examSubmitQueue = new Queue('examSubmit', { connection });

export const quizGenWorker = new Worker('quizGen', async (job) => {
  const { markdownText, count, category, fileHash } = job.data;
  
  /* COMMENTED OUT GEMINI CONFIG
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Hệ thống chưa được cấu hình API Key của Gemini.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' }
  });
  */

  const prompt = `
    Bạn là một trợ lý giảng dạy quân sự chuyên nghiệp tại Học viện Kỹ thuật Quân sự.
    Hãy đọc tài liệu định dạng Markdown dưới đây và tạo ra một đề thi trắc nghiệm gồm chính xác ${count} câu hỏi chất lượng cao dựa trên nội dung tài liệu.

    Nội dung tài liệu:
    ${markdownText}

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
          "correctAnswers": ["0"],
          "explanation": "Giải thích chi tiết vì sao đáp án này đúng dựa trên tài liệu"
        }
      ]
    }

    Lưu ý quan trọng:
    - Trường "correctAnswers" phải là một mảng chứa 1 chuỗi số, đại diện cho chỉ mục của đáp án đúng trong mảng options (ví dụ: ["0"] cho đáp án đầu tiên, ["1"] cho đáp án thứ hai...).
    - Đảm bảo các câu hỏi có tính thực tế, rõ ràng và bám sát chính xác tài liệu đã cho.
  `;

  /* COMMENTED OUT GEMINI EXECUTION
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let quizData = JSON.parse(responseText);
  */

  // OPENROUTER INTEGRATION
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) {
    throw new Error('Hệ thống chưa được cấu hình API Key của OpenRouter (OPENROUTER_API_KEY).');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5000',
      'X-Title': 'Quiz-Edu'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash:free',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_object'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error: ${response.statusText}. Details: ${JSON.stringify(errorData)}`);
  }

  const responseData = await response.json();
  const content = responseData.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Không nhận được phản hồi nội dung từ OpenRouter.');
  }

  let quizData = JSON.parse(content);

  return {
    ...quizData,
    documentHash: fileHash
  };
}, { connection });

// 2. Exam Submission Worker
export const examSubmitWorker = new Worker('examSubmit', async (job) => {
  const { userId, roomId, quizId, answers, mode, antiCheatViolations } = job.data;

  // Check if user has already submitted for this room (Only 1 attempt allowed in rooms)
  if (roomId) {
    const existingAttempt = await ExamAttempt.findOne({ userId, roomId });
    if (existingAttempt) {
      throw new Error('Đồng chí đã hoàn thành bài thi này và chỉ được phép thi 1 lần duy nhất');
    }
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new Error('Không tìm thấy đề thi tương ứng');
  }

  // Evaluate answers
  let correctCount = 0;
  const evaluatedAnswers = answers.map(ans => {
    const question = quiz.questions[ans.questionIndex];
    if (!question) return ans;

    // Sort and trim arrays to compare
    const userAnswers = (ans.selectedAnswers || []).map(a => a.trim().toLowerCase()).sort();
    const actualAnswers = (question.correctAnswers || []).map(a => a.trim().toLowerCase()).sort();

    const isCorrect = userAnswers.length === actualAnswers.length && 
                      userAnswers.every((val, index) => val === actualAnswers[index]);

    if (isCorrect) correctCount++;

    return ans;
  });

  const totalQuestions = quiz.questions.length;
  const scorePercent = (correctCount / totalQuestions) * 100;
  const isPassed = scorePercent >= quiz.passingScorePercent;

  // Determine Rank
  let rank = 'Yếu';
  if (isPassed) {
    if (scorePercent >= 90) rank = 'Xuất sắc';
    else if (scorePercent >= 80) rank = 'Giỏi';
    else if (scorePercent >= 65) rank = 'Khá';
    else rank = 'Trung bình';
  }

  const attempt = await ExamAttempt.create({
    userId,
    roomId: roomId || null,
    quizId,
    mode: mode || 'exam',
    answers: evaluatedAnswers,
    score: correctCount,
    totalQuestions,
    isPassed,
    rank,
    antiCheatViolations: antiCheatViolations || 0
  });

  // Update participant status in the room if applicable
  if (roomId) {
    await ExamRoom.updateOne(
      { _id: roomId, 'participants.userId': userId },
      { 
        $set: { 
          'participants.$.status': 'finished',
          'participants.$.attemptId': attempt._id 
        } 
      }
    );
  }

  return attempt;
}, { connection });

// Log workers status
quizGenWorker.on('completed', (job) => {
  console.log(`[BullMQ] AI Quiz Generation Job ${job.id} completed.`);
});
quizGenWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] AI Quiz Generation Job ${job?.id} failed:`, err.message);
});

examSubmitWorker.on('completed', (job) => {
  console.log(`[BullMQ] Exam Submission Job ${job.id} completed.`);
});
examSubmitWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] Exam Submission Job ${job?.id} failed:`, err.message);
});
