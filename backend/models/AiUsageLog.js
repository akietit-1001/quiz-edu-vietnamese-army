import mongoose from 'mongoose';

// Ghi lại mỗi lần gọi Gemini để sinh/sinh lại câu hỏi — dùng token usage
// THẬT do chính Gemini SDK trả về (usageMetadata), không phải ước lượng, để
// dashboard chi phí AI cho master-admin có số liệu đáng tin cậy.
const aiUsageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['generate_quiz', 'regenerate_question'],
    required: true
  },
  promptTokens: {
    type: Number,
    default: 0
  },
  outputTokens: {
    type: Number,
    default: 0
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  // Số lần thực sự gọi Gemini cho 1 yêu cầu (kể cả các lần thử lại do JSON
  // không hợp lệ) — mỗi lần đều tốn phí thật dù thành công hay không.
  attemptCount: {
    type: Number,
    default: 1
  },
  succeeded: {
    type: Boolean,
    default: true
  },
  // Ước tính theo đơn giá cấu hình trong utils/aiCost.js — CHỈ mang tính
  // tham khảo, không phải hóa đơn chính thức từ Google Cloud.
  estimatedCostUsd: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

aiUsageLogSchema.index({ createdAt: -1 });
aiUsageLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AiUsageLog', aiUsageLogSchema);
