import Notification from '../models/Notification.js';

/**
 * Tạo 1 thông báo bền vững (lưu MongoDB) cho recipientId, đồng thời bắn
 * real-time qua socket kênh cá nhân `user_{recipientId}` (nếu io khả dụng)
 * để icon chuông trên Navbar cập nhật ngay lập tức không cần tải lại trang.
 */
export const createNotification = async (io, { recipientId, type, title, message, actionView = 'dashboard', actionPayload = {} }) => {
  if (!recipientId) return null;

  try {
    const notification = await Notification.create({
      recipientId,
      type,
      title,
      message,
      actionView,
      actionPayload
    });

    if (io) {
      io.to(`user_${recipientId.toString()}`).emit('newNotification', notification);
    }

    return notification;
  } catch (err) {
    console.error('Lỗi tạo thông báo:', err.message);
    return null;
  }
};

/**
 * Giống createNotification, nhưng GỘP các sự kiện dồn dập cùng loại (vd mỗi
 * lần 1 thí sinh nộp bài, mỗi lần 1 thí sinh vi phạm) vào ĐÚNG 1 bản ghi
 * thông báo thay vì tạo mới liên tục — tránh spam icon chuông khi cả phòng
 * thi cùng lúc nộp bài. `matchKey` xác định phạm vi gộp (vd { roomCode } để
 * gộp theo phòng, hoặc { roomCode, userId } để gộp theo từng thí sinh).
 * Chỉ gộp vào thông báo CHƯA ĐỌC — một khi host đã đọc, sự kiện tiếp theo sẽ
 * mở một thông báo mới (giống bắt đầu 1 đợt cảnh báo/nộp bài mới).
 */
export const upsertAggregatedNotification = async (io, { recipientId, type, matchKey, buildUpdate }) => {
  if (!recipientId) return null;

  try {
    const filter = { recipientId, type, isRead: false };
    Object.entries(matchKey).forEach(([k, v]) => {
      filter[`actionPayload.${k}`] = v;
    });

    let notification = await Notification.findOne(filter);
    if (!notification) {
      notification = new Notification({ recipientId, type, title: '', message: '', actionPayload: { ...matchKey } });
    }

    buildUpdate(notification);
    notification.isRead = false;
    notification.createdAt = new Date(); // đưa lên đầu danh sách mỗi lần cập nhật
    await notification.save();

    if (io) {
      io.to(`user_${recipientId.toString()}`).emit('newNotification', notification);
    }

    return notification;
  } catch (err) {
    console.error('Lỗi tạo/cập nhật thông báo gộp:', err.message);
    return null;
  }
};
