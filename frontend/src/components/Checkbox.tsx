import React from 'react';
import { Check } from '../icons';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  title?: string;
  className?: string;
}

// Ô tick tuỳ biến đồng bộ giao diện (border olive/gold, rounded, dấu Check
// từ phosphor-icons) thay cho <input type="checkbox"> mặc định — mỗi trình
// duyệt/hệ điều hành vẽ checkbox gốc rất khác nhau và khó tuỳ biến bằng CSS.
// Kích thước nút bấm lớn hơn hẳn ô vuông hiển thị để dễ bấm trúng hơn.
export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, title, className = '' }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      title={title}
      draggable={false}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-md cursor-pointer transition-colors ${className}`}
    >
      <span
        className={`w-3.5 h-3.5 flex items-center justify-center rounded border transition-colors ${
          checked
            ? 'bg-vpa-gold border-vpa-gold text-vpa-dark'
            : 'border-vpa-olive-light/60 bg-transparent hover:border-vpa-gold'
        }`}
      >
        {checked && <Check size={10} weight="bold" />}
      </span>
    </button>
  );
};
