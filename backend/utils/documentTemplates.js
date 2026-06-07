import { Document, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

/**
 * Helper to generate official VPA header section for docx documents
 * @param {string} upperUnit 
 * @param {string} currentUnit 
 * @param {string} province 
 * @returns {Table} A Table containing the standard header
 */
const createVPAHeader = (upperUnit = 'BỘ QUỐC PHÒNG', currentUnit = 'HỌC VIỆN KỸ THUẬT QUÂN SỰ', province = 'Hà Nội') => {
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
            width: { size: 50, type: WidthType.PERCENTAGE },
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
            width: { size: 50, type: WidthType.PERCENTAGE },
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
export const generateQuizDOCX = (quiz, adminUser, upperUnit, currentUnit, province, position, showSignature = true, signerRank, signerName) => {
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

  return new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
};

/**
 * Generates a DOCX document for Exam Results Report
 */
export const generateResultsDOCX = (room, results, adminUser, upperUnit, currentUnit, province, position, showSignature = true, signerRank, signerName) => {
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
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: res.userId.unit || '', font: 'Times New Roman' })] })] }),
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

  return new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
};
