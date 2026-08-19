import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
// bản đo để tính ngắt trang, đảm bảo 2 bên khớp nhau tuyệt đối.
// ---------------------------------------------------------------------------

// break-inside: avoid là lưới an toàn cuối — thuật toán ngắt trang bên dưới
// đã đảm bảo mỗi trang chỉ chứa các khối vừa đủ, nhưng nếu có sai số đo nhỏ
// (VD khác biệt render ẩn/hiện), CSS này ngăn trình duyệt tách đôi 1 câu hỏi
// giữa 2 trang — thà đẩy nguyên khối sang trang sau còn hơn cắt dở câu chữ.
const NO_BREAK_INSIDE: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' };

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

const QuestionBlock: React.FC<{ q: any; idx: number; noBreak?: boolean }> = ({ q, idx, noBreak }) => (
  <div className="font-serif text-sm" style={noBreak ? NO_BREAK_INSIDE : undefined}>
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
const AnswerRowBlock: React.FC<{ rowQuestions: any[]; rowStartIdx: number; noBreak?: boolean }> = ({ rowQuestions, rowStartIdx, noBreak }) => (
  <div className="grid grid-cols-5 gap-2 font-serif text-xs" style={noBreak ? NO_BREAK_INSIDE : undefined}>
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

// ---------------------------------------------------------------------------
// Đo & ngắt trang — dùng CHUNG cho cả bản in thật lẫn bản xem trước, để 2 bên
// LUÔN khớp nhau tuyệt đối (không còn 2 cơ chế phân trang khác nhau).
//
// Trước đây bản in thật đổ toàn bộ câu hỏi vào 1 khối cao vô hạn rồi để
// trình duyệt tự ngắt trang khi tràn — nhưng @page margin-top/bottom đã bị
// đặt về 0 (để tắt header/footer mặc định của trình duyệt), nên phần lề
// trên/dưới chỉ được trình duyệt cấp lại CHO TRANG ĐẦU (do padding-top của
// khối) — mọi trang KẾ TIẾP do tràn nội dung tự nhiên sinh ra đều không có
// lề, và có thể ngắt ngay giữa 1 câu hỏi/phương án. Giải pháp: đo chiều cao
// thật của từng khối nội dung rồi tự dựng RÕ RÀNG từng trang (mỗi trang là
// 1 khối .print-page-break độc lập, tự có đủ lề) thay vì phó mặc cho trình
// duyệt — bản in và bản xem trước dùng chung thuật toán này nên luôn khớp.
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
  });
  if (current.length > 0) pages.push(current);
  return pages;
};

type QuizPagination = { examPages: number[][]; answerPages: number[][] | null };

const computeLayout = (data: QuizPrintData) => {
  const marginTop = data.marginTop ?? 2.5;
  const marginBottom = data.marginBottom ?? 2.0;
  const marginLeft = data.marginLeft ?? 3.0;
  const marginRight = data.marginRight ?? 1.5;
  const paperSize: PaperSize = data.paperSize || 'A4';
  const paperDims = PAPER_SIZE_DIMENSIONS_CM[paperSize];
  const isLandscape = data.orientation === 'landscape';
  const sheetWidthCm = isLandscape ? paperDims.height : paperDims.width;
  const sheetHeightCm = isLandscape ? paperDims.width : paperDims.height;
  const contentWidthCm = sheetWidthCm - marginLeft - marginRight;
  const budgetPx = (sheetHeightCm - marginTop - marginBottom) * CM_TO_PX;
  return { marginTop, marginBottom, marginLeft, marginRight, paperSize, sheetWidthCm, sheetHeightCm, contentWidthCm, budgetPx };
};

