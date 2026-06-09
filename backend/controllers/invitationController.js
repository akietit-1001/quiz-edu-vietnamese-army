import Invitation from '../models/Invitation.js';
import ExamRoom from '../models/ExamRoom.js';
import User from '../models/User.js';
import { sendInvitationEmail } from '../utils/mailer.js';

// 1. SEND INVITATION
export const sendInvitation = async (req, res) => {
  try {
    const { roomCode, recipientEmail, recipientEmails, role } = req.body;
    const senderId = req.user.id;

    // Find room
    const room = await ExamRoom.findOne({ roomCode: roomCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng thi tương ứng với mã' });
    }

    // Verify sender is host
    if (room.hostId.toString() !== senderId && req.user.role !== 'master-admin') {
      return res.status(403).json({ message: 'Đồng chí không phải chủ phòng thi này, không có quyền mời' });
    }

    // Unify emails
    let emails = [];
    if (Array.isArray(recipientEmails)) {
      emails = recipientEmails;
    } else if (recipientEmail) {
      emails = [recipientEmail];
    }

    // Remove empty entries and lowercase them
    emails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))];

    if (emails.length === 0) {
      return res.status(400).json({ message: 'Đồng chí chưa chọn hoặc nhập email người nhận' });
    }

    const hostUrl = req.headers.origin || 'http://localhost:5173';
    const invitationLink = `${hostUrl}/?joinRoom=${room.roomCode}`;
    const sentTo = [];
    const skipped = [];

    for (const email of emails) {
      // Find recipient (optional)
      const recipient = await User.findOne({ email });

      // Check duplicate invitation
      const existing = await Invitation.findOne({
        roomId: room._id,
        recipientEmail: email,
        status: 'pending'
      });
      
      if (existing) {
        skipped.push(recipient ? recipient.fullName : email);
        continue;
      }

      // Create Invitation
      const invitation = await Invitation.create({
        senderId,
        recipientId: recipient ? recipient._id : null,
        recipientEmail: email,
        roomId: room._id,
        roomCode: room.roomCode,
        role: role || 'examinee',
        status: 'pending'
      });

      // Send invitation email
      await sendInvitationEmail(
        email,
        req.user.fullName,
        room.roomCode,
        invitation.role,
        invitationLink
      );
      
      sentTo.push(recipient ? recipient.fullName : email);

      // Real-time socket notification
      const io = req.app?.get('socketio');
      if (io && recipient) {
        io.to(`user_${recipient._id.toString()}`).emit('newInvitation');
      }
    }

    let message = `Đã gửi lời mời phòng thi thành công tới: ${sentTo.join(', ')}.`;
    if (skipped.length > 0) {
      message += ` Bỏ qua lời mời trùng lặp tới: ${skipped.join(', ')}.`;
    }

    res.status(201).json({
      message,
      sentCount: sentTo.length,
      skippedCount: skipped.length
    });
  } catch (error) {
    console.error('Lỗi gửi lời mời phòng thi:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi gửi lời mời' });
  }
};

// 2. GET USER'S PENDING INVITATIONS
export const getMyInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({
      $or: [
        { recipientId: req.user.id },
        { recipientEmail: req.user.email.toLowerCase() }
      ],
      status: 'pending'
    })
      .populate('senderId', 'fullName rank unit position')
      .populate({
        path: 'roomId',
        populate: { path: 'quizId', select: 'title duration' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json(invitations);
  } catch (error) {
    console.error('Lỗi lấy danh sách lời mời:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách lời mời' });
  }
};

// 3. RESPOND TO INVITATION
export const respondToInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted' | 'declined'
    const userId = req.user.id;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Phản hồi không hợp lệ (chỉ được chọn accepted hoặc declined)' });
    }

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ message: 'Không tìm thấy thư mời hoặc thư mời đã hết hạn' });
    }

    const isRecipientById = invitation.recipientId && invitation.recipientId.toString() === userId;
    const isRecipientByEmail = invitation.recipientEmail && invitation.recipientEmail.toLowerCase() === req.user.email.toLowerCase();

    if (!isRecipientById && !isRecipientByEmail) {
      return res.status(403).json({ message: 'Đồng chí không phải là người nhận thư mời này' });
    }

    invitation.status = status;
    invitation.recipientId = userId; // Associate user account now
    await invitation.save();

    if (status === 'accepted') {
      const room = await ExamRoom.findById(invitation.roomId);
      if (!room) {
        return res.status(404).json({ message: 'Phòng thi đã bị chủ phòng xóa hoặc không còn tồn tại' });
      }

      if (room.status === 'finished') {
        return res.status(400).json({ message: 'Phòng thi này đã kết thúc, đồng chí không thể tham gia nữa' });
      }

      // Add to participants if examinee
      if (invitation.role === 'examinee') {
        const isAlreadyParticipant = room.participants.some(p => p.userId.toString() === userId);
        if (!isAlreadyParticipant) {
          room.participants.push({ userId, status: 'waiting' });
          await room.save();
        }
      }
      
      return res.status(200).json({
        message: 'Đã chấp nhận lời mời tham gia phòng thi',
        action: 'join',
        roomCode: invitation.roomCode
      });
    }

    res.status(200).json({ message: 'Đã từ chối lời mời tham gia phòng thi' });
  } catch (error) {
    console.error('Lỗi phản hồi lời mời:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi phản hồi thư mời' });
  }
};
