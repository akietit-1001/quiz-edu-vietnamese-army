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
      const user = await User.findById(userId).select('fullName rank unitId').populate('unitId', 'name');
      if (user) {
        // Notify host that user has completed the exam
        io.to(roomCode).emit('userFinished', {
          userId,
          fullName: user.fullName,
          rank: user.rank,
          unit: user.unitId?.name || '',
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
      io.to(`user_${userId}`).emit('kickedFromRoom', {
        roomCode,
        message: 'Đồng chí đã bị chỉ huy trục xuất khỏi phòng thi này.'
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
