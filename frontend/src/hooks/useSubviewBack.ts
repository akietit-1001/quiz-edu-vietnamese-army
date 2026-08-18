import { useEffect, useRef } from 'react';

/**
 * Các "sub-view" trong trang (form sửa/tạo, modal chi tiết...) chỉ được
 * bật/tắt bằng state React, không có history entry riêng của trình duyệt —
 * vì vậy bấm nút Back sẽ bỏ qua sub-view và thoát thẳng ra trang trước đó
 * (VD: Dashboard) thay vì chỉ đóng sub-view và ở lại trang hiện tại.
 *
 * Hook này chèn thêm 1 history entry ngay khi sub-view mở, rồi bắt sự kiện
 * Back để đóng sub-view thay vì để trình duyệt điều hướng thật. Nếu sub-view
 * bị đóng bằng nút bấm (không phải Back), entry vừa chèn sẽ tự được dọn lại
 * để lịch sử trình duyệt không bị lệch.
 */
export function useSubviewBack(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      window.history.pushState({ __subview: true }, '');
      pushedRef.current = true;
    } else if (!isOpen && pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        onClose();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);
}
