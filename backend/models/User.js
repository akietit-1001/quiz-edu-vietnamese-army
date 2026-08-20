import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Chiến sĩ: đăng ký không cần email, đăng nhập bằng username.
  // Cán bộ: giữ nguyên luồng cũ, đăng ký/đăng nhập bằng email + OTP.
  personnelType: {
    type: String,
    enum: ['soldier', 'officer'],
    default: 'officer'
  },
  email: {
    type: String,
    required: function () { return this.personnelType !== 'soldier'; },
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: function () { return this.personnelType === 'soldier'; },
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  rank: {
    type: String, // E.g., Binh nhì, Trung úy, Đại tá...
    default: 'Binh nhì'
  },
  position: {
    type: String, // Chức vụ, e.g., Học viên, Trung đội trưởng...
    default: 'Học viên'
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  address: {
    type: String,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['master-admin', 'admin', 'sub-admin', 'user'],
    default: 'user'
  },
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: ''
  },
  // Tăng lên mỗi khi logout hoặc đổi mật khẩu — nhúng vào JWT (access +
  // refresh) để có thể thu hồi toàn bộ token đã phát hành trước đó ngay lập
  // tức, thay vì phải chờ hết hạn tự nhiên (15 phút/7 ngày).
  tokenVersion: {
    type: Number,
    default: 0
  },
  passwordResetCode: {
    type: String,
    default: ''
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
