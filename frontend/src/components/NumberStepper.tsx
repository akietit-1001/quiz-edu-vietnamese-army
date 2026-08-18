import React from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string; // classes cho khung ngoài (border/kích thước)
  inputClassName?: string; // classes cho riêng phần input bên trong
}

// Custom number stepper đồng bộ giao diện quân sự (border/olive/gold,
// rounded-lg) thay cho mũi tên lên/xuống mặc định rất khác nhau giữa các
// trình duyệt/hệ điều hành của <input type="number">.
export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  id,
  required,
  disabled,
  className,
  inputClassName
}) => {
  const clamp = (n: number) => {
    let v = n;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const handleStep = (dir: 1 | -1) => {
    const base = Number.isFinite(value) ? value : (min ?? 0);
    onChange(clamp(base + dir * step));
  };

  return (
    <div
      className={
        className ||
        'flex items-stretch w-full border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden'
      }
    >
      <input
        type="number"
        id={id}
        required={required}
        disabled={disabled}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={
          inputClassName ||
          'w-full min-w-0 text-xs p-2 bg-transparent text-vpa-olive dark:text-vpa-sand focus:outline-none'
        }
      />
      <div className="flex flex-col border-l border-vpa-olive-light shrink-0">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => handleStep(1)}
          className="flex-1 px-1.5 flex items-center justify-center text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors border-b border-vpa-olive-light leading-none disabled:opacity-40"
        >
          <CaretUp size={9} weight="bold" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => handleStep(-1)}
          className="flex-1 px-1.5 flex items-center justify-center text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors leading-none disabled:opacity-40"
        >
          <CaretDown size={9} weight="bold" />
        </button>
      </div>
    </div>
  );
};

export default NumberStepper;
