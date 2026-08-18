import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '../src/components/Tooltip';

describe('Component: Tooltip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('luôn render children bất kể có tooltip hay không', () => {
    render(<Tooltip content="Nội dung đầy đủ">Text bị cắt...</Tooltip>);
    expect(screen.getByText('Text bị cắt...')).toBeInTheDocument();
  });

  it('content rỗng/falsy -> không gắn listener, không render panel dù hover', () => {
    render(<Tooltip content="">Text không có tooltip</Tooltip>);
    fireEvent.mouseEnter(screen.getByText('Text không có tooltip'));
    act(() => { vi.advanceTimersByTime(500); });
    // Không có đoạn text nội dung tooltip nào được thêm vào DOM ngoài children
    expect(document.body.textContent).toBe('Text không có tooltip');
  });

  it('hover vào wrapper -> SAU 300ms mới hiện panel tooltip (không hiện ngay lập tức)', () => {
    render(<Tooltip content="Nội dung đầy đủ của dòng bị cắt">Text bị cắt...</Tooltip>);
    fireEvent.mouseEnter(screen.getByText('Text bị cắt...'));

    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.queryByText('Nội dung đầy đủ của dòng bị cắt')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(250); }); // tổng 350ms > 300ms delay
    expect(screen.getByText('Nội dung đầy đủ của dòng bị cắt')).toBeInTheDocument();
  });

  it('rời chuột trước khi hết 300ms -> huỷ hẹn giờ, tooltip không bao giờ hiện', () => {
    render(<Tooltip content="Nội dung đầy đủ">Text bị cắt...</Tooltip>);
    const wrapper = screen.getByText('Text bị cắt...');
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(150); });
    fireEvent.mouseLeave(wrapper);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByText('Nội dung đầy đủ')).not.toBeInTheDocument();
  });

  it('rời chuột sau khi tooltip đã hiện -> ẩn tooltip ngay lập tức', () => {
    render(<Tooltip content="Nội dung đầy đủ">Text bị cắt...</Tooltip>);
    const wrapper = screen.getByText('Text bị cắt...');
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(350); });
    expect(screen.getByText('Nội dung đầy đủ')).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('Nội dung đầy đủ')).not.toBeInTheDocument();
  });
});
