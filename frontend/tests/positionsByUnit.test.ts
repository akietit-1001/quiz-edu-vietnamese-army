import { describe, it, expect } from 'vitest';
import { getPositionsForUnit, ALL_POSITIONS, FALLBACK_POSITIONS } from '../src/constants/positionsByUnit';

describe('positionsByUnit: getPositionsForUnit', () => {
  it('trả đúng danh sách cho 1 ban chuyên môn cụ thể (Ban Quân y)', () => {
    const result = getPositionsForUnit('Ban Quân y');
    expect(result).toContain('Bác sĩ/Trợ lý quân y');
    expect(result).not.toContain('Chủ nhiệm Chính trị');
  });

  it('"Ban Chỉ huy" trả chức vụ KHÁC NHAU tuỳ đơn vị cha (Phòng Tham mưu vs Phòng Chính trị)', () => {
    const thamMuu = getPositionsForUnit('Ban Chỉ huy', 'Phòng Tham mưu');
    const chinhTri = getPositionsForUnit('Ban Chỉ huy', 'Phòng Chính trị');
    expect(thamMuu).toEqual(['Trưởng phòng', 'Phó Trưởng phòng']);
    expect(chinhTri).toEqual(['Chủ nhiệm Chính trị', 'Phó Chủ nhiệm Chính trị']);
    expect(thamMuu).not.toEqual(chinhTri);
  });

  it('"Ban Chỉ huy" không rõ đơn vị cha (hoặc cha không có trong bảng) -> rơi về fallback, không throw', () => {
    const result = getPositionsForUnit('Ban Chỉ huy', undefined);
    expect(result).toEqual(FALLBACK_POSITIONS);
  });

  it('đơn vị gộp "Ban CHQS cấp xã/phường" trả đúng chức vụ cấp xã', () => {
    const result = getPositionsForUnit('Ban CHQS cấp xã/phường');
    expect(result).toContain('Chỉ huy trưởng Ban CHQS cấp xã');
    expect(result).toContain('Chiến sĩ Dân quân thường trực');
  });

  it('đơn vị cấp Huyện/Thành phố nhận diện qua tiền tố tên', () => {
    expect(getPositionsForUnit('Ban Chỉ huy Quân sự Huyện Châu Thành')).toContain('Trợ lý Tác chiến');
    expect(getPositionsForUnit('Ban Chỉ huy Quân sự Thành phố Cao Lãnh')).toContain('Chỉ huy trưởng');
  });

  it('đơn vị cấp Đại đội chưa có trong bảng riêng -> dùng mẫu chức vụ đại đội chung', () => {
    const result = getPositionsForUnit('Đại đội Thông tin 1');
    expect(result).toContain('Đại đội trưởng');
    expect(result).toContain('Chiến sĩ');
  });

  it('đơn vị không khớp bất kỳ quy tắc nào -> fallback về danh sách gốc', () => {
    expect(getPositionsForUnit('Đơn vị chưa từng biết tới')).toBe(FALLBACK_POSITIONS);
  });

  it('không truyền tên đơn vị -> fallback', () => {
    expect(getPositionsForUnit(undefined)).toBe(FALLBACK_POSITIONS);
    expect(getPositionsForUnit(null)).toBe(FALLBACK_POSITIONS);
  });

  it('ALL_POSITIONS là danh sách đã khử trùng lặp và có sắp xếp', () => {
    const set = new Set(ALL_POSITIONS);
    expect(set.size).toBe(ALL_POSITIONS.length);
    const sorted = [...ALL_POSITIONS].sort();
    expect(ALL_POSITIONS).toEqual(sorted);
  });
});
