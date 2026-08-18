import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string; // classes cho wrapper (VD: truncate, min-w-0, block...)
}

// Tooltip tự vẽ đồng bộ giao diện quân sự (border/olive/gold, rounded-lg) —
// thay cho title="" mặc định của trình duyệt (chậm hiện, không tuỳ biến
// được, mỗi hệ điều hành vẽ một kiểu). Dùng để hiện đầy đủ nội dung khi
// hover vào dòng chữ bị cắt (truncate/line-clamp).
//
// Panel được render qua portal vào document.body (position: fixed, toạ độ
// lấy từ getBoundingClientRect() của phần tử bọc) — giống DatePicker/Select
// — để không bị ancestor overflow-hidden/scroll cắt mất.
export const Tooltip: React.FC<TooltipProps> = ({ content, children, className }) => {
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const placement: 'top' | 'bottom' = rect.top > 60 ? 'top' : 'bottom';
      setPos({
        top: placement === 'top' ? rect.top - 6 : rect.bottom + 6,
        left: rect.left + rect.width / 2,
        placement
      });
    }, 300);
  };

  const hide = () => {
    clearTimer();
    setPos(null);
  };

  if (!content) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      ref={wrapperRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && createPortal(
        <div
          className={`fixed z-[200] max-w-xs px-2.5 py-1.5 text-[10px] leading-relaxed border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand shadow-lg rounded-lg pointer-events-none animate-fadeIn ${
            pos.placement === 'top' ? '-translate-x-1/2 -translate-y-full' : '-translate-x-1/2'
          }`}
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  );
};

export default Tooltip;
