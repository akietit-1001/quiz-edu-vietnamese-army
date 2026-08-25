import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Chiến sĩ đăng ký bằng username (không có email) nên trường này không
  // còn bắt buộc — recipientId là nguồn xác định người nhận đáng tin cậy hơn.
  recipientEmail: {
    type: String,
    required: false,
    default: '',
    lowercase: true,
    trim: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamRoom',
    required: true
  },
  roomCode: {
    type: String,
    required: true,
    uppercase: true
  },
  role: {
    type: String,
    enum: ['examiner', 'examinee'],
    default: 'examinee'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 * 3 // Auto delete after 3 days
  }
});

export default mongoose.model('Invitation', invitationSchema);
