import Notification from '../models/Notification.js';

// 1. GET MY NOTIFICATIONS (danh sách gần nhất + số chưa đọc)
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .limit(limitNum),
      Notification.countDocuments({ recipientId: userId, isRead: false })
    ]);

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Lỗi lấy danh sách thông báo:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách thông báo' });
  }
};

// 2. MARK ONE AS READ
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ _id: id, recipientId: req.user.id });
    if (!notification) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: 'Đã đánh dấu đã đọc', notification });
  } catch (error) {
    console.error('Lỗi đánh dấu đã đọc thông báo:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đánh dấu thông báo' });
  }
};

// 3. MARK ALL AS READ
export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.user.id, isRead: false }, { $set: { isRead: true } });
    res.status(200).json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (error) {
    console.error('Lỗi đánh dấu tất cả thông báo đã đọc:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi đánh dấu thông báo' });
  }
};
