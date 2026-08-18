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

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống phía server' });
});

export default app;
