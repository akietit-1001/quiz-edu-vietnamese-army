import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, Check } from '@phosphor-icons/react';

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode; // <option> elements, giống hệt <select> gốc
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface OptionEntry {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

// Đọc props.value/children/disabled từ các <option> con — component chỉ dùng
// chúng làm nguồn dữ liệu, không render <option> DOM thật nào cả.
const extractOptions = (children: React.ReactNode): OptionEntry[] => {
  const entries: OptionEntry[] = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    entries.push({
      value: props.value ?? '',
      label: props.children,
      disabled: props.disabled
    });
  });
  return entries;
};

// Custom dropdown đồng bộ giao diện quân sự (border/olive/gold, rounded-lg,
// hover/selected rõ ràng) thay cho <select> mặc định — mỗi trình duyệt/hệ
// điều hành vẽ danh sách option và trạng thái hover rất khác nhau, không thể
// tuỳ biến bằng CSS.
//
// Panel option được render qua portal vào document.body (position: fixed,
// toạ độ lấy từ getBoundingClientRect() của nút bấm) thay vì absolute lồng
// trong cây DOM — nếu không, bất kỳ ancestor nào có overflow-hidden/auto
// hoặc đang transition (VD: khung lọc nâng cao trượt xuống) sẽ cắt/vỡ hình
// panel khi xổ xuống.
export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  children,
  id,
  required,
  disabled,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const options = extractOptions(children);
  const selected = options.find(o => o.value === value);

  const openDropdown = () => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    // Cuộn TRANG (hoặc ancestor khác) mới đóng dropdown vì toạ độ fixed lúc
    // đó lệch khỏi nút bấm — cuộn ngay TRONG danh sách option (panelRef) thì
    // bỏ qua, không thì không bao giờ lăn chuột xem hết được danh sách dài.
    const handleScroll = (e: Event) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    const handleResize = () => setIsOpen(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        className={
          className ||
          'w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
        }
      >
        <span className="truncate text-left">{selected ? selected.label : ''}</span>
        <CaretDown
          size={11}
          weight="bold"
          className={`shrink-0 text-vpa-olive-light transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {required && <input type="hidden" required value={value} onChange={() => {}} />}

      {isOpen && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setIsOpen(false)} />
          <div
            ref={panelRef}
            className="fixed z-[100] max-h-64 overflow-y-auto overflow-x-hidden border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg rounded-lg animate-scale-up"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={opt.disabled}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed ${
                  opt.value === value
                    ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark font-bold'
                    : 'text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={12} weight="bold" className="shrink-0" />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Select;
