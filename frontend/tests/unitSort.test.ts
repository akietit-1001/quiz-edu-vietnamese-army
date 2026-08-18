import { describe, it, expect } from 'vitest';
import { compareUnitSiblings } from '../src/constants/unitSort';

describe('unitSort: compareUnitSiblings', () => {
  it('"Ban Chỉ huy" luôn đứng đầu, bất kể thứ tự alphabet', () => {
    const units = [
      { name: 'Ban Tuyên huấn' },
      { name: 'Ban Chỉ huy' },
      { name: 'Ban Cán bộ' },
      { name: 'Ban Bảo vệ an ninh' }
    ];
    const sorted = [...units].sort(compareUnitSiblings);
    expect(sorted[0].name).toBe('Ban Chỉ huy');
    expect(sorted.slice(1).map(u => u.name)).toEqual(
      [...sorted.slice(1)].sort((a, b) => a.name.localeCompare(b.name)).map(u => u.name)
    );
  });

  it('không có "Ban Chỉ huy" -> sắp xếp alphabet như bình thường', () => {
    const units = [{ name: 'Ban Tuyên huấn' }, { name: 'Ban Cán bộ' }];
    const sorted = [...units].sort(compareUnitSiblings);
    expect(sorted.map(u => u.name)).toEqual(['Ban Cán bộ', 'Ban Tuyên huấn']);
  });

  it('nhiều đơn vị tên "Ban Chỉ huy" ở các cha khác nhau vẫn ổn định, không lỗi', () => {
    const units = [{ name: 'Ban Chỉ huy' }, { name: 'Ban Chỉ huy' }];
    expect(() => [...units].sort(compareUnitSiblings)).not.toThrow();
  });

  it('order thủ công luôn thắng, kể cả kéo "Ban Chỉ huy" xuống dưới', () => {
    const units = [
      { name: 'Ban Chỉ huy', order: 2 },
      { name: 'Ban Bảo vệ an ninh', order: 0 },
      { name: 'Ban Tuyên huấn', order: 1 }
    ];
    const sorted = [...units].sort(compareUnitSiblings);
    expect(sorted.map(u => u.name)).toEqual(['Ban Bảo vệ an ninh', 'Ban Tuyên huấn', 'Ban Chỉ huy']);
  });

  it('order bằng nhau (mặc định 0, chưa ai sắp xếp) -> rơi về quy tắc "Ban Chỉ huy" trước + alphabet', () => {
    const units = [
      { name: 'Ban Tuyên huấn', order: 0 },
      { name: 'Ban Chỉ huy', order: 0 },
      { name: 'Ban Cán bộ', order: 0 }
    ];
    const sorted = [...units].sort(compareUnitSiblings);
    expect(sorted.map(u => u.name)).toEqual(['Ban Chỉ huy', 'Ban Cán bộ', 'Ban Tuyên huấn']);
  });
});
