import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionType: {
    type: String,
    enum: ['multiple-choice', 'fill-in-the-blank', 'true-false'],
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    default: [] // Only used for multiple-choice and true-false
  },
  correctAnswers: {
    type: [String],
    required: true // Store the correct option index, word, or 'true'/'false'
  },
  explanation: {
    type: String,
    default: ''
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'],
    default: 'Khác'
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number, // In minutes
    required: true,
    default: 45
  },
  passingScorePercent: {
    type: Number, // In percentage, e.g., 50%
    default: 50
  },
  questions: [questionSchema],
  shareCode: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate a unique share code before saving if not present
quizSchema.pre('save', function (next) {
  if (!this.shareCode) {
    this.shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

export default mongoose.model('Quiz', quizSchema);
