import mongoose from 'mongoose';

// Thiết bị được "tin cậy" sau khi xác thực 2FA thành công 1 lần — cho phép
// bỏ qua bước nhập OTP ở những lần đăng nhập tiếp theo TỪ ĐÚNG THIẾT BỊ ĐÓ
// (nhận diện qua cookie deviceTrust), trong vòng 30 ngày. Chỉ lưu HASH của
// token, không lưu token thật, để lộ DB cũng không dùng lại được token.
const trustedDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tokenHash: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // Tự động hết hạn sau 30 ngày
  }
});

trustedDeviceSchema.index({ userId: 1 });
trustedDeviceSchema.index({ tokenHash: 1 });

export default mongoose.model('TrustedDevice', trustedDeviceSchema);
