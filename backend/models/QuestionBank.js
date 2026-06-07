import mongoose from 'mongoose';

const questionBankSchema = new mongoose.Schema({
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'fill-in-the-blank'],
    required: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    default: [] // For multiple-choice & true-false
  },
  correctAnswers: {
    type: [String],
    required: true
  },
  explanation: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'],
    required: true,
    default: 'Khác'
  },
  difficulty: {
    type: String,
    enum: ['Dễ', 'Trung bình', 'Khó'],
    required: true,
    default: 'Trung bình'
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('QuestionBank', questionBankSchema);
