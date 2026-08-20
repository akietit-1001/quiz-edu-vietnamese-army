// Kiểm tra cấu trúc kết quả JSON do Gemini trả về trước khi lưu, tránh lưu
// dữ liệu hỏng (thiếu đáp án, chỉ mục đáp án đúng nằm ngoài phạm vi, v.v.)
export const validateSingleQuestion = (q) => {
  if (!q || typeof q !== 'object') return 'Dữ liệu câu hỏi không phải JSON hợp lệ.';
  if (!q.questionText || typeof q.questionText !== 'string') return 'Thiếu nội dung câu hỏi.';
  if (!q.questionType) return 'Thiếu loại câu hỏi (questionType).';

  if (q.questionType === 'fill-in-the-blank') {
    if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
      return 'Thiếu đáp án đúng cho câu điền khuyết.';
    }
    return null;
  }

  if (!Array.isArray(q.options) || q.options.length === 0) return 'Thiếu danh sách đáp án (options).';
  if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) return 'Thiếu đáp án đúng (correctAnswers).';

  const hasInvalidIndex = q.correctAnswers.some((ans) => {
    const idx = parseInt(ans, 10);
    return isNaN(idx) || idx < 0 || idx >= q.options.length;
  });
  if (hasInvalidIndex) return 'Chỉ mục đáp án đúng không hợp lệ (nằm ngoài phạm vi options).';

  return null;
};

export const validateQuizStructure = (quizData) => {
  if (!quizData || typeof quizData !== 'object') return 'Dữ liệu AI trả về không phải là một đối tượng JSON hợp lệ.';
  if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) return 'AI không trả về danh sách câu hỏi.';

  for (let i = 0; i < quizData.questions.length; i++) {
    const err = validateSingleQuestion(quizData.questions[i]);
    if (err) return `Câu hỏi thứ ${i + 1}: ${err}`;
  }
  return null;
};

/**
 * Gọi Gemini, parse JSON, validate cấu trúc; tự động thử lại (kèm lời nhắc
 * sửa lỗi) nếu JSON hỏng hoặc thiếu trường bắt buộc. Ném lỗi rõ ràng bằng
 * tiếng Việt nếu vẫn thất bại sau khi hết lượt thử lại.
 *
 * @param {*} model - Gemini GenerativeModel instance
 * @param {(attempt: number, lastError: string|null) => string} promptBuilder
 * @param {(data: any) => string|null} validate - trả về null nếu hợp lệ
 * @param {number} maxRetries
 * @param {(usageMetadata: any, attempt: number) => void} [onUsage] - gọi lại
 *   sau MỖI lần gọi Gemini (kể cả lần thất bại/thử lại) với usageMetadata
 *   thật từ SDK, để bên gọi ghi log chi phí AI chính xác.
 */
export const generateJSONWithRetry = async (model, promptBuilder, validate, maxRetries = 1, onUsage) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = promptBuilder(attempt, lastError);
      const result = await model.generateContent(prompt);
      if (onUsage && result.response?.usageMetadata) {
        onUsage(result.response.usageMetadata, attempt);
      }
      const responseText = result.response.text();
      const data = JSON.parse(responseText);

      const validationError = validate(data);
      if (!validationError) return data;
      lastError = validationError;
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`AI trả về không đúng định dạng sau ${maxRetries + 1} lần thử (${lastError}). Vui lòng thử lại.`);
};
