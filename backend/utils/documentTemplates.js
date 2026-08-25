import { Document, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageOrientation, Header, Footer, PageNumber } from 'docx';
import ExcelJS from 'exceljs';

const PAGE_NUMBER_ALIGNMENT = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT
};

// Khổ giấy theo twips (1cm ≈ 567 twips), dạng PORTRAIT — đổi sang LANDSCAPE
// bằng cách hoán width/height khi dùng.
export const PAPER_SIZES = {
  A4: { width: 11906, height: 16838 },
  A5: { width: 8391, height: 11907 },
  letter: { width: 12240, height: 15840 },
  legal: { width: 12240, height: 20160 }
};

// "Trang X/Y" dùng field PAGE/NUMPAGES thật của Word (tự cập nhật khi mở/in,
// không phải text tĩnh) — đặt ở header hay footer, căn trái/giữa/phải tuỳ
// `position` dạng "top-left" | "top-center" | "top-right" | "bottom-left" |
// "bottom-center" | "bottom-right". `showLabel` = có chữ "Trang " trước số
// hay không; `showTotal` = có "/tổng số trang" hay chỉ hiện trang hiện tại.
// Trả về object để spread thẳng vào `sections[0]` của Document (chỉ có đúng
// 1 trong 2 khoá headers/footers).
export const createPageNumberSection = (position = 'bottom-center', showLabel = true, showTotal = true) => {
  const [vSide, hSide] = String(position).split('-');
  const alignment = PAGE_NUMBER_ALIGNMENT[hSide] || AlignmentType.CENTER;
  const children = [];
  if (showLabel) {
    children.push(new TextRun({ text: 'Trang ', size: 18, font: 'Times New Roman' }));
  }
  children.push(new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Times New Roman' }));
  if (showTotal) {
    children.push(new TextRun({ text: '/', size: 18, font: 'Times New Roman' }));
    children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Times New Roman' }));
  }
  const paragraph = new Paragraph({ alignment, children });
  return vSide === 'top'
    ? { headers: { default: new Header({ children: [paragraph] }) } }
    : { footers: { default: new Footer({ children: [paragraph] }) } };
};

const MARGIN_PRESETS = {
  normal: { top: 1134, bottom: 1134, left: 1701, right: 1134 }, // Top 2.0cm, Bottom 2.0cm, Left 3.0cm, Right 2.0cm
  narrow: { top: 850, bottom: 850, left: 1134, right: 850 },   // Top 1.5cm, Bottom 1.5cm, Left 2.0cm, Right 1.5cm
  wide: { top: 1417, bottom: 1417, left: 1984, right: 1417 },   // Top 2.5cm, Bottom 2.5cm, Left 3.5cm, Right 2.5cm
};


/**
 * Helper to generate official VPA header section for docx documents
 * @param {string} upperUnit 
 * @param {string} currentUnit 
 * @param {string} province 
 * @returns {Table} A Table containing the standard header
 */
const createVPAHeader = (upperUnit = 'BỘ QUỐC PHÒNG', currentUnit = 'ĐƠN VỊ THI', province = 'Đồng Tháp') => {
  const dateStr = `${province}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;
  
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: upperUnit.toUpperCase(), size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: currentUnit.toUpperCase(), bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '---------', bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '-----------------------', bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: dateStr, italics: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

/**
 * Helper to generate the signature block at the bottom right of the docx document
 * @param {string} position 
 * @param {string} rank 
 * @param {string} name 
 * @returns {Table}
 */
const createVPASignature = (position = 'TRƯỞNG PHÒNG ĐÀO TẠO', rank = 'Đại tá', name = 'Nguyễn Văn A') => {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: position.toUpperCase(), bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 20, font: 'Times New Roman' }),
                ],
              }),
              // 4 empty lines for signature spacing
              new Paragraph({ children: [] }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [] }),
              new Paragraph({ children: [] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${rank} ${name}`, bold: true, size: 24, font: 'Times New Roman' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

/**
 * Generates a DOCX document for a quiz (Question Paper)
 */
export const generateQuizDOCX = (quiz, adminUser, options = {}) => {
  const {
    upperUnit, currentUnit, province, position,
    showSignature = true, signerRank, signerName,
    marginTop = 2.5, marginBottom = 2.0, marginLeft = 3.0, marginRight = 1.5,
    orientation = 'portrait', includeAnswers = false,
    showPageNumber = true, pageNumberPosition = 'bottom-center',
    pageNumberShowLabel = true, pageNumberShowTotal = true,
    paperSize = 'A4'
  } = options;
  const finalPosition = position || adminUser.position || 'TRƯỞNG PHÒNG ĐÀO TẠO';
  const finalRank = signerRank || adminUser.rank || 'Đại tá';
  const finalName = signerName || adminUser.fullName || 'Nguyễn Văn A';

  const paragraphs = [
    createVPAHeader(upperUnit, currentUnit, province),
    new Paragraph({ children: [] }), // spacer
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'ĐỀ THI TRẮC NGHIỆM', bold: true, size: 32, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `MÔN: ${quiz.title.toUpperCase()}`, bold: true, size: 28, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Thời gian làm bài: ${quiz.duration} phút (Không kể thời gian giao đề)`, italics: true, size: 24, font: 'Times New Roman' }),
      ],
    }),
    ...(quiz.examCode ? [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `Mã đề thi: ${quiz.examCode}`, bold: true, size: 24, font: 'Times New Roman' }),
        ],
      })
    ] : []),
    new Paragraph({ children: [] }), // spacer
  ];

  // Add questions
  quiz.questions.forEach((q, index) => {
    // Question title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Câu ${index + 1}: ${q.questionText}`, bold: true, size: 24, font: 'Times New Roman' }),
        ],
      })
    );

    // Question options
    if (q.questionType === 'multiple-choice' || q.questionType === 'true-false') {
      q.options.forEach((opt, oIdx) => {
        const prefix = String.fromCharCode(65 + oIdx); // A, B, C, D...
        paragraphs.push(
          new Paragraph({
            indent: { left: 720 }, // Indent options
            children: [
              new TextRun({ text: `${prefix}. ${opt}`, size: 24, font: 'Times New Roman' }),
            ],
          })
        );
      });
    } else if (q.questionType === 'fill-in-the-blank') {
      paragraphs.push(
        new Paragraph({
          indent: { left: 720 },
          children: [
            new TextRun({ text: 'Đáp án: ....................................................................................', size: 24, font: 'Times New Roman' }),
          ],
        })
      );
    }
    paragraphs.push(new Paragraph({ children: [] })); // line break between questions
  });

  if (showSignature) {
    paragraphs.push(new Paragraph({ children: [] }));
    paragraphs.push(createVPASignature(finalPosition, finalRank, finalName));
  }

  // Trang riêng "BẢNG ĐÁP ÁN" ở cuối văn bản — không chèn đáp án xen kẽ vào đề
  if (includeAnswers) {
    paragraphs.push(new Paragraph({ children: [], pageBreakBefore: true }));
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'BẢNG ĐÁP ÁN', bold: true, size: 28, font: 'Times New Roman' }),
        ],
      })
    );
    if (quiz.examCode) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `Mã đề thi: ${quiz.examCode}`, bold: true, italics: true, size: 24, font: 'Times New Roman' }),
          ],
        })
      );
    }
    paragraphs.push(new Paragraph({ children: [] }));

    const answerLabel = (q) => {
      if (q.questionType === 'fill-in-the-blank') {
        return (q.correctAnswers || []).join(' / ') || '—';
      }
      const letters = (q.correctAnswers || [])
        .map((a) => String.fromCharCode(65 + parseInt(a, 10)))
        .filter(Boolean);
      return letters.join('/') || '—';
    };

    const columns = 5;
    const answerCells = quiz.questions.map((q, idx) =>
      new TableCell({
        width: { size: 100 / columns, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          right: { style: BorderStyle.SINGLE, size: 2, color: '999999' }
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Câu ${idx + 1}: `, size: 22, font: 'Times New Roman' }),
              new TextRun({ text: answerLabel(q), bold: true, size: 22, font: 'Times New Roman' }),
            ],
          })
        ]
      })
    );

    const answerRows = [];
    for (let i = 0; i < answerCells.length; i += columns) {
      let rowCells = answerCells.slice(i, i + columns);
      // Pad the last row with empty cells so the table stays aligned
      while (rowCells.length < columns) {
        rowCells = [...rowCells, new TableCell({ width: { size: 100 / columns, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] })];
      }
      answerRows.push(new TableRow({ children: rowCells }));
    }

    paragraphs.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: answerRows
      })
    );
  }

  const marginPreset = {
    top: Math.round(parseFloat(marginTop) * 567),
    bottom: Math.round(parseFloat(marginBottom) * 567),
    left: Math.round(parseFloat(marginLeft) * 567),
    right: Math.round(parseFloat(marginRight) * 567)
  };
  const preset = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const pageSize = orientation === 'landscape'
    ? { width: preset.height, height: preset.width, orientation: PageOrientation.LANDSCAPE }
    : { width: preset.width, height: preset.height, orientation: PageOrientation.PORTRAIT };

  return new Document({
    // Word cache field PAGE/NUMPAGES từ lần lưu trước, dẫn tới hiện "1" dù
    // file thật có nhiều trang — updateFields buộc Word tính lại khi mở.
    features: { updateFields: true },
    sections: [
      {
        properties: {
          page: {
            margin: marginPreset,
            size: pageSize,
          },
        },
        ...(showPageNumber ? createPageNumberSection(pageNumberPosition, pageNumberShowLabel, pageNumberShowTotal) : {}),
        children: paragraphs,
      },
    ],
  });
};

/**
 * Generates a DOCX document for Exam Results Report
 */
export const generateResultsDOCX = (room, results, adminUser, upperUnit, currentUnit, province, position, showSignature = true, signerRank, signerName, marginTop = 2.5, marginBottom = 2.0, marginLeft = 3.0, marginRight = 1.5, orientation = 'portrait') => {
  const finalPosition = position || adminUser.position || 'TRƯỞNG PHÒNG ĐÀO TẠO';
  const finalRank = signerRank || adminUser.rank || 'Đại tá';
  const finalName = signerName || adminUser.fullName || 'Nguyễn Văn A';

  const tableHeaderRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Họ và tên", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Cấp bậc", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đơn vị", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Số câu đúng", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tỷ lệ (%)", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Kết quả", bold: true, font: 'Times New Roman' })] })] }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Xếp loại", bold: true, font: 'Times New Roman' })] })] })
    ]
  });

  const tableRows = [tableHeaderRow];

  results.forEach(res => {
    const correctRatio = Math.round((res.score / res.totalQuestions) * 100);
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.userId.fullName, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.userId.rank || 'Binh nhì', font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.userId.unitId?.name || '', font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${res.score}/${res.totalQuestions}`, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${correctRatio}%`, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.isPassed ? "ĐẠT" : "KHÔNG ĐẠT", bold: true, font: 'Times New Roman' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.rank, font: 'Times New Roman' })] })] })
        ]
      })
    );
  });

  const resultsTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    rows: tableRows
  });

  const paragraphs = [
    createVPAHeader(upperUnit, currentUnit, province),
    new Paragraph({ children: [] }), // spacer
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'BÁO CÁO KẾT QUẢ THI', bold: true, size: 32, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `PHÒNG THI: ${room.roomCode} - ĐỀ THI: ${room.quizId.title.toUpperCase()}`, bold: true, size: 24, font: 'Times New Roman' }),
      ],
    }),
    new Paragraph({ children: [] }), // spacer
    resultsTable,
    new Paragraph({ children: [] }), // spacer
    new Paragraph({ children: [] }), // spacer
  ];

  if (showSignature) {
    paragraphs.push(createVPASignature(finalPosition, finalRank, finalName));
  }

  const marginPreset = {
    top: Math.round(parseFloat(marginTop) * 567),
    bottom: Math.round(parseFloat(marginBottom) * 567),
    left: Math.round(parseFloat(marginLeft) * 567),
    right: Math.round(parseFloat(marginRight) * 567)
  };
  const pageSize = orientation === 'landscape'
    ? { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE }
    : { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: marginPreset,
            size: pageSize,
          },
        },
        children: paragraphs,
      },
    ],
  });
};

const XLSX_THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FF999999' } },
  bottom: { style: 'thin', color: { argb: 'FF999999' } },
  left: { style: 'thin', color: { argb: 'FF999999' } },
  right: { style: 'thin', color: { argb: 'FF999999' } }
};

/**
 * Generates an XLSX report (workbook) for Exam Results — cùng cấu trúc quốc
 * hiệu/tiêu ngữ, tiêu đề báo cáo và chữ ký như bản DOCX (generateResultsDOCX),
 * chỉ khác định dạng bảng tính. Trả về ExcelJS.Workbook, gọi
 * `workbook.xlsx.writeBuffer()` ở nơi dùng để lấy buffer.
 */
export const generateResultsXLSX = async (room, results, adminUser, upperUnit, currentUnit, province, position, showSignature = true, signerRank, signerName) => {
  const finalPosition = (position || adminUser.position || 'TRƯỞNG PHÒNG ĐÀO TẠO').toUpperCase();
  const finalRank = signerRank || adminUser.rank || 'Đại tá';
  const finalName = signerName || adminUser.fullName || 'Nguyễn Văn A';
  const dateStr = `${province || 'Đồng Tháp'}, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ket_qua_thi', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const COLS = 10; // Họ và tên, Gmail, Cấp bậc, Chức vụ, Đơn vị, Số câu đúng, Tỷ lệ (%), Kết quả, Xếp loại, Vi phạm chuyển tab
  sheet.columns = [
    { width: 24 }, { width: 24 }, { width: 12 }, { width: 16 }, { width: 20 },
    { width: 13 }, { width: 11 }, { width: 13 }, { width: 11 }, { width: 16 }
  ];

  const mergeText = (rowIdx, startCol, endCol, text, { bold = false, italic = false, size = 12 } = {}) => {
    sheet.mergeCells(rowIdx, startCol, rowIdx, endCol);
    const cell = sheet.getCell(rowIdx, startCol);
    cell.value = text;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.font = { name: 'Times New Roman', size, bold, italic };
    return cell;
  };

  let r = 1;
  mergeText(r, 1, 4, (upperUnit || 'BỘ QUỐC PHÒNG').toUpperCase());
  mergeText(r, 5, COLS, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true });
  r++;
  mergeText(r, 1, 4, (currentUnit || 'ĐƠN VỊ THI').toUpperCase(), { bold: true });
  mergeText(r, 5, COLS, 'Độc lập - Tự do - Hạnh phúc', { bold: true });
  r++;
  mergeText(r, 1, 4, '-------');
  mergeText(r, 5, COLS, '-----------------------');
  r++;
  mergeText(r, 5, COLS, dateStr, { italic: true });
  r += 2; // spacer

  mergeText(r, 1, COLS, 'BÁO CÁO KẾT QUẢ THI', { bold: true, size: 16 });
  r++;
  mergeText(r, 1, COLS, `PHÒNG THI: ${room.roomCode} - ĐỀ THI: ${(room.quizId?.title || '').toUpperCase()}`, { bold: true });
  r += 2; // spacer

  const headers = ['Họ và tên', 'Gmail', 'Cấp bậc', 'Chức vụ', 'Đơn vị', 'Số câu đúng', 'Tỷ lệ (%)', 'Kết quả', 'Xếp loại', 'Vi phạm chuyển tab'];
  headers.forEach((h, idx) => {
    const cell = sheet.getCell(r, idx + 1);
    cell.value = h;
    cell.font = { name: 'Times New Roman', bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = XLSX_THIN_BORDER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E2E2' } };
  });
  r++;

  results.forEach(res => {
    const correctRatio = res.totalQuestions ? Math.round((res.score / res.totalQuestions) * 100) : 0;
    const rowValues = [
      res.userId.fullName,
      res.userId.email || '',
      res.userId.rank || 'Binh nhì',
      res.userId.position || 'Học viên',
      res.userId.unitId?.name || '',
      `${res.score}/${res.totalQuestions}`,
      correctRatio,
      res.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT',
      res.rank,
      res.antiCheatViolations || 0
    ];
    rowValues.forEach((val, idx) => {
      const cell = sheet.getCell(r, idx + 1);
      cell.value = val;
      cell.font = { name: 'Times New Roman' };
      cell.alignment = { horizontal: idx === 0 || idx === 4 ? 'left' : 'center', vertical: 'middle' };
      cell.border = XLSX_THIN_BORDER;
    });
    r++;
  });

  r += 2; // spacer after table

  if (showSignature) {
    mergeText(r, 6, COLS, finalPosition, { bold: true });
    r++;
    mergeText(r, 6, COLS, '(Ký, ghi rõ họ tên)', { italic: true });
    r += 4; // signature space
    mergeText(r, 6, COLS, `${finalRank} ${finalName}`, { bold: true });
  }

  return workbook;
};