// Render ẩn (position: fixed, visibility: hidden) toàn bộ nội dung của 1 mã
// đề ở đúng bề rộng vùng in thật, đo xong thì báo kết quả lên qua onComputed
// — không tự vẽ gì ra màn hình.
const QuizMeasurer: React.FC<{
  data: QuizPrintData;
  quizItem: any;
  contentWidthCm: number;
  budgetPx: number;
  onComputed: (result: QuizPagination) => void;
}> = ({ data, quizItem, contentWidthCm, budgetPx, onComputed }) => {
  const questions: any[] = quizItem?.questions || [];
  const answerRows = chunk(questions, 5);

  const measureRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const signatureRef = useRef<HTMLDivElement>(null);
  const answerTitleRef = useRef<HTMLDivElement>(null);
  const answerRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reportedRef = useRef(false);

  useLayoutEffect(() => {
    if (!measureRef.current || !quizItem || reportedRef.current) return;

    // Đơn vị số 0 = header+tiêu đề (bất khả phân, luôn mở đầu trang 1).
    const examUnits = measureUnits(measureRef.current, [headerRef.current, ...questionRefs.current]);
    if (data.showSignature && signatureRef.current) {
      examUnits.push(...measureUnits(measureRef.current, [signatureRef.current]));
    }
    const examPages = packIntoPages(examUnits, budgetPx);

    let answerPages: number[][] | null = null;
    if (data.includeAnswers) {
      const ansUnits = measureUnits(measureRef.current, [answerTitleRef.current, ...answerRowRefs.current]);
      answerPages = packIntoPages(ansUnits, budgetPx);
    }

    reportedRef.current = true;
    onComputed({ examPages, answerPages });
  });

  if (!quizItem) return null;

  // Portal thẳng ra document.body — KHÔNG được lồng trong bất kỳ khối nào
  // đang chờ đo (đặc biệt là khối in thật `.print-area-only`, vốn bị CSS ép
  // `display: none !important` ngoài lúc in để không hiện ra màn hình khi
  // chưa in). Nếu lồng bên trong, cha display:none khiến TOÀN BỘ cây con —
  // kể cả khối đo ẩn này — có kích thước 0x0 dù có style riêng gì đi nữa,
  // làm mọi phép đo ra 0 và thuật toán ngắt trang tưởng nội dung không
  // chiếm chỗ nào, gộp hết vào 1 trang duy nhất (đúng bug đã gặp: bản xem
  // trước ra 3 trang nhưng bản in thật lại ra 1 trang).
  return createPortal(
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
    </div>,
    document.body
  );
};

