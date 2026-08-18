import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD' hoặc rỗng
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const parseISO = (iso: string) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
};

const toISO = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Custom datepicker đồng bộ giao diện quân sự (border/olive/gold, rounded-lg)
// thay cho <input type="date"> mặc định của trình duyệt (mỗi hệ điều hành vẽ
// popup lịch một kiểu khác nhau, không đồng bộ với theme của trang).
//
// Panel lịch được render qua portal vào document.body (position: fixed, toạ
// độ lấy từ getBoundingClientRect() của nút bấm) thay vì absolute lồng trong
// cây DOM — nếu không, ancestor có overflow-hidden/auto hoặc đang transition
// (VD: khung lọc nâng cao trượt xuống) sẽ cắt/vỡ hình panel khi xổ xuống.
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  id,
  name,
  required,
  placeholder = 'dd/mm/yyyy',
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const selected = parseISO(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState((selected?.m ?? today.getMonth() + 1) - 1); // 0-based
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const openPicker = () => {
    if (selected) {
      setViewYear(selected.y);
      setViewMonth(selected.m - 1);
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(true);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handlePickDay = (day: number) => {
    onChange(toISO(viewYear, viewMonth + 1, day));
    setIsOpen(false);
  };

  const handlePickToday = () => {
    onChange(toISO(today.getFullYear(), today.getMonth() + 1, today.getDate()));
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Lưới ngày: canh theo Thứ 2 đầu tuần, chèn ô trống cho những ngày thuộc
  // tháng trước/sau để giữ đúng cột thứ.
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=CN
  const leadingBlanks = (firstDayOfMonth + 6) % 7; // Quy về Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  const displayText = selected
    ? `${String(selected.d).padStart(2, '0')}/${String(selected.m).padStart(2, '0')}/${selected.y}`
    : '';

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  const isSelected = (day: number) =>
    !!selected && selected.y === viewYear && selected.m === viewMonth + 1 && selected.d === day;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        className={
          className ||
          'w-full text-xs p-2 pr-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold text-left rounded-lg'
        }
      >
        {displayText || <span className="text-gray-400">{placeholder}</span>}
      </button>
      <CalendarBlank size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vpa-olive-light pointer-events-none" />
      {required && <input type="hidden" name={name} value={value} required />}

      {isOpen && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[100] w-64 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg rounded-lg p-3 animate-scale-up"
            style={{ top: pos.top, left: pos.left }}
          >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 rounded-lg"
            >
              <CaretLeft size={12} weight="bold" />
            </button>
            <span className="text-[11px] font-bold uppercase text-vpa-olive dark:text-vpa-sand font-mono">
              Tháng {viewMonth + 1}, {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 rounded-lg"
            >
              <CaretRight size={12} weight="bold" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map(wd => (
              <span key={wd} className="text-[9px] text-center text-gray-400 uppercase font-mono py-1">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => (
              <button
                key={idx}
                type="button"
                disabled={day === null}
                onClick={() => day !== null && handlePickDay(day)}
                className={`text-[11px] h-7 flex items-center justify-center transition-colors rounded-lg ${
                  day === null
                    ? 'invisible'
                    : isSelected(day)
                    ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark font-bold'
                    : isToday(day)
                    ? 'border border-vpa-gold text-vpa-gold font-bold'
                    : 'text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-3 pt-2 border-t border-vpa-olive-light/20">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] uppercase font-bold text-vpa-red hover:underline"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={handlePickToday}
              className="text-[10px] uppercase font-bold text-vpa-gold hover:underline"
            >
              Hôm nay
            </button>
          </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default DatePicker;
