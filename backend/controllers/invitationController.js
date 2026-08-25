import Invitation from '../models/Invitation.js';
import ExamRoom from '../models/ExamRoom.js';
import User from '../models/User.js';
import { sendInvitationEmail } from '../utils/mailer.js';
import { isExamineeCapacityReached, ROOM_FULL_MESSAGE } from '../utils/roomCapacity.js';
import { createNotification } from '../utils/notify.js';

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

    // Unify identifiers — mỗi mục có thể là email (cán bộ) hoặc mã số quân
    // nhân/tên đăng nhập (chiến sĩ, vốn không có email).
    let identifiers = [];
    if (Array.isArray(recipientEmails)) {
      identifiers = recipientEmails;
    } else if (recipientEmail) {
      identifiers = [recipientEmail];
    }

    // Remove empty entries and lowercase them
    identifiers = [...new Set(identifiers.map(e => e.trim().toLowerCase()).filter(Boolean))];

    if (identifiers.length === 0) {
      return res.status(400).json({ message: 'Đồng chí chưa chọn hoặc nhập mã số/email người nhận' });
    }

    const hostUrl = req.headers.origin || 'http://localhost:5173';
    const invitationLink = `${hostUrl}/?joinRoom=${room.roomCode}`;
    const sentTo = [];
    const skipped = [];
    const notFound = [];

    for (const identifier of identifiers) {
      // Tìm theo email trước (cán bộ), sau đó theo username (chiến sĩ)
      const recipient = await User.findOne({
        $or: [{ email: identifier }, { username: identifier }]
      });

      const recipientEmailValue = recipient?.email || (identifier.includes('@') ? identifier : '');

      if (!recipient && !recipientEmailValue) {
        // Không tìm thấy tài khoản và chuỗi nhập vào không phải email hợp lệ
        // để gửi lời mời cho người chưa có tài khoản trên hệ thống.
        notFound.push(identifier);
        continue;
      }

      // Check duplicate invitation
      const existing = await Invitation.findOne({
        roomId: room._id,
        status: 'pending',
        ...(recipient ? { recipientId: recipient._id } : { recipientEmail: recipientEmailValue })
      });

      if (existing) {
        skipped.push(recipient ? recipient.fullName : identifier);
        continue;
      }

      // Create Invitation
      const invitation = await Invitation.create({
        senderId,
        recipientId: recipient ? recipient._id : null,
        recipientEmail: recipientEmailValue,
        roomId: room._id,
        roomCode: room.roomCode,
        role: role || 'examinee',
        status: 'pending'
      });

      // Gửi email lời mời nếu người nhận có email (chiến sĩ không có email
      // sẽ chỉ nhận thông báo trong ứng dụng bên dưới)
      if (recipientEmailValue) {
        await sendInvitationEmail(
          recipientEmailValue,
          req.user.fullName,
          room.roomCode,
          invitation.role,
          invitationLink
        );
      }

      sentTo.push(recipient ? recipient.fullName : identifier);

      // Real-time socket notification + thông báo bền vững trên icon chuông
      const io = req.app?.get('socketio');
      if (recipient) {
        if (io) {
          io.to(`user_${recipient._id.toString()}`).emit('newInvitation');
        }
        await createNotification(io, {
          recipientId: recipient._id,
          type: 'invitation',
          title: 'Lời mời phòng thi',
          message: `${req.user.fullName} đã mời đồng chí tham gia phòng thi ${room.roomCode} với vai trò ${invitation.role === 'examiner' ? 'Giám khảo' : 'Thí sinh'}.`,
          actionView: 'dashboard',
          actionPayload: { roomCode: room.roomCode }
        });
      }
    }

    let message = sentTo.length > 0
      ? `Đã gửi lời mời phòng thi thành công tới: ${sentTo.join(', ')}.`
      : 'Không có lời mời nào được gửi.';
    if (skipped.length > 0) {
      message += ` Bỏ qua lời mời trùng lặp tới: ${skipped.join(', ')}.`;
    }
    if (notFound.length > 0) {
      message += ` Không tìm thấy tài khoản với mã số/email: ${notFound.join(', ')}.`;
    }

    res.status(201).json({
      message,
      sentCount: sentTo.length,
      skippedCount: skipped.length + notFound.length
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
        ...(req.user.email ? [{ recipientEmail: req.user.email.toLowerCase() }] : [])
      ],
      status: 'pending'
    })
      .populate({ path: 'senderId', select: 'fullName rank unitId position', populate: { path: 'unitId', select: 'name' } })
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
    const isRecipientByEmail = !!(invitation.recipientEmail && req.user.email && invitation.recipientEmail.toLowerCase() === req.user.email.toLowerCase());

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

      if (invitation.role === 'examinee' && isExamineeCapacityReached(room)) {
        return res.status(400).json({ message: ROOM_FULL_MESSAGE });
      }

      // Add to participants if examinee
      if (invitation.role === 'examinee') {
        const isAlreadyParticipant = room.participants.some(p => p.userId.toString() === userId);
        if (!isAlreadyParticipant) {
          room.participants.push({ userId, status: 'waiting' });
          await room.save();
        }
      }
      
      // Notify host to update dashboard participant count
      const io = req.app?.get('socketio');
      if (io && room.hostId) {
        io.to(`user_${room.hostId.toString()}`).emit('roomParticipantsChanged', {
          roomCode: room.roomCode
        });
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
