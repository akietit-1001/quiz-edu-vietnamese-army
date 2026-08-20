import AiUsageLog from '../models/AiUsageLog.js';

// Đơn giá Gemini Flash — CẤU HÌNH ĐƯỢC qua .env vì đây không phải nguồn giá
// theo thời gian thực đáng tin cậy; giá trị mặc định dưới đây chỉ là số
// tham khảo ở thời điểm viết code. Master-admin nên đối chiếu với bảng giá
// thực tế tại ai.google.dev/pricing và cập nhật lại .env nếu lệch.
const INPUT_PRICE_PER_1M_USD = parseFloat(process.env.GEMINI_INPUT_PRICE_PER_1M_USD) || 0.075;
const OUTPUT_PRICE_PER_1M_USD = parseFloat(process.env.GEMINI_OUTPUT_PRICE_PER_1M_USD) || 0.30;

export const estimateCostUsd = (promptTokens, outputTokens) => {
  return (promptTokens / 1_000_000) * INPUT_PRICE_PER_1M_USD + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M_USD;
};

/**
 * Gộp toàn bộ usageMetadata thu được qua các lần gọi Gemini (kể cả các lần
 * thử lại thất bại — vẫn tốn phí thật) cho 1 yêu cầu, rồi ghi 1 bản ghi
 * AiUsageLog duy nhất.
 */
export const logAiUsage = async ({ userId, action, usageEvents, succeeded }) => {
  try {
    if (!userId || !usageEvents || usageEvents.length === 0) return null;

    const promptTokens = usageEvents.reduce((sum, u) => sum + (u.promptTokenCount || 0), 0);
    const outputTokens = usageEvents.reduce((sum, u) => sum + (u.candidatesTokenCount || 0), 0);

    return await AiUsageLog.create({
      userId,
      action,
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
      attemptCount: usageEvents.length,
      succeeded: succeeded !== false,
      estimatedCostUsd: estimateCostUsd(promptTokens, outputTokens)
    });
  } catch (err) {
    // Lỗi ghi log chi phí AI không được phép làm hỏng luồng sinh đề chính
    console.error('Lỗi ghi log chi phí AI:', err.message);
    return null;
  }
};
