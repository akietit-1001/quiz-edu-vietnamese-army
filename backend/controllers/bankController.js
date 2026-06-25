import QuestionBank from '../models/QuestionBank.js';
import Quiz from '../models/Quiz.js';
import User from '../models/User.js';

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

// 2. GET ALL BANK QUESTIONS (With filters & role/unit permission filtering & server pagination/sorting)
export const getBankQuestions = async (req, res) => {
  try {
    const { category, difficulty, questionType, search, page, limit, sortField = 'createdAt', sortOrder = 'desc' } = req.query;
    const currentUser = req.user;
    let query = {};

    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (questionType) query.questionType = questionType;
    if (search) {
      // Find users matching search name
      const matchingUsers = await User.find({ fullName: { $regex: search, $options: 'i' } }).select('_id');
      const matchingUserIds = matchingUsers.map(u => u._id);

      query.$or = [
        { questionText: { $regex: search, $options: 'i' } },
        { creatorId: { $in: matchingUserIds } }
      ];
    }

    // Role & Unit permission checks
    if (currentUser.role !== 'master-admin') {
      const escapedUnit = (currentUser.unit || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      let userQuery = {};

      if (currentUser.role === 'admin') {
        userQuery = {
          $or: [
            { role: 'master-admin' },
            { _id: currentUser._id },
            { unit: { $regex: escapedUnit, $options: 'i' } },
            { managedBy: currentUser._id }
          ]
        };
      } else if (currentUser.role === 'sub-admin') {
        userQuery = {
          $or: [
            { role: 'master-admin' },
            { _id: currentUser._id },
            { 
              role: 'user',
              unit: { $regex: escapedUnit, $options: 'i' }
            }
          ]
        };
      }

      const allowedUsers = await User.find(userQuery).select('_id');
      const allowedCreatorIds = allowedUsers.map(u => u._id);
      query.creatorId = { $in: allowedCreatorIds };
    }

    // Setup sorting
    let sortQuery = {};
    if (sortField === 'author') {
      sortQuery = { creatorId: sortOrder === 'asc' ? 1 : -1 };
    } else {
      sortQuery = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
    }

    if (page && limit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const skip = (pageNum - 1) * limitNum;

      const questions = await QuestionBank.find(query)
        .populate('creatorId', 'fullName rank unit')
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum);

      const totalCount = await QuestionBank.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limitNum);

      return res.status(200).json({
        questions,
        totalCount,
        totalPages,
        currentPage: pageNum
      });
    } else {
      const questions = await QuestionBank.find(query)
        .populate('creatorId', 'fullName rank unit')
        .sort(sortQuery);
      res.status(200).json(questions);
    }
  } catch (error) {
    console.error('Lỗi lấy câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách câu hỏi ngân hàng' });
  }
};

// 3. UPDATE BANK QUESTION (With role/unit permission filtering)
export const updateBankQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionType, questionText, options, correctAnswers, explanation, category, difficulty } = req.body;
    const currentUser = req.user;

    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    // Enforce role/unit hierarchy permission checks
    const isCreator = question.creatorId.toString() === currentUser.id;
    let isAllowed = false;

    if (currentUser.role === 'master-admin') {
      isAllowed = true;
    } else if (isCreator) {
      isAllowed = true;
    } else {
      // Fetch creator details for unit/role validation
      const creator = await User.findById(question.creatorId);
      if (creator) {
        const escapedUnit = (currentUser.unit || '').toLowerCase();
        if (currentUser.role === 'admin') {
          if (creator.role === 'sub-admin' || creator.role === 'user') {
            if ((creator.unit || '').toLowerCase().includes(escapedUnit) || creator.managedBy?.toString() === currentUser.id) {
              isAllowed = true;
            }
          }
        } else if (currentUser.role === 'sub-admin') {
          if (creator.role === 'user') {
            if ((creator.unit || '').toLowerCase().includes(escapedUnit) || creator.managedBy?.toString() === currentUser.id) {
              isAllowed = true;
            }
          }
        }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ message: 'Đồng chí không có quyền chỉnh sửa câu hỏi này' });
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

// 4. DELETE BANK QUESTION (With role/unit permission filtering)
export const deleteBankQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    // Enforce role/unit hierarchy permission checks
    const isCreator = question.creatorId.toString() === currentUser.id;
    let isAllowed = false;

    if (currentUser.role === 'master-admin') {
      isAllowed = true;
    } else if (isCreator) {
      isAllowed = true;
    } else {
      // Fetch creator details for unit/role validation
      const creator = await User.findById(question.creatorId);
      if (creator) {
        const escapedUnit = (currentUser.unit || '').toLowerCase();
        if (currentUser.role === 'admin') {
          if (creator.role === 'sub-admin' || creator.role === 'user') {
            if ((creator.unit || '').toLowerCase().includes(escapedUnit) || creator.managedBy?.toString() === currentUser.id) {
              isAllowed = true;
            }
          }
        } else if (currentUser.role === 'sub-admin') {
          if (creator.role === 'user') {
            if ((creator.unit || '').toLowerCase().includes(escapedUnit) || creator.managedBy?.toString() === currentUser.id) {
              isAllowed = true;
            }
          }
        }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ message: 'Đồng chí không có quyền xóa câu hỏi này' });
    }

    await QuestionBank.findByIdAndDelete(id);
    res.status(200).json({ message: 'Đã xóa câu hỏi khỏi ngân hàng thành công' });
  } catch (error) {
    console.error('Lỗi xóa câu hỏi ngân hàng:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa câu hỏi ngân hàng' });
  }
};

// 5. AUTO-GENERATE QUIZ FROM CRITERIA (With permission filtering)
export const autoGenerateQuiz = async (req, res) => {
  try {
    const { title, description, duration, passingScorePercent, isPublic, rules } = req.body;
    const currentUser = req.user;

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({ message: 'Vui lòng cung cấp tiêu chí rút ngẫu nhiên câu hỏi' });
    }

    // Build allowed creator IDs for non-master-admins
    let allowedCreatorIds = [];
    if (currentUser.role !== 'master-admin') {
      const escapedUnit = (currentUser.unit || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      let userQuery = {};

      if (currentUser.role === 'admin') {
        userQuery = {
          $or: [
            { role: 'master-admin' },
            { _id: currentUser._id },
            { unit: { $regex: escapedUnit, $options: 'i' } },
            { managedBy: currentUser._id }
          ]
        };
      } else if (currentUser.role === 'sub-admin') {
        userQuery = {
          $or: [
            { role: 'master-admin' },
            { _id: currentUser._id },
            { 
              role: 'user',
              unit: { $regex: escapedUnit, $options: 'i' }
            }
          ]
        };
      }

      const allowedUsers = await User.find(userQuery).select('_id');
      allowedCreatorIds = allowedUsers.map(u => u._id);
    }

    let allSelectedQuestions = [];

    // Process each criteria rule
    for (const rule of rules) {
      const count = parseInt(rule.count) || 0;
      if (count <= 0) continue;

      const matchStage = {
        category: rule.category,
        difficulty: rule.difficulty
      };

      if (currentUser.role !== 'master-admin') {
        matchStage.creatorId = { $in: allowedCreatorIds };
      }

      // Use aggregation pipeline to get random samples
      const samples = await QuestionBank.aggregate([
        { $match: matchStage },
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