const usePageNumberStyle = (data: QuizPrintData): React.CSSProperties => {
  const [pageNumberVSide, pageNumberHSide] = (data.pageNumberPosition || 'bottom-center').split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  return {
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
};

// ---------------------------------------------------------------------------
// Bản IN THẬT (portal, window.print()) — đo trước rồi dựng RÕ RÀNG từng
// trang (mỗi trang tự có lề đầy đủ), thay vì đổ 1 khối cao vô hạn cho trình
// duyệt tự tràn trang (xem giải thích chi tiết ở khối comment phía trên).
// ---------------------------------------------------------------------------
export const QuizPrintPortalContent: React.FC<{ data: QuizPrintData; onReady?: () => void }> = ({ data, onReady }) => {
  const { marginTop, marginBottom, marginLeft, marginRight, paperSize, sheetWidthCm: _sw, sheetHeightCm, contentWidthCm, budgetPx } = computeLayout(data);
  void _sw;
  const pageNumberShowLabel = data.pageNumberShowLabel !== false;
  const pageNumberShowTotal = data.pageNumberShowTotal !== false;
  const pageNumberStyle = usePageNumberStyle(data);

  const [results, setResults] = useState<Record<number, QuizPagination>>({});
  const allComputed = data.quizzes.length > 0 && data.quizzes.every((_: any, i: number) => results[i]);

  // Đợi đo/ngắt trang xong hẳn rồi mới báo "sẵn sàng" ra ngoài (thay vì đoán
  // 1 khoảng chờ cố định) — in ngay lúc chưa đo xong sẽ ra bản in TRẮNG vì
  // lúc đó portal chỉ mới render các khối đo ẩn, chưa có trang thật nào.
  const readyFiredRef = useRef(false);
  useLayoutEffect(() => {
    if (allComputed && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady?.();
    }
  }, [allComputed, onReady]);

  const totalPages = allComputed
    ? data.quizzes.reduce((sum: number, _: any, i: number) => sum + results[i].examPages.length + (results[i].answerPages?.length || 0), 0)
    : 0;

  const pageNumberFooter = (pageNumber: number) => data.showPageNumber && (
    <div className="font-serif" style={pageNumberStyle}>
      {pageNumberShowLabel && 'Trang '}
      {pageNumber}
      {pageNumberShowTotal && `/${totalPages}`}
    </div>
  );

  const cssPaperSize = { A4: 'A4', A5: 'A5', letter: 'letter', legal: 'legal' }[paperSize];

  let runningPageNum = 0;

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
            /* Trang cuối (hay bất kỳ trang nào) có ít nội dung sẽ khiến box này
               kết thúc sớm giữa trang giấy — số trang (position:absolute;
               bottom:0.3cm bên trong box này) khi đó bám vào đáy CỦA BOX chứ
               không phải đáy TRANG GIẤY THẬT, trông như trôi lơ lửng giữa
               khoảng trắng. min-height (border-box, đã gồm cả padding) ép
               box luôn cao đúng bằng 1 trang giấy để số trang luôn nằm đúng
               đáy trang thật. */
            min-height: ${sheetHeightCm}cm;
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

      {/* Đo trước (ẩn) từng mã đề — không thấy trên màn hình. */}
      {data.quizzes.map((quizItem: any, quizIdx: number) => !results[quizIdx] && (
        <QuizMeasurer
          key={`measure-${quizItem._id || quizIdx}`}
          data={data}
          quizItem={quizItem}
          contentWidthCm={contentWidthCm}
          budgetPx={budgetPx}
          onComputed={result => setResults(prev => (prev[quizIdx] ? prev : { ...prev, [quizIdx]: result }))}
        />
      ))}

      {/* Trang in thật — dựng theo đúng điểm ngắt đã đo. */}
      {allComputed && data.quizzes.map((quizItem: any, quizIdx: number) => {
        const { examPages, answerPages } = results[quizIdx];
        const questions: any[] = quizItem.questions || [];
        const answerRows = chunk(questions, 5);

        const examNodes = examPages.map((unitIdxs, pageIdx) => {
          runningPageNum += 1;
          const pageNum = runningPageNum;
          const hasSignature = data.showSignature && unitIdxs[unitIdxs.length - 1] === questions.length + 1;
          const questionIdxs = unitIdxs.filter(i => i >= 1 && i <= questions.length).map(i => i - 1);
          return (
            <div key={`q-${quizItem._id || quizIdx}-${pageIdx}`} className="print-page-break">
              {unitIdxs.includes(0) && <HeaderTitleBlock data={data} quizItem={quizItem} />}
              <div className="space-y-4 my-6 font-serif">
                {questionIdxs.map(idx => <QuestionBlock key={idx} q={questions[idx]} idx={idx} noBreak />)}
              </div>
              {hasSignature && (
                <div className="mt-12">
                  <SignatureBlock data={data} />
                </div>
              )}
              {pageNumberFooter(pageNum)}
            </div>
          );
        });

        const answerNodes = (answerPages || []).map((unitIdxs, pageIdx) => {
          runningPageNum += 1;
          const pageNum = runningPageNum;
          const rowIdxs = unitIdxs.filter(i => i >= 1).map(i => i - 1);
          return (
            <div key={`a-${quizItem._id || quizIdx}-${pageIdx}`} className="print-page-break font-serif">
              {unitIdxs.includes(0) && <AnswerTitleBlock quizItem={quizItem} />}
              <div className="space-y-2 font-serif text-xs">
                {rowIdxs.map(idx => <AnswerRowBlock key={idx} rowQuestions={answerRows[idx]} rowStartIdx={idx * 5} noBreak />)}
              </div>
              {pageNumberFooter(pageNum)}
            </div>
          );
        });

        return <React.Fragment key={quizItem._id || quizIdx}>{examNodes}{answerNodes}</React.Fragment>;
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Xem trước dạng "tờ A4" — dùng CHUNG thuật toán đo/ngắt trang với bản in
// thật ở trên, nên số trang và điểm ngắt luôn khớp 100% với file tải về.
// ---------------------------------------------------------------------------
export const PaginatedQuizPreview: React.FC<{ data: QuizPrintData }> = ({ data }) => {
  const quizItem = data.quizzes[0];
  const questions: any[] = quizItem?.questions || [];
  const answerRows = chunk(questions, 5);

  const { marginTop, marginBottom, marginLeft, marginRight, sheetWidthCm, sheetHeightCm, contentWidthCm, budgetPx } = computeLayout(data);
  const pageNumberShowLabel = data.pageNumberShowLabel !== false;
  const pageNumberShowTotal = data.pageNumberShowTotal !== false;
  const pageNumberStyle = usePageNumberStyle(data);

  const [result, setResult] = useState<QuizPagination | null>(null);

  // Đo lại mỗi khi nội dung/kích thước ảnh hưởng đến bố cục đổi (câu hỏi,
  // lề, khổ giấy, hướng giấy, chữ ký...) — không đưa `data` thẳng vào deps vì
  // nó là object literal mới mỗi lần cha re-render (VD gõ phím ở field khác
  // không liên quan), sẽ đo lại lãng phí liên tục dù bố cục không hề đổi.
  const depsKey = JSON.stringify({
    id: quizItem?._id, qLen: questions.length, includeAnswers: data.includeAnswers,
    showSignature: data.showSignature, orientation: data.orientation, paperSize: data.paperSize,
    marginTop, marginBottom, marginLeft, marginRight, upperUnit: data.upperUnit,
    currentUnit: data.currentUnit, province: data.province, position: data.position,
    signerRank: data.signerRank, signerName: data.signerName
  });
  const [measureKey, setMeasureKey] = useState(depsKey);
  if (measureKey !== depsKey) {
    setMeasureKey(depsKey);
    setResult(null);
  }

  const examPages = result?.examPages ?? null;
  const answerPages = result?.answerPages ?? null;
  const totalPages = (examPages?.length || 0) + (answerPages?.length || 0);

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
      {!result && (
        <QuizMeasurer
          key={measureKey}
          data={data}
          quizItem={quizItem}
          contentWidthCm={contentWidthCm}
          budgetPx={budgetPx}
          onComputed={setResult}
        />
      )}

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
