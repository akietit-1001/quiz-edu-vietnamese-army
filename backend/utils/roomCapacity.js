// Đếm số thí sinh đang thực sự chiếm 1 suất trong phòng — loại trừ giám khảo
// (role 'examiner') và những người đã rời phòng (status 'left'). Chủ phòng
// không cần loại riêng vì hostId không bao giờ được đẩy vào participants.
export const countActiveExaminees = (room) =>
  room.participants.filter(p => p.role !== 'examiner' && p.status !== 'left').length;

// true nếu phòng đã đạt giới hạn sĩ số thí sinh (maxParticipants null/0 = không giới hạn).
export const isExamineeCapacityReached = (room) => {
  const max = room.settings?.maxParticipants;
  if (!max) return false;
  return countActiveExaminees(room) >= max;
};

export const ROOM_FULL_MESSAGE =
  'Phòng thi đã đủ sĩ số thí sinh cho phép, đồng chí không thể tham gia với vai trò thí sinh vào lúc này.';
