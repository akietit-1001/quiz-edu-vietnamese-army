// Định nghĩa Express app thuần tuý — KHÔNG kết nối DB, KHÔNG mở cổng lắng
// nghe, KHÔNG khởi tạo Socket.io/hàng đợi Redis. Tách riêng khỏi server.js
// để test (supertest) và các script khác có thể import `app` an toàn, nhiều
// lần, mà không gây side effect ngoài ý muốn (kết nối nhầm CSDL thật, bind
// trùng cổng...).
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import bankRoutes from './routes/bankRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

const app = express();

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler — phân biệt lỗi do client gửi dữ liệu sai (400) với
// lỗi hệ thống thật (500), thay vì trả 500 chung cho tất cả để dễ debug và
// không làm ồn log lỗi hệ thống bằng các lỗi validate bình thường.
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Dữ liệu không hợp lệ theo schema Mongoose (thiếu field required, sai kiểu...)
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Dữ liệu gửi lên không hợp lệ: ' + err.message });
  }

  // ObjectId sai định dạng (ví dụ :id trong URL không phải ObjectId hợp lệ)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Định dạng ID không hợp lệ' });
  }

  // Trùng khoá unique (email/username đã tồn tại) lọt qua tới đây thay vì
  // được controller bắt trước
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Dữ liệu đã tồn tại trên hệ thống (trùng khoá duy nhất)' });
  }

  // Lỗi tự định nghĩa có gắn sẵn statusCode (throw new Error() với statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message || 'Đã xảy ra lỗi' });
  }

  res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống phía server' });
});

export default app;
