import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamRoom',
    default: null // null if it's mock test or practice mode outside a room
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  mode: {
    type: String,
    enum: ['exam', 'practice', 'mock'],
    required: true
  },
  answers: [
    {
      questionIndex: {
        type: Number,
        required: true
      },
      selectedAnswers: {
        type: [String],
        default: []
      }
    }
  ],
  score: {
    type: Number, // Number of correct answers
    default: 0
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  rank: {
    type: String,
    enum: ['Xuất sắc', 'Giỏi', 'Khá', 'Trung bình', 'Yếu'],
    default: 'Yếu'
  },
  antiCheatViolations: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ExamAttempt', examAttemptSchema);
