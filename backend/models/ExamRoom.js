import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'taking', 'finished', 'left'],
    default: 'waiting'
  },
  role: {
    type: String,
    enum: ['examinee', 'examiner'],
    default: 'examinee'
  },
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt',
    default: null
  }
});

const examRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    minlength: 6,
    maxlength: 6,
    uppercase: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  duration: {
    type: Number, // Overridden exam duration in minutes (defaults to quiz's duration if null)
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  },
  settings: {
    showResultImmediately: {
      type: Boolean,
      default: true
    },
    antiCheatEnabled: {
      type: Boolean,
      default: true
    }
  },
  participants: [participantSchema],
  startTime: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ExamRoom', examRoomSchema);
