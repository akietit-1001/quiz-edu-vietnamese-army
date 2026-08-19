import React, { useLayoutEffect, useRef, useState } from 'react';

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

// 1cm = 96/2.54 CSS px theo đặc tả CSS (hằng số tuyệt đối, không phụ thuộc
// DPI màn hình hay mức zoom — cả phép đo lẫn nội dung đo đều theo cùng đơn vị
// cm nên tỉ lệ tương đối giữa chúng luôn đúng bất kể zoom).
const CM_TO_PX = 96 / 2.54;

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

// ---------------------------------------------------------------------------
// Các khối nội dung dùng chung — cùng 1 JSX cho cả bản in thật (portal) và
// bản đo để tính ngắt trang khi xem trước, đảm bảo 2 bên khớp nhau tuyệt đối.
// ---------------------------------------------------------------------------

const HeaderTitleBlock: React.FC<{ data: QuizPrintData; quizItem: any }> = ({ data, quizItem }) => (
  <>
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
  </>
);

const QuestionBlock: React.FC<{ q: any; idx: number }> = ({ q, idx }) => (
  <div className="font-serif text-sm">
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
);

const SignatureBlock: React.FC<{ data: QuizPrintData }> = ({ data }) => (
  <div className="flex justify-end font-serif">
    <div className="text-center w-[45%] font-serif">
      <p className="font-bold uppercase font-serif text-sm">{data.position}</p>
      <p className="italic text-xs text-gray-500 mb-16 font-serif">(Ký, ghi rõ họ tên)</p>
      <p className="font-bold text-sm font-serif">{data.signerRank} {data.signerName}</p>
    </div>
  </div>
);

const AnswerTitleBlock: React.FC<{ quizItem: any }> = ({ quizItem }) => (
  <div className="text-center my-6 font-serif">
    <h2 className="text-lg font-bold uppercase tracking-wide font-serif">BẢNG ĐÁP ÁN</h2>
    {quizItem.examCode && (
      <p className="italic mt-1 text-xs font-serif">Mã đề thi: {quizItem.examCode}</p>
    )}
  </div>
);

const answerLabelFor = (q: any) => q.questionType === 'fill-in-the-blank'
  ? ((q.correctAnswers || []).join(' / ') || '—')
  : ((q.correctAnswers || []).map((a: string) => String.fromCharCode(65 + parseInt(a, 10))).join('/') || '—');

