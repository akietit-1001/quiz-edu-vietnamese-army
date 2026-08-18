import { useEffect, useState } from 'react';

/**
 * Trì hoãn việc phản ánh `value` mới trong `delayMs` — dùng cho các ô tìm
 * kiếm gõ tự do (search, tên người soạn, mã chia sẻ...) để tránh bắn 1
 * request server cho mỗi phím gõ. Input vẫn bind vào state gốc (gõ mượt,
 * không giật), chỉ giá trị debounce trả về mới dùng để gọi API.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
