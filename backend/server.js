import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import app from './app.js';

// Models for Socket.io database operations
import ExamRoom from './models/ExamRoom.js';
import User from './models/User.js';
import { isExamineeCapacityReached, ROOM_FULL_MESSAGE } from './utils/roomCapacity.js';
import { createNotification, upsertAggregatedNotification } from './utils/notify.js';
import { setServers } from "node:dns/promises";
setServers(["1.1.1.1", "8.8.8.8"]);

// Connect to Database
connectDB();

// Dynamic import for Redis queue
import('./utils/queue.js').then(() => {
  console.log('=== [Queue] Hàng đợi BullMQ đã được khởi tạo ===');
}).catch(err => {
  console.error('=== [Queue] Lỗi khởi tạo hàng đợi:', err.message, '===');
});

const server = http.createServer(app);

// Allowed frontend origins (comma-separated in CORS_ORIGIN), needed for
// cross-site cookies (refresh token) once frontend/backend are on different domains
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('socketio', io);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  });
}


// --- Socket.io Real-time Exam Room Logic ---
if (io) {
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

      const user = await User.findById(userId).select('fullName rank position unitId avatarUrl');
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
          if (role === 'examinee' && isExamineeCapacityReached(room)) {
            socket.emit('error', ROOM_FULL_MESSAGE);
            return;
          }
          // Nếu vào phòng khi cuộc thi đã "active" (mời trễ, hoặc vào lại
          // sau khi bị rớt kết nối trước khi kịp ghi nhận) thì phải vào
          // thẳng trạng thái "taking" — nếu cứ để "waiting" thì màn hình
          // giám sát sẽ hiển thị sai và participant này không bao giờ được
          // chuyển sang "taking" nữa (bước đó chỉ chạy 1 lần lúc startExam).
          room.participants.push({ userId, role, status: room.status === 'active' ? 'taking' : 'waiting' });
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
        .populate({
          path: 'participants.userId',
          select: 'fullName rank position unitId avatarUrl',
          populate: { path: 'unitId', select: 'name' }
        });

      // Notify everyone in the room about the updated client list
      io.to(roomCode).emit('roomData', {
        status: updatedRoom.status,
        participants: updatedRoom.participants,
        startTime: updatedRoom.startTime
      });

      // Notify host to update dashboard participant count
      if (updatedRoom && updatedRoom.hostId) {
        io.to(`user_${updatedRoom.hostId.toString()}`).emit('roomParticipantsChanged', {
          roomCode: updatedRoom.roomCode
        });
      }

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

        // Phát lại roomData với trạng thái "taking" mới cập nhật — thiếu
        // bước này khiến màn hình giám sát của host/giám khảo (ở lại
        // RoomLobby khi thi bắt đầu) vẫn hiển thị toàn bộ thí sinh là
        // "waiting" dù họ đã vào làm bài.
        const updatedRoom = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() })
          .populate({
            path: 'participants.userId',
            select: 'fullName rank position unitId avatarUrl',
            populate: { path: 'unitId', select: 'name' }
          });
        io.to(roomCode).emit('roomData', {
          status: updatedRoom.status,
          participants: updatedRoom.participants,
          startTime: updatedRoom.startTime
        });
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
        const message = `Đồng chí ${user.fullName} đã rời màn hình thi (${violationCount} lần)`;
        // Emit tới phòng — cho màn hình giám sát đang mở (real-time feed,
        // không lưu trữ). Đồng thời tạo 1 thông báo bền vững + bắn qua kênh
        // cá nhân của host (icon chuông) để host vẫn nhận được dù đang ở
        // trang khác, không chỉ khi đang mở đúng màn hình giám sát phòng đó.
        io.to(roomCode).emit('cheatNotification', { roomCode, userId, fullName: user.fullName, violationCount, message });

        const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() }).select('hostId');
        if (room?.hostId) {
          // Gộp theo (phòng, thí sinh) — 1 thí sinh vi phạm nhiều lần chỉ có
          // 1 thông báo tự cập nhật số lần, không tạo mới mỗi lần vi phạm.
          await upsertAggregatedNotification(io, {
            recipientId: room.hostId,
            type: 'cheat_alert',
            matchKey: { roomCode: roomCode.toUpperCase(), userId },
            buildUpdate: (notif) => {
              notif.title = 'Cảnh báo vi phạm thi cử';
              notif.message = message;
              notif.actionView = 'lobby';
              notif.actionPayload = { roomCode: roomCode.toUpperCase(), userId, violationCount };
            }
          });
        }
      }
    } catch (err) {
      console.error('Lỗi socket cheatAlert:', err.message);
    }
  });

  // 4. User finished or submitted exam early
  socket.on('submitExamFinished', async ({ roomCode, userId, score, totalQuestions }) => {
    try {
      const user = await User.findById(userId).select('fullName rank unitId').populate('unitId', 'name');
      if (user) {
        // Notify host that user has completed the exam — real-time feed cho
        // màn hình giám sát đang mở.
        io.to(roomCode).emit('userFinished', {
          roomCode,
          userId,
          fullName: user.fullName,
          rank: user.rank,
          unit: user.unitId?.name || '',
          score,
          totalQuestions
        });

        const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() }).select('hostId');
        if (room?.hostId) {
          // Gộp theo phòng — cả phòng nộp bài dồn dập chỉ có 1 thông báo tự
          // đếm số thí sinh đã nộp, không tạo 1 thông báo riêng cho mỗi người.
          await upsertAggregatedNotification(io, {
            recipientId: room.hostId,
            type: 'exam_submitted',
            matchKey: { roomCode: roomCode.toUpperCase() },
            buildUpdate: (notif) => {
              const count = (notif.actionPayload?.count || 0) + 1;
              notif.title = 'Thí sinh nộp bài';
              notif.message = `${count} thí sinh đã nộp bài trong phòng ${roomCode.toUpperCase()} (gần nhất: ${user.fullName})`;
              notif.actionView = 'lobby';
              notif.actionPayload = { roomCode: roomCode.toUpperCase(), count };
            }
          });
        }
      }
    } catch (err) {
      console.error('Lỗi socket submitExamFinished:', err.message);
    }
  });

  // 5. User leaves room voluntarily
  socket.on('leaveRoom', async ({ roomCode, userId }) => {
    try {
      // Check if there are other active socket connections for the same user in this room
      const activeSockets = await io.in(roomCode).fetchSockets();
      const isStillConnected = activeSockets.some(s => s.userId === userId && s.id !== socket.id);

      if (!isStillConnected) {
        const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() });
        const participant = room?.participants.find(p => p.userId.toString() === userId);
        const hasFinished = participant?.status === 'finished';

        await ExamRoom.updateOne(
          { roomCode: roomCode.toUpperCase(), 'participants.userId': userId },
          { $set: { 'participants.$.status': 'left' } }
        );
        
        const updatedRoom = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() })
          .populate({
          path: 'participants.userId',
          select: 'fullName rank position unitId avatarUrl',
          populate: { path: 'unitId', select: 'name' }
        });

        io.to(roomCode).emit('roomData', {
          status: updatedRoom.status,
          participants: updatedRoom.participants
        });

        // Notify host to update dashboard participant count
        if (updatedRoom && updatedRoom.hostId) {
          io.to(`user_${updatedRoom.hostId.toString()}`).emit('roomParticipantsChanged', {
            roomCode: updatedRoom.roomCode
          });
        }

        if (participant && !hasFinished) {
          const user = await User.findById(userId).select('fullName');
          if (user) {
            io.to(roomCode).emit('userLeftRoom', {
              userId,
              fullName: user.fullName,
              message: `Đồng chí ${user.fullName} đã rời khỏi phòng thi.`
            });
          }
        }
      }

      socket.leave(roomCode);
      console.log(`User ${userId} left room ${roomCode}`);
    } catch (err) {
      console.error('Lỗi socket leaveRoom:', err.message);
    }
  });

  // 5.5. Kick Participant (Triggered by Host Admin)
  socket.on('kickParticipant', async ({ roomCode, userId }) => {
    try {
      const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() });
      if (!room) return;

      // Verify sender is host
      if (room.hostId.toString() !== socket.userId) {
        socket.emit('error', 'Chỉ có chủ phòng mới có quyền trục xuất quân nhân.');
        return;
      }

      // Remove from database participants
      await ExamRoom.updateOne(
        { roomCode: roomCode.toUpperCase() },
        { $pull: { participants: { userId: userId } } }
      );

      // Clean up related invitations
      const Invitation = (await import('./models/Invitation.js')).default;
      await Invitation.deleteOne({ roomId: room._id, recipientId: userId });

      // Get updated room data
      const updatedRoom = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() })
        .populate({
          path: 'participants.userId',
          select: 'fullName rank position unitId avatarUrl',
          populate: { path: 'unitId', select: 'name' }
        });

      // Notify remaining participants in the room
      io.to(roomCode).emit('roomData', {
        status: updatedRoom.status,
        participants: updatedRoom.participants,
        startTime: updatedRoom.startTime
      });

      // Notify host's dashboard
      io.to(`user_${room.hostId.toString()}`).emit('roomParticipantsChanged', {
        roomCode: room.roomCode
      });

      // Notify the kicked user directly
      const kickMessage = 'Đồng chí đã bị chỉ huy trục xuất khỏi phòng thi này.';
      io.to(`user_${userId}`).emit('kickedFromRoom', { roomCode, message: kickMessage });
      await createNotification(io, {
        recipientId: userId,
        type: 'kicked',
        title: 'Bị trục xuất khỏi phòng thi',
        message: `${kickMessage} (Mã phòng: ${roomCode})`,
        actionView: 'dashboard'
      });

      console.log(`User ${userId} was kicked from room ${roomCode}`);
    } catch (err) {
      console.error('Lỗi socket kickParticipant:', err.message);
    }
  });

  // 6. Disconnection handler
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.roomCode && socket.userId) {
      try {
        // Check if there are other active socket connections for the same user in this room
        const activeSockets = await io.in(socket.roomCode).fetchSockets();
        const isStillConnected = activeSockets.some(s => s.userId === socket.userId && s.id !== socket.id);

        if (!isStillConnected) {
          const room = await ExamRoom.findOne({ roomCode: socket.roomCode.toUpperCase() });
          const participant = room?.participants.find(p => p.userId.toString() === socket.userId);
          const hasFinished = participant?.status === 'finished';

          // Update user status as left or offline
          await ExamRoom.updateOne(
            { roomCode: socket.roomCode.toUpperCase(), 'participants.userId': socket.userId },
            { $set: { 'participants.$.status': 'left' } }
          );

          const updatedRoom = await ExamRoom.findOne({ roomCode: socket.roomCode.toUpperCase() })
            .populate({
          path: 'participants.userId',
          select: 'fullName rank position unitId avatarUrl',
          populate: { path: 'unitId', select: 'name' }
        });

          if (updatedRoom) {
            io.to(socket.roomCode).emit('roomData', {
              status: updatedRoom.status,
              participants: updatedRoom.participants
            });

            // Notify host to update dashboard participant count
            if (updatedRoom.hostId) {
              io.to(`user_${updatedRoom.hostId.toString()}`).emit('roomParticipantsChanged', {
                roomCode: updatedRoom.roomCode
              });
            }

            if (participant && !hasFinished) {
              const user = await User.findById(socket.userId).select('fullName');
              if (user) {
                io.to(socket.roomCode).emit('userLeftRoom', {
                  userId: socket.userId,
                  fullName: user.fullName,
                  message: `Đồng chí ${user.fullName} đã rời khỏi phòng thi.`
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Lỗi socket disconnect handler:', err.message);
      }
    }
  });
});
} // End of if (io)

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app };
