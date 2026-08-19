import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const formatDisplay = (iso: string) => {
  const parsed = parseISO(iso);
  if (!parsed) return '';
  return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
};

// Chấp nhận gõ tay dd/mm/yyyy — chỉ coi là hợp lệ khi đủ 3 phần và tạo được
// đúng ngày đó thật (chặn kiểu 31/02/2026 tự động lăn sang tháng 3).
const parseDisplay = (text: string) => {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const test = new Date(y, m - 1, d);
  if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) return null;
  return { y, m, d };
};

// Custom datepicker đồng bộ giao diện quân sự (border/olive/gold, rounded-lg)
// thay cho <input type="date"> mặc định của trình duyệt — vừa gõ tay
// dd/mm/yyyy được, vừa chọn trên lịch, cả hai luôn khớp nhau.
//
// Panel lịch được render qua portal vào document.body (position: fixed, toạ
// độ lấy từ getBoundingClientRect() của ô nhập) thay vì absolute lồng trong
// cây DOM — nếu không, ancestor có overflow-hidden/auto hoặc đang transition
// (VD: khung lọc nâng cao trượt xuống) sẽ cắt/vỡ hình panel khi xổ xuống.
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  id,
  name,
  required,
  placeholder = 'dd/mm/yyyy',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [text, setText] = useState(() => formatDisplay(value));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const selected = parseISO(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState((selected?.m ?? today.getMonth() + 1) - 1); // 0-based
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [animKey, setAnimKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Lưu rect của input tại lúc mở để dùng khi reposition sau đổi tháng.
  const inputRectRef = useRef<DOMRect | null>(null);
  // Refs để wheel handler không bị stale closure — effect chỉ gắn 1 lần khi isOpen.
  const viewMonthRef = useRef(viewMonth);
  const viewYearRef = useRef(viewYear);
  viewMonthRef.current = viewMonth;
  viewYearRef.current = viewYear;

  // Đồng bộ lại ô nhập mỗi khi value đổi từ bên ngoài (chọn ngày trên lịch,
  // "Hôm nay", "Xóa", reset form...) — trừ khi người dùng đang gõ dở.
  useEffect(() => {
    if (!isFocused) setText(formatDisplay(value));
  }, [value, isFocused]);

  // Đóng panel khi cuộn ngoài panel / thay đổi kích thước / nhấn Escape.
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      // Bỏ qua scroll event xuất phát từ bên trong panel (wheel đã preventDefault
      // nhưng một số trình duyệt vẫn bắn scroll trên container cha) để tránh
      // đóng nhầm khi người dùng lăn chuột trên lịch.
      if (e.type === 'scroll' && panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Căn chỉnh vị trí panel sau mỗi lần render (kể cả khi đổi tháng).
  //
  // Số hàng tuần trong lịch thay đổi theo tháng (4–6 hàng) → chiều cao panel
  // không cố định. Nếu chỉ tính vị trí 1 lần lúc mở, tháng có 6 hàng sẽ tràn
  // đáy viewport. useLayoutEffect chạy đồng bộ trước khi browser vẽ, đảm bảo
  // không có flash vị trí — người dùng không thấy panel nhảy.
  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current || !inputRectRef.current) return;
    const panelRect = panelRef.current.getBoundingClientRect();
    const inp = inputRectRef.current;
    const vH = window.innerHeight;
    const vW = window.innerWidth;

    // Ưu tiên mở xuống dưới input; lật lên trên nếu tràn đáy.
    let top = inp.bottom + 4;
    if (top + panelRect.height > vH - 8) {
      const flipped = inp.top - panelRect.height - 4;
      top = flipped >= 8 ? flipped : Math.max(8, vH - panelRect.height - 8);
    }
    // Điều chỉnh chiều ngang tránh tràn cạnh màn hình.
    let left = inp.left;
    if (left + panelRect.width > vW - 8) left = vW - panelRect.width - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, [isOpen, viewMonth, viewYear]);

  // Gắn wheel listener non-passive trực tiếp qua ref — React synthetic onWheel
  // là passive mặc định nên preventDefault() không ngăn được trang cuộn. Dùng
  // refs cho viewMonth/viewYear để effect chỉ cần gắn/gỡ 1 lần khi isOpen đổi
  // (không phải mỗi lần đổi tháng) mà vẫn đọc đúng giá trị hiện tại.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isOpen) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = viewMonthRef.current;
      const y = viewYearRef.current;
      if (e.deltaY < 0) {
        setSlideDir('right');
        setAnimKey(k => k + 1);
        if (m === 0) { setViewMonth(11); setViewYear(y - 1); }
        else setViewMonth(m - 1);
      } else {
        setSlideDir('left');
        setAnimKey(k => k + 1);
        if (m === 11) { setViewMonth(0); setViewYear(y + 1); }
        else setViewMonth(m + 1);
      }
    };
    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, [isOpen]); // chỉ phụ thuộc isOpen nhờ dùng refs

  const openPicker = () => {
    if (selected) {
      setViewYear(selected.y);
      setViewMonth(selected.m - 1);
    }
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      inputRectRef.current = rect;
      // Ước lượng ban đầu — useLayoutEffect sẽ hiệu chỉnh lại sau render.
      const panelW = 256;
      const panelHEst = 320;
      const vW = window.innerWidth;
      const vH = window.innerHeight;
      const top = vH - rect.bottom < panelHEst && rect.top > panelHEst
        ? Math.max(8, rect.top - panelHEst - 4)
        : rect.bottom + 4;
      let left = rect.left;
      if (left + panelW > vW - 8) left = vW - panelW - 8;
      if (left < 8) left = 8;
      setPos({ top, left });
    }
    setIsOpen(true);
  };

  const handleFocus = () => { setIsFocused(true); openPicker(); };
  const handleBlur  = () => { setIsFocused(false); setText(formatDisplay(value)); };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseDisplay(raw);
    if (parsed) {
      onChange(toISO(parsed.y, parsed.m, parsed.d));
      setViewYear(parsed.y);
      setViewMonth(parsed.m - 1);
    }
  };

  const goToPrevMonth = () => {
    setSlideDir('right');
    setAnimKey(k => k + 1);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNextMonth = () => {
    setSlideDir('left');
    setAnimKey(k => k + 1);
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
  const handleClear = () => { onChange(''); setIsOpen(false); };

  // Lưới ngày: canh theo Thứ 2 đầu tuần, chèn ô trống cho những ngày thuộc
  // tháng trước/sau để giữ đúng cột thứ.
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=CN
  const leadingBlanks = (firstDayOfMonth + 6) % 7; // Quy về Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  const isSelected = (day: number) =>
    !!selected && selected.y === viewYear && selected.m === viewMonth + 1 && selected.d === day;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        required={required}
        autoComplete="off"
        inputMode="numeric"
        value={text}
        onChange={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={
          className ||
          'w-full text-xs p-2 pr-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg'
        }
      />
      <CalendarBlank size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vpa-olive-light pointer-events-none" />

      {isOpen && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setIsOpen(false)} />
          <div
            ref={panelRef}
            className="fixed z-[100] w-64 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg rounded-lg p-3 animate-scale-up"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Header tháng/năm */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="p-1 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 rounded-lg transition-colors"
              >
                <CaretLeft size={12} weight="bold" />
              </button>
              <span className="text-[11px] font-bold uppercase text-vpa-olive dark:text-vpa-sand font-mono select-none">
                Tháng {viewMonth + 1}, {viewYear}
              </span>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-1 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 rounded-lg transition-colors"
              >
                <CaretRight size={12} weight="bold" />
              </button>
            </div>

            {/* Tiêu đề thứ — tĩnh, không animate */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS.map(wd => (
                <span key={wd} className="text-[9px] text-center text-gray-400 uppercase font-mono py-1 select-none">
                  {wd}
                </span>
              ))}
            </div>

            {/* Lưới ngày — trượt theo hướng khi đổi tháng.
                key={animKey} ép React unmount/mount lại khối này mỗi lần đổi
                tháng, kích hoạt lại CSS animation từ đầu. */}
            <div
              key={animKey}
              className={`grid grid-cols-7 gap-0.5 overflow-hidden ${slideDir === 'left' ? 'dp-slide-left' : 'dp-slide-right'}`}
            >
              {cells.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={day === null}
                  onClick={() => day !== null && handlePickDay(day)}
                  className={`text-[11px] aspect-square flex items-center justify-center transition-colors rounded-lg ${
                    day === null
                      ? 'invisible'
                      : isSelected(day)
                      ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark font-bold'
                      : isToday(day)
                      ? 'bg-vpa-gold dark:bg-vpa-gold-bright text-vpa-dark font-bold'
                      : 'text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Footer */}
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
