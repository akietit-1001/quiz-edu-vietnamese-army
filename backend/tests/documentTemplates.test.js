import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { generateQuizDOCX, createPageNumberSection, PAPER_SIZES } from '../utils/documentTemplates.js';

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
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, {
      upperUnit: 'BỘ QUỐC PHÒNG', currentUnit: 'ĐƠN VỊ TEST', province: 'Đồng Tháp', position: 'Trưởng phòng',
      showSignature: true, signerRank: 'Đại tá', signerName: 'Nguyễn Văn A',
      showPageNumber: true, pageNumberPosition: 'bottom-center'
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('showPageNumber = false -> vẫn tạo được file .docx hợp lệ, không lỗi', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, {
      upperUnit: 'BỘ QUỐC PHÒNG', currentUnit: 'ĐƠN VỊ TEST', province: 'Đồng Tháp', position: 'Trưởng phòng',
      showSignature: true, signerRank: 'Đại tá', signerName: 'Nguyễn Văn A',
      showPageNumber: false, pageNumberPosition: 'bottom-center'
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('vị trí số trang ở đầu trang (top-right) -> vẫn tạo được file hợp lệ', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, {
      upperUnit: 'BỘ QUỐC PHÒNG', currentUnit: 'ĐƠN VỊ TEST', province: 'Đồng Tháp', position: 'Trưởng phòng',
      showSignature: true, signerRank: 'Đại tá', signerName: 'Nguyễn Văn A', includeAnswers: true,
      showPageNumber: true, pageNumberPosition: 'top-right'
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('không truyền options -> dùng mặc định (bật, cuối-giữa, A4), không lỗi', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin);
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('pageNumberShowLabel = false -> vẫn tạo được file hợp lệ (bỏ chữ "Trang")', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, { pageNumberShowLabel: false });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('pageNumberShowTotal = false -> vẫn tạo được file hợp lệ (chỉ hiện trang hiện tại)', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, { pageNumberShowTotal: false });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(PAPER_SIZES))('paperSize = %s -> vẫn tạo được file hợp lệ', async (paperSize) => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, { paperSize, orientation: 'landscape' });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('paperSize không hợp lệ -> rơi về A4, không throw', async () => {
    const doc = generateQuizDOCX(fakeQuiz, fakeAdmin, { paperSize: 'khong-ton-tai' });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
