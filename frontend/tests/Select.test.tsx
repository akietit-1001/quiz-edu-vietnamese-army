import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../src/components/Select';

function renderSelect(value: string, onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <Select value={value} onChange={onChange}>
        <option value="a">Chuyên ngành A</option>
        <option value="b">Chuyên ngành B</option>
        <option value="c" disabled>Chuyên ngành C (khoá)</option>
      </Select>
    )
  };
}

describe('Component: Select', () => {
  it('hiển thị đúng nhãn của option đang được chọn trên nút trigger', () => {
    renderSelect('b');
    expect(screen.getByRole('button')).toHaveTextContent('Chuyên ngành B');
  });

  it('bấm vào trigger -> mở panel, hiện đủ danh sách option', () => {
    renderSelect('a');
    fireEvent.click(screen.getByRole('button'));
    // "Chuyên ngành A" xuất hiện 2 lần: 1 lần trong nhãn trigger (đang được
    // chọn) + 1 lần trong panel option vừa mở ra.
    expect(screen.getAllByText('Chuyên ngành A')).toHaveLength(2);
    expect(screen.getByText('Chuyên ngành B')).toBeInTheDocument();
    expect(screen.getByText('Chuyên ngành C (khoá)')).toBeInTheDocument();
  });

  it('chọn 1 option -> gọi onChange đúng value và đóng panel lại', () => {
    const onChange = vi.fn();
    renderSelect('a', onChange);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Chuyên ngành B'));
    expect(onChange).toHaveBeenCalledWith('b');
    // panel đóng lại — option A (chỉ xuất hiện trong panel, không phải label trigger) không còn trong DOM
    expect(screen.queryByText('Chuyên ngành C (khoá)')).not.toBeInTheDocument();
  });

  it('option có disabled=true -> nút tương ứng trong panel bị vô hiệu hoá, không gọi được onChange', () => {
    const onChange = vi.fn();
    renderSelect('a', onChange);
    fireEvent.click(screen.getByRole('button'));
    const disabledOption = screen.getByText('Chuyên ngành C (khoá)').closest('button');
    expect(disabledOption).toBeDisabled();
  });

  it('disabled=true trên toàn Select -> bấm trigger KHÔNG mở panel', () => {
    render(
      <Select value="a" onChange={() => {}} disabled>
        <option value="a">Chuyên ngành A</option>
      </Select>
    );
    fireEvent.click(screen.getByRole('button'));
    // Panel không mở -> "Chuyên ngành A" chỉ còn đúng 1 lần (nhãn trên trigger),
    // không có bản sao thứ 2 từ option trong panel.
    expect(screen.getAllByText('Chuyên ngành A')).toHaveLength(1);
  });
});
