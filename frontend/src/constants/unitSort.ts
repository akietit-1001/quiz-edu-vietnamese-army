// Thứ tự hiển thị giữa các đơn vị con cùng 1 cha ưu tiên field `order` (do
// người dùng tự kéo-thả sắp xếp, xem PATCH /api/units/:id/reorder) — số nhỏ
// hơn hiện trước. Khi `order` bằng nhau (VD: chưa ai sắp xếp thủ công, mọi
// đơn vị đều mặc định order = 0) mới rơi về so sánh phụ: "Ban Chỉ huy" lên
// đầu (ban lãnh đạo, không phải ban chuyên môn), còn lại theo alphabet.
export const compareUnitSiblings = (a: { name: string; order?: number }, b: { name: string; order?: number }): number => {
  const orderA = a.order ?? 0;
  const orderB = b.order ?? 0;
  if (orderA !== orderB) return orderA - orderB;

  const aIsChiHuy = a.name === 'Ban Chỉ huy';
  const bIsChiHuy = b.name === 'Ban Chỉ huy';
  if (aIsChiHuy && !bIsChiHuy) return -1;
  if (bIsChiHuy && !aIsChiHuy) return 1;
  return a.name.localeCompare(b.name);
};
