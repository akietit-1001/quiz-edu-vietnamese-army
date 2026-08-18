// "Ban Chỉ huy" là ban lãnh đạo của Phòng/Trung đoàn, không phải ban chuyên
// môn, nên luôn hiển thị đầu tiên trong danh sách các Ban con — trước cả thứ
// tự alphabet của các Ban còn lại.
export const compareUnitSiblings = (a: { name: string }, b: { name: string }): number => {
  const aIsChiHuy = a.name === 'Ban Chỉ huy';
  const bIsChiHuy = b.name === 'Ban Chỉ huy';
  if (aIsChiHuy && !bIsChiHuy) return -1;
  if (bIsChiHuy && !aIsChiHuy) return 1;
  return a.name.localeCompare(b.name);
};
