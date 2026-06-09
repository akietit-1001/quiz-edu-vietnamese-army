import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import bankRoutes from './routes/bankRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import './utils/queue.js';

// Models for Socket.io database operations
import ExamRoom from './models/ExamRoom.js';
import User from './models/User.js';
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with your frontend URL
    methods: ['GET', 'POST']
  }
});

app.set('socketio', io);

// Middleware
app.use(cors({
  origin: '*', // In production, replace with your frontend URL
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/invitations', invitationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống phía server' });
});

// --- Socket.io Real-time Exam Room Logic ---
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register user for real-time notifications
  socket.on('registerUser', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} registered for notifications`);
    }
  });

  // 1. Join room (user or host)
  socket.on('joinRoom', async ({ roomCode, userId, role }) => {
    try {
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.userId = userId;

      const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() });
      if (!room) {
        socket.emit('error', 'Phòng thi không tồn tại.');
        return;
      }

      const user = await User.findById(userId).select('fullName rank position unit avatarUrl');
      if (!user) {
        socket.emit('error', 'Người dùng không tồn tại.');
        return;
      }

      // Add user to participant list if not already in it, and not the host
      const isHost = room.hostId.toString() === userId;

      if (!isHost) {
        const Invitation = (await import('./models/Invitation.js')).default;
        const inv = await Invitation.findOne({
          roomId: room._id,
          recipientId: userId,
          status: 'accepted'
        });
        const role = (inv && inv.role === 'examiner') ? 'examiner' : 'examinee';

        const isAlreadyParticipant = room.participants.some(p => p.userId.toString() === userId);
        if (!isAlreadyParticipant) {
          room.participants.push({ userId, role, status: 'waiting' });
          await room.save();
        } else {
          // If already in list, set status back to waiting/taking if they reconnected
          await ExamRoom.updateOne(
            { roomCode: roomCode.toUpperCase(), 'participants.userId': userId },
            { $set: { 'participants.$.status': room.status === 'active' ? 'taking' : 'waiting' } }
          );
        }
      }

      // Fetch updated room with populated participants info
      const updatedRoom = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() })
        .populate('participants.userId', 'fullName rank position unit avatarUrl');

      // Notify everyone in the room about the updated client list
      io.to(roomCode).emit('roomData', {
        status: updatedRoom.status,
        participants: updatedRoom.participants,
        startTime: updatedRoom.startTime
      });

      console.log(`User ${user.fullName} joined room ${roomCode}`);
    } catch (err) {
      console.error('Lỗi socket joinRoom:', err.message);
    }
  });

  // 2. Start Exam (Triggered by Host Admin)
  socket.on('startExam', async ({ roomCode }) => {
    try {
      const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() });
      if (room) {
        room.status = 'active';
        room.startTime = new Date();
        // Update all waiting participants to taking status
        room.participants.forEach(p => {
          if (p.status === 'waiting') p.status = 'taking';
        });
        await room.save();

        io.to(roomCode).emit('examStarted', { startTime: room.startTime });
      }
    } catch (err) {
      console.error('Lỗi socket startExam:', err.message);
    }
  });

  // 3. User Cheating Alert (tab switch or fullscreen exit)
  socket.on('cheatAlert', async ({ roomCode, userId, violationCount }) => {
    try {
      const user = await User.findById(userId).select('fullName');
      if (user) {
        // Emit alert to the room (will be processed by host interface)
        io.to(roomCode).emit('cheatNotification', {
          userId,
          fullName: user.fullName,
          violationCount,
          message: `Đồng chí ${user.fullName} đã rời màn hình thi (${violationCount} lần)`
        });
      }
    } catch (err) {
      console.error('Lỗi socket cheatAlert:', err.message);
    }
  });

  // 4. User finished or submitted exam early
  socket.on('submitExamFinished', async ({ roomCode, userId, score, totalQuestions }) => {
    try {
      const user = await User.findById(userId).select('fullName rank unit');
      if (user) {
        // Notify host that user has completed the exam
        io.to(roomCode).emit('userFinished', {
          userId,
          fullName: user.fullName,
          rank: user.rank,
          unit: user.unit,
          score,
          totalQuestions
        });
      }
    } catch (err) {
      console.error('Lỗi socket submitExamFinished:', err.message);
    }
  });

  // 5. User leaves room voluntarily
  socket.on('leaveRoom', async ({ roomCode, userId }) => {
    try {
      await ExamRoom.updateOne(
        { roomCode: roomCode.toUpperCase(), 'participants.userId': userId },
        { $set: { 'participants.$.status': 'left' } }
      );
      
      const updatedRoom = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() })
        .populate('participants.userId', 'fullName rank position unit avatarUrl');

      io.to(roomCode).emit('roomData', {
        status: updatedRoom.status,
        participants: updatedRoom.participants
      });

      socket.leave(roomCode);
      console.log(`User ${userId} left room ${roomCode}`);
    } catch (err) {
      console.error('Lỗi socket leaveRoom:', err.message);
    }
  });

  // 6. Disconnection handler
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.roomCode && socket.userId) {
      try {
        // Update user status as left or offline
        await ExamRoom.updateOne(
          { roomCode: socket.roomCode.toUpperCase(), 'participants.userId': socket.userId },
          { $set: { 'participants.$.status': 'left' } }
        );

        const updatedRoom = await ExamRoom.findOne({ roomCode: socket.roomCode.toUpperCase() })
          .populate('participants.userId', 'fullName rank position unit avatarUrl');

        if (updatedRoom) {
          io.to(socket.roomCode).emit('roomData', {
            status: updatedRoom.status,
            participants: updatedRoom.participants
          });
        }
      } catch (err) {
        console.error('Lỗi socket disconnect handler:', err.message);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
