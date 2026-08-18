import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberStepper } from '../src/components/NumberStepper';

describe('Component: NumberStepper', () => {
  it('hiển thị đúng giá trị hiện tại trong ô input', () => {
    render(<NumberStepper value={5} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
  });

  it('bấm nút mũi tên lên gọi onChange(value + step)', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={5} onChange={onChange} step={2} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // nút tăng (▲) là nút đầu tiên trong DOM
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('bấm nút mũi tên xuống gọi onChange(value - step)', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={5} onChange={onChange} step={1} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // nút giảm (▼) là nút thứ hai
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('không cho giảm dưới min — clamp về đúng min', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={0} onChange={onChange} min={0} step={1} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('không cho tăng vượt max — clamp về đúng max', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={10} onChange={onChange} max={10} step={5} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('gõ trực tiếp vào ô input rỗng -> onChange(0), KHÔNG phải NaN', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={5} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('disabled=true -> cả input và 2 nút bấm đều bị vô hiệu hoá', () => {
    render(<NumberStepper value={5} onChange={() => {}} disabled />);
    expect(screen.getByRole('spinbutton')).toBeDisabled();
    screen.getAllByRole('button').forEach(btn => expect(btn).toBeDisabled());
  });
});