// 1 "hàng" 5 ô đáp án — grid-cols-5 xếp mỗi hàng riêng thay vì 1 grid liền
// khối lớn, để có thể đo/ngắt trang theo từng hàng (visual giống hệt 1 grid
// liên tục vì grid-cols-5 vốn tự xuống hàng sau mỗi 5 phần tử).
const AnswerRowBlock: React.FC<{ rowQuestions: any[]; rowStartIdx: number }> = ({ rowQuestions, rowStartIdx }) => (
  <div className="grid grid-cols-5 gap-2 font-serif text-xs">
    {rowQuestions.map((q, i) => (
      <div key={i} className="border border-black text-center py-1.5 font-serif">
        Câu {rowStartIdx + i + 1}: <span className="font-bold">{answerLabelFor(q)}</span>
      </div>
    ))}
  </div>
);

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Nội dung layout đề thi cho bản IN THẬT (portal, window.print()) — trình
// duyệt tự ngắt trang thật (page-break-after/CSS @page) nên không cần tính
// toán gì, cứ đổ hết nội dung vào 1 khối liên tục cho mỗi mã đề.
export const renderQuizPrintContent = (data: QuizPrintData) => {
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

  const cssPaperSize = { A4: 'A4', A5: 'A5', letter: 'letter', legal: 'legal' }[paperSize];

  return (
    <>
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

      {data.quizzes.map((quizItem: any, quizIdx: number) => {
        const questionPageNumber = quizIdx * pagesPerQuiz + 1;
        const answerPageNumber = questionPageNumber + 1;
        return (
        <React.Fragment key={quizItem._id || quizIdx}>
        <div className="print-page-break">
          <HeaderTitleBlock data={data} quizItem={quizItem} />
          <div className="space-y-4 my-6 font-serif">
            {(quizItem.questions || []).map((q: any, idx: number) => (
              <QuestionBlock key={idx} q={q} idx={idx} />
            ))}
          </div>
          {data.showSignature && (
            <div className="mt-12">
              <SignatureBlock data={data} />
            </div>
          )}
          {pageNumberFooter(questionPageNumber)}
        </div>

        {data.includeAnswers && (
          <div className="print-page-break font-serif">
            <AnswerTitleBlock quizItem={quizItem} />
            <div className="space-y-2 font-serif text-xs">
              {chunk(quizItem.questions || [], 5).map((row, rowIdx) => (
                <AnswerRowBlock key={rowIdx} rowQuestions={row} rowStartIdx={rowIdx * 5} />
              ))}
            </div>
            {pageNumberFooter(answerPageNumber)}
          </div>
        )}
        </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Xem trước dạng "tờ A4" có NGẮT TRANG THẬT — thay vì gói toàn bộ câu hỏi vào
// 1 khối cao vô hạn (khiến preview luôn hiện "1 trang" dù bản in ra tới 3
// trang), component này ĐO chiều cao thật của từng khối nội dung (câu hỏi,
// hàng đáp án...) bằng 1 lần render ẩn ở đúng bề rộng vùng nội dung thật, rồi
// tự ngắt trang theo thuật toán tham lam (còn chỗ thì nhét tiếp, hết chỗ thì
// sang trang mới) — mô phỏng đúng cách trình duyệt in thật tự ngắt trang.
// ---------------------------------------------------------------------------

type MeasuredUnit = { top: number; bottom: number };

const measureUnits = (container: HTMLElement, refs: (HTMLElement | null)[]): MeasuredUnit[] => {
  const containerTop = container.getBoundingClientRect().top;
  return refs.map(el => {
    if (!el) return { top: 0, bottom: 0 };
    const r = el.getBoundingClientRect();
    return { top: r.top - containerTop, bottom: r.bottom - containerTop };
  });
};

// Gói các khối (đã có vị trí top/bottom đo thật) vào từng trang theo budget
// chiều cao — 1 khối luôn nguyên vẹn trên 1 trang (không tách đôi 1 câu hỏi
// giữa 2 trang), khối đầu tiên của 1 trang mới luôn bắt đầu full budget mới.
const packIntoPages = (units: MeasuredUnit[], budgetPx: number): number[][] => {
  const pages: number[][] = [];
  let current: number[] = [];
  let pageStartTop = 0;

  units.forEach((unit, i) => {
    const height = unit.bottom - unit.top;
    if (current.length === 0) {
      current.push(i);
      pageStartTop = unit.top;
      return;
    }
    const heightIfAdded = unit.bottom - pageStartTop;
    if (heightIfAdded > budgetPx) {
      pages.push(current);
      current = [i];
      pageStartTop = unit.top;
    } else {
      current.push(i);
    }
    void height;
  });
  if (current.length > 0) pages.push(current);
  return pages;
};

export const PaginatedQuizPreview: React.FC<{ data: QuizPrintData }> = ({ data }) => {
  const quizItem = data.quizzes[0];
  const questions: any[] = quizItem?.questions || [];
  const answerRows = chunk(questions, 5);

  const marginTop = data.marginTop ?? 2.5;
  const marginBottom = data.marginBottom ?? 2.0;
  const marginLeft = data.marginLeft ?? 3.0;
  const marginRight = data.marginRight ?? 1.5;
  const paperSize: PaperSize = data.paperSize || 'A4';
  const pageNumberShowLabel = data.pageNumberShowLabel !== false;
  const pageNumberShowTotal = data.pageNumberShowTotal !== false;

  const paperDims = PAPER_SIZE_DIMENSIONS_CM[paperSize];
  const isLandscape = data.orientation === 'landscape';
  const sheetWidthCm = isLandscape ? paperDims.height : paperDims.width;
  const sheetHeightCm = isLandscape ? paperDims.width : paperDims.height;
  const contentWidthCm = sheetWidthCm - marginLeft - marginRight;
  const budgetPx = (sheetHeightCm - marginTop - marginBottom) * CM_TO_PX;

  // Khối đo ẩn: 1 khối header+tiêu đề (không tách rời), N khối câu hỏi, 1
  // khối chữ ký (nếu bật) — luôn theo đúng thứ tự/khoảng cách như bản in thật.
  const measureRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const signatureRef = useRef<HTMLDivElement>(null);
  const answerTitleRef = useRef<HTMLDivElement>(null);
  const answerRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [examPages, setExamPages] = useState<number[][] | null>(null);
  const [answerPages, setAnswerPages] = useState<number[][] | null>(null);

  const depsKey = JSON.stringify({
    id: quizItem?._id, qLen: questions.length, includeAnswers: data.includeAnswers,
    showSignature: data.showSignature, orientation: data.orientation, paperSize,
    marginTop, marginBottom, marginLeft, marginRight, upperUnit: data.upperUnit,
    currentUnit: data.currentUnit, province: data.province, position: data.position,
    signerRank: data.signerRank, signerName: data.signerName
  });

  useLayoutEffect(() => {
    if (!measureRef.current || !quizItem) return;

    // Đơn vị số 0 = header+tiêu đề (bất khả phân, luôn mở đầu trang 1).
    const examUnits = measureUnits(measureRef.current, [headerRef.current, ...questionRefs.current]);
    if (data.showSignature && signatureRef.current) {
      examUnits.push(...measureUnits(measureRef.current, [signatureRef.current]));
    }
    setExamPages(packIntoPages(examUnits, budgetPx));

    if (data.includeAnswers) {
      const ansUnits = measureUnits(measureRef.current, [answerTitleRef.current, ...answerRowRefs.current]);
      setAnswerPages(packIntoPages(ansUnits, budgetPx));
    } else {
      setAnswerPages(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, budgetPx]);

  const totalPages = (examPages?.length || 0) + (answerPages?.length || 0);

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

  const Sheet: React.FC<{ pageNumber: number; kind: 'exam' | 'answer'; children: React.ReactNode }> = ({ pageNumber, kind, children }) => (
    <div className="mb-14">
      <div className="flex justify-center mb-2.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark shadow">
          Trang {pageNumber}/{totalPages || pageNumber}
          <span className="opacity-60 font-normal normal-case">·</span>
          {kind === 'answer' ? 'Đáp án' : 'Đề thi'}
        </span>
      </div>
      <div
        className="bg-white shadow-lg mx-auto relative text-black ring-1 ring-black/10"
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
    </div>
  );

  if (!quizItem) return null;

  return (
    <div className="relative">
      {/* Khối đo ẩn — không hiện ra màn hình, chỉ để lấy chiều cao thật của
          từng khối nội dung ở đúng bề rộng vùng in thật (contentWidthCm). */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: -99999, width: `${contentWidthCm}cm`, visibility: 'hidden', pointerEvents: 'none' }}
      >
        <div ref={headerRef}>
          <HeaderTitleBlock data={data} quizItem={quizItem} />
        </div>
        <div className="space-y-4 my-6 font-serif">
          {questions.map((q, idx) => (
            <div key={idx} ref={el => { questionRefs.current[idx] = el; }}>
              <QuestionBlock q={q} idx={idx} />
            </div>
          ))}
        </div>
        {data.showSignature && (
          <div ref={signatureRef} className="mt-12">
            <SignatureBlock data={data} />
          </div>
        )}
        <div ref={answerTitleRef}>
          <AnswerTitleBlock quizItem={quizItem} />
        </div>
        <div className="space-y-2 font-serif text-xs">
          {answerRows.map((row, rowIdx) => (
            <div key={rowIdx} ref={el => { answerRowRefs.current[rowIdx] = el; }}>
              <AnswerRowBlock rowQuestions={row} rowStartIdx={rowIdx * 5} />
            </div>
          ))}
        </div>
      </div>

      {/* Trang hiển thị thật — dựng lại từ kết quả ngắt trang đã tính. */}
      {examPages === null ? (
        <div className="text-center text-xs text-gray-400 py-10 uppercase tracking-wider">Đang tính toán ngắt trang...</div>
      ) : (
        <>
          {examPages.map((unitIdxs, pageIdx) => {
            const hasSignature = data.showSignature && unitIdxs[unitIdxs.length - 1] === questions.length + 1;
            const questionIdxs = unitIdxs.filter(i => i >= 1 && i <= questions.length).map(i => i - 1);
            return (
              <Sheet key={`exam-${pageIdx}`} pageNumber={pageIdx + 1} kind="exam">
                {unitIdxs.includes(0) && <HeaderTitleBlock data={data} quizItem={quizItem} />}
                <div className="space-y-4 my-6 font-serif">
                  {questionIdxs.map(idx => <QuestionBlock key={idx} q={questions[idx]} idx={idx} />)}
                </div>
                {hasSignature && (
                  <div className="mt-12">
                    <SignatureBlock data={data} />
                  </div>
                )}
              </Sheet>
            );
          })}

          {answerPages && answerPages.map((unitIdxs, pageIdx) => {
            const rowIdxs = unitIdxs.filter(i => i >= 1).map(i => i - 1);
            return (
              <Sheet key={`answer-${pageIdx}`} pageNumber={examPages.length + pageIdx + 1} kind="answer">
                {unitIdxs.includes(0) && <AnswerTitleBlock quizItem={quizItem} />}
                <div className="space-y-2 font-serif text-xs">
                  {rowIdxs.map(idx => <AnswerRowBlock key={idx} rowQuestions={answerRows[idx]} rowStartIdx={idx * 5} />)}
                </div>
              </Sheet>
            );
          })}
        </>
      )}
    </div>
  );
};
