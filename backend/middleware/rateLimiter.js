import rateLimit from 'express-rate-limit';

// Vô hiệu hoá rate-limit khi chạy test (NODE_ENV=test, xem tests/setup.js) —
// nếu không, các test suite đăng ký hàng chục tài khoản liên tiếp từ cùng
// 1 "IP" (supertest gọi thẳng app, không qua network thật) sẽ tự đá nhau 429.
const skipInTest = () => process.env.NODE_ENV === 'test';

// Giới hạn số lần đăng nhập/đăng ký từ 1 địa chỉ IP, chống dò mật khẩu
// (brute-force) và spam tạo tài khoản ảo.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { message: 'Đồng chí đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.' }
});

// Giới hạn số lần thử mã OTP (2FA, xác thực đăng ký, quên mật khẩu) — mã chỉ
// có 6 chữ số (1 triệu tổ hợp) nên bắt buộc phải giới hạn số lần thử để
// tránh brute-force trong cửa sổ hiệu lực của OTP.
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 phút
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { message: 'Đồng chí đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút hoặc yêu cầu gửi lại mã mới.' }
});

// Giới hạn số lượt gọi AI (Gemini) sinh/sinh lại câu hỏi theo từng tài khoản
// đã đăng nhập — chặn spam làm đội chi phí API. Áp dụng SAU authMiddleware
// nên req.user luôn tồn tại; vẫn fallback về IP để an toàn.
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: skipInTest,
  message: { message: 'Đồng chí đã sử dụng quá số lượt sinh đề bằng AI cho phép trong 1 giờ. Vui lòng thử lại sau.' }
});
