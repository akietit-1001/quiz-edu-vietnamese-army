import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';

describe('Hook: useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trả về giá trị ban đầu ngay lập tức khi mới mount', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 350));
    expect(result.current).toBe('a');
  });

  it('KHÔNG cập nhật ngay khi value đổi — vẫn giữ giá trị cũ trước khi hết delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'a' }
    });
    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(200); }); // chưa đủ 350ms
    expect(result.current).toBe('a');
  });

  it('cập nhật đúng giá trị mới sau khi hết delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'a' }
    });
    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(350); });
    expect(result.current).toBe('ab');
  });

  it('gõ liên tục (nhiều lần đổi value trước khi hết delay) -> chỉ debounce 1 lần cho giá trị CUỐI CÙNG', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'a' }
    });
    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'abc' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'abcd' });
    // Tổng thời gian trôi qua > 350ms nhưng KHÔNG có lần gõ nào đứng yên đủ
    // 350ms liên tục — giá trị debounce vẫn phải là 'a' (giá trị ban đầu),
    // vì mỗi lần gõ mới đều reset lại bộ đếm thời gian (clearTimeout trong cleanup).
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(150); }); // đủ 350ms tính từ lần gõ cuối ('abcd')
    expect(result.current).toBe('abcd');
  });
});
