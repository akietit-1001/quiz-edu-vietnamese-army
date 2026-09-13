import mongoose from 'mongoose';

const omrExamSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    default: null
  },
  upperUnit: {
    type: String,
    default: 'BỘ QUỐC PHÒNG'
  },
  currentUnit: {
    type: String,
    default: 'ĐƠN VỊ TỔ CHỨC THI'
  },
  examCodes: {
    type: [String],
    default: ['101']
  },
  totalQuestions: {
    type: Number,
    required: true,
    default: 40
  },
  roomCode: {
    type: String,
    default: '',
    uppercase: true,
    trim: true
  },
  province: {
    type: String,
    default: 'Đồng Tháp'
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'completed'],
    default: 'active',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Tự động cập nhật updatedAt khi sửa
omrExamSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('OmrExam', omrExamSchema);
