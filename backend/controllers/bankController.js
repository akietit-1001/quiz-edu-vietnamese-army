import QuestionBank from '../models/QuestionBank.js';
import Quiz from '../models/Quiz.js';

// 1. ADD QUESTION TO BANK
export const createBankQuestion = async (req, res) => {
  try {
    const { questionType, questionText, options, correctAnswers, explanation, category, difficulty } = req.body;

    const question = await QuestionBank.create({
      questionType,
      questionText,
      options,
      correctAnswers,
      explanation,
      category,
      difficulty,
      creatorId: req.user.id
    });

    res.status(201).json({
      message: 'Đã lưu câu hỏi vào ngân hàng câu hỏi thành công',
      question
    });
  } catch (error) {
    console.error('Lỗi lưu câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lưu câu hỏi vào ngân hàng' });
  }
};

// 2. GET ALL BANK QUESTIONS (With filters)
export const getBankQuestions = async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    let query = {};

    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.questionText = { $regex: search, $options: 'i' };
    }

    const questions = await QuestionBank.find(query).populate('creatorId', 'fullName rank unit');
    res.status(200).json(questions);
  } catch (error) {
    console.error('Lỗi lấy câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách câu hỏi ngân hàng' });
  }
};

// 3. UPDATE BANK QUESTION
export const updateBankQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionType, questionText, options, correctAnswers, explanation, category, difficulty } = req.body;
    
    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    // Auth check (creator, admin or master-admin)
    if (question.creatorId.toString() !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({ message: 'Đồng chí không có quyền sửa câu hỏi này' });
    }

    if (questionType) question.questionType = questionType;
    if (questionText) question.questionText = questionText;
    if (options) question.options = options;
    if (correctAnswers) question.correctAnswers = correctAnswers;
    if (explanation !== undefined) question.explanation = explanation;
    if (category) question.category = category;
    if (difficulty) question.difficulty = difficulty;

    await question.save();

    res.status(200).json({
      message: 'Cập nhật câu hỏi thành công',
      question
    });
  } catch (error) {
    console.error('Lỗi sửa câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi sửa câu hỏi ngân hàng' });
  }
};

// 4. DELETE BANK QUESTION
export const deleteBankQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    if (question.creatorId.toString() !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({ message: 'Đồng chí không có quyền xóa câu hỏi này' });
    }

    await QuestionBank.findByIdAndDelete(id);
    res.status(200).json({ message: 'Đã xóa câu hỏi khỏi ngân hàng thành công' });
  } catch (error) {
    console.error('Lỗi xóa câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa câu hỏi ngân hàng' });
  }
};

// 5. AUTO-GENERATE QUIZ FROM CRITERIA (Ngẫu nhiên câu hỏi)
export const autoGenerateQuiz = async (req, res) => {
  try {
    const { title, description, duration, passingScorePercent, isPublic, rules } = req.body;
    // rules should be array of: { category: string, difficulty: string, count: number }

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tiêu chí rút ngẫu nhiên câu hỏi' });
    }

    let allSelectedQuestions = [];

    // Process each criteria rule
    for (const rule of rules) {
      const count = parseInt(rule.count) || 0;
      if (count <= 0) continue;

      // Use aggregation pipeline to get random samples
      const samples = await QuestionBank.aggregate([
        { $match: { category: rule.category, difficulty: rule.difficulty } },
        { $sample: { size: count } }
      ]);

      if (samples.length < count) {
        console.warn(`Không đủ câu hỏi: Yêu cầu ${count} câu chuyên ngành "${rule.category}" độ khó "${rule.difficulty}", nhưng chỉ tìm thấy ${samples.length} câu.`);
      }

      allSelectedQuestions = [...allSelectedQuestions, ...samples];
    }

    if (allSelectedQuestions.length === 0) {
      return res.status(400).json({ 
        message: 'Không tìm thấy bất kỳ câu hỏi nào khớp với các tiêu chí của đồng chí trong ngân hàng.' 
      });
    }

    // Convert aggregated raw questions to Quiz question schema format
    const formattedQuestions = allSelectedQuestions.map(q => ({
      questionType: q.questionType,
      questionText: q.questionText,
      options: q.options,
      correctAnswers: q.correctAnswers,
      explanation: q.explanation
    }));

    // Create a new Quiz
    const generatedQuiz = await Quiz.create({
      title: title || `Đề thi ngẫu nhiên tự động - ${new Date().toLocaleDateString('vi-VN')}`,
      description: description || 'Được sinh tự động từ ngân hàng câu hỏi tập trung.',
      creatorId: req.user.id,
      duration: duration || 45,
      passingScorePercent: passingScorePercent || 50,
      isPublic: isPublic !== undefined ? isPublic : false,
      questions: formattedQuestions
    });

    res.status(201).json({
      message: `Đã tự động rút ngẫu nhiên thành công ${formattedQuestions.length} câu hỏi phục vụ đề thi`,
      quiz: generatedQuiz
    });
  } catch (error) {
    console.error('Lỗi tự động sinh đề thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi tự động sinh đề thi' });
  }
};
