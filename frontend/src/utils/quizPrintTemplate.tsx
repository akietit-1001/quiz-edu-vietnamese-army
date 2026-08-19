import React from 'react';

export type PageNumberPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const PAGE_NUMBER_POSITIONS: PageNumberPosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
export const PAGE_NUMBER_POSITION_LABELS: Record<PageNumberPosition, string> = {
  'top-left': 'Đầu · Trái',
  'top-center': 'Đầu · Giữa',
  'top-right': 'Đầu · Phải',
  'bottom-left': 'Cuối · Trái',
  'bottom-center': 'Cuối · Giữa',
  'bottom-right': 'Cuối · Phải'
};

export type PaperSize = 'A4' | 'A5' | 'letter' | 'legal';

export const PAPER_SIZES: PaperSize[] = ['A4', 'A5', 'letter', 'legal'];
export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  A4: 'A4 (21 × 29.7 cm)',
  A5: 'A5 (14.8 × 21 cm)',
  letter: 'Letter (21.6 × 27.9 cm)',
  legal: 'Legal (21.6 × 35.6 cm)'
};
// Kích thước khổ giấy dạng portrait (cm) — hoán width/height khi in ngang.
export const PAPER_SIZE_DIMENSIONS_CM: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 21, height: 29.7 },
  A5: { width: 14.8, height: 21 },
  letter: { width: 21.59, height: 27.94 },
  legal: { width: 21.59, height: 35.56 }
};

// Tên file/tiêu đề tải về nên khớp với tên đề thi thật — bỏ dấu tiếng Việt
// bằng NFD normalize rồi xoá riêng các dấu kết hợp (KHÔNG được chỉ lọc theo
// [a-zA-Z0-9]: chữ tiếng Việt có dấu ở dạng precomposed (VD "ề", "Đ") không
// nằm trong tập đó nên bị xoá NGUYÊN CẢ CHỮ CÁI GỐC, tạo ra tên file kiểu
// "bộ xương phụ âm" đọc không ra chữ gì, VD "tìm hiểu" -> "tm_hiu" thay vì
// "tim_hieu").
export const sanitizeFilenamePart = (text: string) => {
  const noDiacritics = String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const cleaned = noDiacritics
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || 'De_thi';
};

export type QuizPrintData = {
  upperUnit: string;
  currentUnit: string;
  province: string;
  position: string;
  showSignature: boolean;
  signerRank: string;
  signerName: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  mirrorMargins?: boolean;
  orientation?: 'portrait' | 'landscape';
  includeAnswers?: boolean;
  showPageNumber?: boolean;
  pageNumberPosition?: PageNumberPosition;
  pageNumberShowLabel?: boolean;
  pageNumberShowTotal?: boolean;
  paperSize?: PaperSize;
  quizzes: any[];
};

