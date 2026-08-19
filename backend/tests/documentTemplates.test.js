import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { generateQuizDOCX, createPageNumberSection } from '../utils/documentTemplates.js';

describe('createPageNumberSection', () => {
  it('vị trí "bottom-*" -> trả về footers, không có headers', () => {
    const result = createPageNumberSection('bottom-center');
    expect(result.footers).toBeDefined();
    expect(result.headers).toBeUndefined();
  });

  it('vị trí "top-*" -> trả về headers, không có footers', () => {
    const result = createPageNumberSection('top-left');
    expect(result.headers).toBeDefined();
    expect(result.footers).toBeUndefined();
  });

  it('vị trí không hợp lệ/undefined -> vẫn không throw, mặc định về footer', () => {
    expect(() => createPageNumberSection(undefined)).not.toThrow();
    const result = createPageNumberSection('linh-tinh');
    expect(result.footers).toBeDefined();
  });
});

describe('generateQuizDOCX: số trang', () => {
  const fakeQuiz = {
    title: 'Đề test',
    duration: 30,
    examCode: '001',
    questions: [
      { questionType: 'multiple-choice', questionText: 'Câu hỏi 1?', options: ['A', 'B', 'C', 'D'], correctAnswers: ['0'] },
      { questionType: 'fill-in-the-blank', questionText: 'Câu hỏi 2?', correctAnswers: ['đáp án'] }
    ]
  };
  const fakeAdmin = { position: 'Trưởng phòng', rank: 'Đại tá', fullName: 'Nguyễn Văn A' };

  it('showPageNumber = true (mặc định) -> vẫn tạo được file .docx hợp lệ, không lỗi', async () => {
    const doc = generateQuizDOCX(
      fakeQuiz, fakeAdmin, 'BỘ QUỐC PHÒNG', 'ĐƠN VỊ TEST', 'Đồng Tháp', 'Trưởng phòng',
      true, 'Đại tá', 'Nguyễn Văn A', 2.5, 2.0, 3.0, 1.5, 'portrait', false,
      true, 'bottom-center'
    );
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('showPageNumber = false -> vẫn tạo được file .docx hợp lệ, không lỗi', async () => {
    const doc = generateQuizDOCX(
      fakeQuiz, fakeAdmin, 'BỘ QUỐC PHÒNG', 'ĐƠN VỊ TEST', 'Đồng Tháp', 'Trưởng phòng',
      true, 'Đại tá', 'Nguyễn Văn A', 2.5, 2.0, 3.0, 1.5, 'portrait', false,
      false, 'bottom-center'
    );
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('vị trí số trang ở đầu trang (top-right) -> vẫn tạo được file hợp lệ', async () => {
    const doc = generateQuizDOCX(
      fakeQuiz, fakeAdmin, 'BỘ QUỐC PHÒNG', 'ĐƠN VỊ TEST', 'Đồng Tháp', 'Trưởng phòng',
      true, 'Đại tá', 'Nguyễn Văn A', 2.5, 2.0, 3.0, 1.5, 'portrait', true,
      true, 'top-right'
    );
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('không truyền showPageNumber/pageNumberPosition -> dùng mặc định (bật, cuối-giữa), không lỗi', async () => {
    const doc = generateQuizDOCX(
      fakeQuiz, fakeAdmin, 'BỘ QUỐC PHÒNG', 'ĐƠN VỊ TEST', 'Đồng Tháp', 'Trưởng phòng',
      true, 'Đại tá', 'Nguyễn Văn A', 2.5, 2.0, 3.0, 1.5, 'portrait', false
    );
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
