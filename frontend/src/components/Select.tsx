import React, { useEffect, useRef, useState } from 'react';
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const options = extractOptions(children);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(o => !o)}
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

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-lg rounded-lg py-1 animate-scale-up">
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
      )}
    </div>
  );
};

export default Select;