// Nội dung layout đề thi dùng chung cho cả bản in thật (portal, mode='print')
// và bản xem trước dạng tờ A4 (modal, mode='preview') — đảm bảo xem trước
// khớp 100% với file in ra, chỉ khác cách "trang" được đóng khung trên màn
// hình (page-break-after cho in thật; box tách rời có bóng đổ cho xem trước).
export const renderQuizPrintContent = (data: QuizPrintData, mode: 'print' | 'preview' = 'print') => {
  const pagesPerQuiz = data.includeAnswers ? 2 : 1;
  const totalPages = data.quizzes.length * pagesPerQuiz;

  const marginTop = data.marginTop ?? 2.5;
  const marginBottom = data.marginBottom ?? 2.0;
  const marginLeft = data.marginLeft ?? 3.0;
  const marginRight = data.marginRight ?? 1.5;
  const paperSize: PaperSize = data.paperSize || 'A4';
  const pageNumberShowLabel = data.pageNumberShowLabel !== false;
  const pageNumberShowTotal = data.pageNumberShowTotal !== false;

  const [pageNumberVSide, pageNumberHSide] = (data.pageNumberPosition || 'bottom-center').split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const pageNumberStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: pageNumberHSide,
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: '9px',
    color: '#000',
    padding: '0 0.3cm',
    ...(pageNumberVSide === 'top' ? { top: '0.3cm' } : { bottom: '0.3cm' })
  };
  const pageNumberFooter = (pageNumber: number) => data.showPageNumber && (
    <div className="font-serif" style={pageNumberStyle}>
      {pageNumberShowLabel && 'Trang '}
      {pageNumber}
      {pageNumberShowTotal && `/${totalPages}`}
    </div>
  );

  // Dạng "tờ A4" cho xem trước: khung có kích thước/tỉ lệ đúng khổ giấy đã
  // chọn, đổ bóng như trang giấy thật, cách nhau bằng khoảng trống — không
  // cần chính xác tuyệt đối theo pixel (bản in thật mới là nguồn chính xác),
  // chỉ cần đúng bố cục nội dung và ranh giới trang rõ ràng.
  const paperDims = PAPER_SIZE_DIMENSIONS_CM[paperSize];
  const isLandscape = data.orientation === 'landscape';
  const sheetWidthCm = isLandscape ? paperDims.height : paperDims.width;
  const sheetHeightCm = isLandscape ? paperDims.width : paperDims.height;

  const renderPage = (pageNumber: number, key: React.Key, children: React.ReactNode) => {
    if (mode === 'preview') {
      // Dùng đơn vị cm thật (trình duyệt tự quy đổi ra px) thay vì áng chừng
      // theo px — nếu thu nhỏ trang bằng 1 hệ số px/cm tùy ý, cỡ chữ (vốn
      // định nghĩa theo px, không co giãn theo trang) sẽ trông quá to so với
      // khổ trang và làm vỡ bố cục (chữ đè lên khung mã đề, tràn dòng...).
      // Cm thật giữ đúng tỉ lệ chữ/trang như bản in thật, đổi lại panel xem
      // trước cần cuộn ngang/dọc để thấy hết — chấp nhận được.
      return (
        // overflow-hidden trên chính khung có box-shadow sẽ tự cắt mất bóng
        // đổ của nó (shadow vẽ ra NGOÀI viền box) — bỏ để 2 "tờ" liền kề vẫn
        // thấy rõ đường phân cách dù bị scale nhỏ. mb-10 (thay vì mb-6) để
        // khoảng cách còn đủ rõ sau khi scale-to-fit thu nhỏ toàn bộ lại.
        <div
          key={key}
          className="bg-white shadow-md mx-auto mb-10 relative text-black"
          style={{
            width: `${sheetWidthCm}cm`,
            minHeight: `${sheetHeightCm}cm`,
            paddingTop: `${marginTop}cm`,
            paddingBottom: `${marginBottom}cm`,
            paddingLeft: `${marginLeft}cm`,
            paddingRight: `${marginRight}cm`
          }}
        >
          {children}
          {pageNumberFooter(pageNumber)}
        </div>
      );
    }
    return (
      <div key={key} className="print-page-break">
        {children}
        {pageNumberFooter(pageNumber)}
      </div>
    );
  };

  const cssPaperSize = { A4: 'A4', A5: 'A5', letter: 'letter', legal: 'legal' }[paperSize];

  return (
    <>
      {mode === 'print' && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: ${cssPaperSize} ${data.orientation === 'landscape' ? 'landscape' : 'portrait'};
            }

            ${data.mirrorMargins ? `
              @page :left {
                margin-top: 0;
                margin-bottom: 0;
                margin-left: ${marginRight}cm;
                margin-right: ${marginLeft}cm;
              }
              @page :right {
                margin-top: 0;
                margin-bottom: 0;
                margin-left: ${marginLeft}cm;
                margin-right: ${marginRight}cm;
              }
              @page :first {
                margin-top: 0;
                margin-bottom: 0;
                margin-left: ${marginLeft}cm;
                margin-right: ${marginRight}cm;
              }
            ` : `
              @page {
                margin-top: 0;
                margin-bottom: 0;
                margin-left: ${marginLeft}cm;
                margin-right: ${marginRight}cm;
              }
            `}

            .print-page-break {
              page-break-after: always;
              box-sizing: border-box;
              width: 100%;
              position: relative;
              padding-top: ${marginTop}cm;
              padding-bottom: ${marginBottom}cm;
            }

            .print-page-break:last-child {
              page-break-after: avoid;
            }

            .print-area-only {
              padding-top: 0 !important;
              padding-bottom: 0 !important;
            }

            body {
              background: white;
              color: black;
            }
          }
        `}} />
      )}

      {data.quizzes.map((quizItem: any, quizIdx: number) => {
        const questionPageNumber = quizIdx * pagesPerQuiz + 1;
        const answerPageNumber = questionPageNumber + 1;
        return (
        <React.Fragment key={quizItem._id || quizIdx}>
        {renderPage(questionPageNumber, `q-${quizItem._id || quizIdx}`, (
          <>
            {/* Header (VPA quốc hiệu + đơn vị) */}
            <div className="flex justify-between items-start text-xs leading-normal mb-8 font-serif">
              <div className="text-center w-[38%] font-serif">
                <p className="uppercase font-serif">{data.upperUnit}</p>
                <p className="font-bold uppercase font-serif">{data.currentUnit}</p>
                <p className="font-bold mt-0.5">---------</p>
              </div>
              <div className="text-center w-[58%] font-serif">
                <p className="font-bold text-[13px] font-serif whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold border-b border-black pb-1 inline-block mx-auto text-[13px] font-serif whitespace-nowrap">
                  Độc lập - Tự do - Hạnh phúc
                </p>
                <p className="italic mt-1.5 font-serif">
                  {data.province}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </p>
              </div>
            </div>

            {/* Title & Exam Code */}
            <div className="text-center my-6 font-serif relative">
              <h2 className="text-lg font-bold uppercase tracking-wide font-serif">ĐỀ THI TRẮC NGHIỆM</h2>
              <p className="font-bold mt-1 font-serif">MÔN: {quizItem.title?.toUpperCase()}</p>
              <p className="italic mt-1 text-xs font-serif">
                Thời gian làm bài: {quizItem.duration || 45} phút (Không kể thời gian giao đề)
              </p>
              {quizItem.examCode && (
                <div className="absolute right-0 top-0 border border-black px-3 py-1 font-bold text-sm font-serif">
                  Mã đề thi: {quizItem.examCode}
                </div>
              )}
            </div>

            {/* Question List */}
            <div className="space-y-4 my-6 font-serif">
              {(quizItem.questions || []).map((q: any, idx: number) => (
                <div key={idx} className="font-serif text-sm">
                  <p className="font-bold font-serif">Câu {idx + 1}: {q.questionText}</p>
                  {q.questionType === 'fill-in-the-blank' ? (
                    <p className="pl-8 italic text-gray-500 font-serif mt-1">
                      Đáp án: ................................................................................................................
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 pl-8 mt-1 font-serif">
                      {(q.options || []).map((opt: string, oIdx: number) => (
                        <p key={oIdx} className="font-serif">{String.fromCharCode(65 + oIdx)}. {opt}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Signatures */}
            {data.showSignature && (
              <div className="flex justify-end mt-12 font-serif">
                <div className="text-center w-[45%] font-serif">
                  <p className="font-bold uppercase font-serif text-sm">{data.position}</p>
                  <p className="italic text-xs text-gray-500 mb-16 font-serif">(Ký, ghi rõ họ tên)</p>
                  <p className="font-bold text-sm font-serif">{data.signerRank} {data.signerName}</p>
                </div>
              </div>
            )}
          </>
        ))}

        {data.includeAnswers && renderPage(answerPageNumber, `a-${quizItem._id || quizIdx}`, (
          <div className="font-serif">
            <div className="text-center my-6 font-serif">
              <h2 className="text-lg font-bold uppercase tracking-wide font-serif">BẢNG ĐÁP ÁN</h2>
              {quizItem.examCode && (
                <p className="italic mt-1 text-xs font-serif">Mã đề thi: {quizItem.examCode}</p>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2 font-serif text-xs">
              {(quizItem.questions || []).map((q: any, idx: number) => {
                const label = q.questionType === 'fill-in-the-blank'
                  ? ((q.correctAnswers || []).join(' / ') || '—')
                  : ((q.correctAnswers || []).map((a: string) => String.fromCharCode(65 + parseInt(a, 10))).join('/') || '—');
                return (
                  <div key={idx} className="border border-black text-center py-1.5 font-serif">
                    Câu {idx + 1}: <span className="font-bold">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </React.Fragment>
        );
      })}
    </>
  );
};
