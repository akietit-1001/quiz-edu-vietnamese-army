import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['invitation', 'cheat_alert', 'exam_submitted', 'kicked', 'quiz_shared'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Cho frontend biết bấm vào thông báo này thì điều hướng tới view nào
  // (khớp với các giá trị currentView trong uiSlice.ts) và tham số cần
  // truyền kèm (vd roomCode để mở đúng phòng thi).
  actionView: {
    type: String,
    enum: ['dashboard', 'lobby', 'quiz-mgmt'],
    default: 'dashboard'
  },
  actionPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // Tự động dọn sau 30 ngày
  }
});

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

export default mongoose.model('Notification', notificationSchema);
