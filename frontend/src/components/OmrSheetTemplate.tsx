import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface OmrPrintData {
  upperUnit: string;
  currentUnit: string;
  quizTitle: string;
  quizId: string;
  totalQuestions: number;
  examCode?: string;
  batchCode?: string;
  batchId?: string;
  roomCode?: string;
  province?: string;
  fontSize?: 'normal' | 'compact';
}

/**
 * Component render Phiếu Trả Lời Trắc Nghiệm chuẩn OMR kích thước A4 (1 trang duy nhất)
 * Được thiết kế với 4 góc Marker đen đặc (13mm x 13mm) dùng vector SVG để camera điện thoại tự động căn phối cảnh (Perspective Warp).
 */
export const OmrSheetPage: React.FC<{ data: OmrPrintData }> = ({ data }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const totalQ = Math.max(1, Math.min(100, data.totalQuestions || 40));

  useEffect(() => {
    const qrPayload = JSON.stringify({
      type: 'OMR_QUIZ',
      qId: data.quizId || '',
      batchCode: data.batchCode || '',
      batchId: data.batchId || '',
      title: data.quizTitle || 'Bài kiểm tra',
      total: totalQ,
      code: data.examCode || '101',
      room: data.roomCode || ''
    });

    QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 140,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Lỗi tạo QR code OMR:', err));
  }, [data.quizId, data.batchCode, data.batchId, data.quizTitle, totalQ, data.examCode, data.roomCode]);

  // Chia câu hỏi thành các cột cân đối theo số câu
  const getColumns = () => {
    const cols: number[][] = [];
    let itemsPerCol = 20;
    if (totalQ <= 20) itemsPerCol = 10;
    else if (totalQ <= 40) itemsPerCol = 20;
    else if (totalQ <= 60) itemsPerCol = 20;
    else if (totalQ <= 80) itemsPerCol = 20;
    else itemsPerCol = 25;

    for (let i = 1; i <= totalQ; i += itemsPerCol) {
      const col = [];
      for (let j = i; j < i + itemsPerCol && j <= totalQ; j++) {
        col.push(j);
      }
      cols.push(col);
    }
    return cols;
  };

  const columns = getColumns();

  return (
    <div
      className="omr-sheet-page relative bg-white text-black font-serif select-none box-border shadow-md print:shadow-none"
      style={{
        width: '210mm',
        minHeight: '297mm',
        height: '297mm',
        maxHeight: '297mm',
        padding: '6mm 20mm 6mm 20mm',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontSize: '10.5px',
        lineHeight: 1.2,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* ========================================================================= */}
      {/* 4 CORNER FIDUCIAL MARKERS (Mỗi marker vuông 10x10mm dùng SVG đen 100%)     */}
      {/* ========================================================================= */}
      {/* Top - Left */}
      <div
        className="omr-marker top-left absolute"
        style={{
          top: '6mm',
          left: '6mm',
          width: '10mm',
          height: '10mm',
          backgroundColor: '#000000',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ display: 'block' }}>
          <rect width="50" height="50" fill="#000000" stroke="#000000" />
        </svg>
      </div>

      {/* Top - Right */}
      <div
        className="omr-marker top-right absolute"
        style={{
          top: '6mm',
          right: '6mm',
          width: '10mm',
          height: '10mm',
          backgroundColor: '#000000',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ display: 'block' }}>
          <rect width="50" height="50" fill="#000000" stroke="#000000" />
        </svg>
      </div>

      {/* Bottom - Left */}
      <div
        className="omr-marker bottom-left absolute"
        style={{
          bottom: '6mm',
          left: '6mm',
          width: '10mm',
          height: '10mm',
          backgroundColor: '#000000',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ display: 'block' }}>
          <rect width="50" height="50" fill="#000000" stroke="#000000" />
        </svg>
      </div>

      {/* Bottom - Right */}
      <div
        className="omr-marker bottom-right absolute"
        style={{
          bottom: '6mm',
          right: '6mm',
          width: '10mm',
          height: '10mm',
          backgroundColor: '#000000',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ display: 'block' }}>
          <rect width="50" height="50" fill="#000000" stroke="#000000" />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* HEADER: ĐƠN VỊ VÀ QUỐC HIỆU                                               */}
      {/* ========================================================================= */}
      <div className="flex justify-between items-start border-b border-black pb-1 mb-1 mt-0.5 px-1">
        <div className="text-center w-[42%]">
          <p className="text-[9.5px] font-bold uppercase tracking-wider">{data.upperUnit || 'BỘ QUỐC PHÒNG'}</p>
          <p className="text-[10.5px] font-black uppercase tracking-wide">{data.currentUnit || 'ĐƠN VỊ TỔ CHỨC THI'}</p>
          <div className="w-12 h-[1px] bg-black mx-auto mt-0.5" />
        </div>
        <div className="text-center w-[56%]">
          <p className="text-[10.5px] font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="text-[10.5px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
          <div className="w-20 h-[1px] bg-black mx-auto mt-0.5" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIÊU ĐỀ PHIẾU THI & QR CODE                                                */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-2 mb-1.5 bg-gray-50 border border-black p-1.5 rounded-sm">
        <div className="flex-1">
          <h1 className="text-[14px] font-black uppercase tracking-wide text-center text-black mb-0.5">
            PHIẾU TRẢ LỜI TRẮC NGHIỆM
          </h1>
          <p className="text-center font-bold text-[11px] text-gray-800 line-clamp-1">
            Đề: {data.quizTitle || 'Bài kiểm tra trắc nghiệm quân sự'}
          </p>
          <p className="text-center text-[9.5px] text-gray-600 mt-0.5 italic">
            (Tổng số câu: <span className="font-bold text-black">{totalQ}</span> câu | Dùng bút chì 2B hoặc bút bi tô kín ô tròn)
          </p>
        </div>
        {/* QR Code định danh đề thi */}
        <div className="flex flex-col items-center justify-center pl-1.5 border-l border-gray-300">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Mã QR đề thi" className="w-[50px] h-[50px] object-contain" />
          ) : (
            <div className="w-[50px] h-[50px] bg-gray-200 animate-pulse border border-black" />
          )}
          <span className="text-[8px] font-mono font-bold tracking-tighter mt-0.5 text-center">
            {data.batchCode ? `${data.batchCode} • ` : ''}MÃ ĐỀ: {data.examCode || '101'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THÔNG TIN THÍ SINH & KHUNG TÔ SBD / MÃ ĐỀ                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-1.5 mb-1.5">
        {/* Cột trái: Thông tin viết tay & Hướng dẫn tô */}
        <div className="col-span-7 border border-black p-1.5 rounded-sm flex flex-col justify-between">
          <div className="space-y-1 text-[10px]">
            <div className="flex items-baseline">
              <span className="font-bold w-22 whitespace-nowrap">1. Họ và tên:</span>
              <span className="flex-1 border-b border-dotted border-black min-h-[13px]" />
            </div>
            <div className="flex items-baseline">
              <span className="font-bold w-22 whitespace-nowrap">2. Cấp bậc/Chức vụ:</span>
              <span className="flex-1 border-b border-dotted border-black min-h-[13px]" />
            </div>
            <div className="flex items-baseline">
              <span className="font-bold w-22 whitespace-nowrap">3. Đơn vị / Lớp:</span>
              <span className="flex-1 border-b border-dotted border-black min-h-[13px]" />
            </div>
            <div className="flex items-baseline">
              <span className="font-bold w-22 whitespace-nowrap">4. Ngày sinh:</span>
              <span className="w-24 border-b border-dotted border-black min-h-[13px]" />
              <span className="font-bold ml-1.5 w-14 whitespace-nowrap">Phòng thi:</span>
              <span className="flex-1 border-b border-dotted border-black min-h-[13px]">
                {data.roomCode ? ` ${data.roomCode}` : ''}
              </span>
            </div>
          </div>

          {/* Quy cách tô & Điểm / Giám thị */}
          <div className="mt-1 pt-1 border-t border-gray-300 grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="border border-dashed border-gray-400 p-0.5 bg-gray-50 rounded">
              <span className="font-bold block text-center mb-0.5 text-[8.5px]">HƯỚNG DẪN TÔ</span>
              <div className="flex items-center justify-around">
                <div className="flex items-center space-x-0.5">
                  <span className="w-3 h-3 rounded-full bg-black text-white text-[7px] flex items-center justify-center font-bold">●</span>
                  <span className="text-green-700 font-bold text-[8px]">Đúng</span>
                </div>
                <div className="flex items-center space-x-0.5">
                  <span className="w-3 h-3 rounded-full border border-black text-black text-[7px] flex items-center justify-center font-bold">✕</span>
                  <span className="text-red-600 font-bold text-[8px]">Sai</span>
                </div>
                <div className="flex items-center space-x-0.5">
                  <span className="w-3 h-3 rounded-full border border-black text-black text-[7px] flex items-center justify-center font-bold">✓</span>
                  <span className="text-red-600 font-bold text-[8px]">Sai</span>
                </div>
              </div>
            </div>

            <div className="border border-black p-0.5 flex justify-between items-center text-center">
              <div className="flex-1 border-r border-gray-300 pr-0.5">
                <span className="font-bold block text-[8.5px]">ĐIỂM SỐ</span>
                <div className="h-3.5" />
              </div>
              <div className="flex-1 pl-0.5">
                <span className="font-bold block text-[8.5px]">CÁN BỘ CHẤM</span>
                <div className="h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Tô Số Báo Danh (4 số) và Mã Đề (3 số) */}
        <div className="col-span-5 flex gap-1">
          {/* Vùng tô Số Báo Danh (4 chữ số) */}
          <div className="flex-1 border border-black p-1 rounded-sm bg-white">
            <div className="text-center font-bold text-[9px] uppercase border-b border-black pb-0.5 mb-0.5 bg-gray-100">
              SỐ BÁO DANH
            </div>
            {/* Hàng viết số tay */}
            <div className="grid grid-cols-4 gap-0.5 mb-0.5">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-3.5 border border-black text-center font-bold text-[9px] leading-3.5 bg-yellow-50/50" />
              ))}
            </div>
            {/* Lưới các ô tròn 0 - 9 */}
            <div className="space-y-[1px]">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <div key={digit} className="grid grid-cols-4 gap-0.5 items-center">
                  {[0, 1, 2, 3].map((colIdx) => (
                    <div
                      key={colIdx}
                      className="w-3 h-3 mx-auto rounded-full border border-black flex items-center justify-center text-[7px] font-bold hover:bg-black hover:text-white transition-colors"
                      data-omr-sbd={`${colIdx}-${digit}`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Vùng tô Mã Đề (3 chữ số) */}
          <div className="w-[38%] border border-black p-1 rounded-sm bg-white">
            <div className="text-center font-bold text-[9px] uppercase border-b border-black pb-0.5 mb-0.5 bg-gray-100">
              MÃ ĐỀ
            </div>
            {/* Hàng viết mã đề tay */}
            <div className="grid grid-cols-3 gap-0.5 mb-0.5">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-3.5 border border-black text-center font-bold text-[9px] leading-3.5 bg-yellow-50/50" />
              ))}
            </div>
            {/* Lưới các ô tròn 0 - 9 */}
            <div className="space-y-[1px]">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <div key={digit} className="grid grid-cols-3 gap-0.5 items-center">
                  {[0, 1, 2].map((colIdx) => (
                    <div
                      key={colIdx}
                      className="w-3 h-3 mx-auto rounded-full border border-black flex items-center justify-center text-[7px] font-bold"
                      data-omr-code={`${colIdx}-${digit}`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VÙNG ĐÁP ÁN: CÁC CỘT CÂU HỎI VỚI CÁC Ô TRÒN A - B - C - D                 */}
      {/* ========================================================================= */}
      <div className="border border-black p-1 rounded-sm bg-white flex-1 flex flex-col justify-start">
        <div className="text-center font-black text-[10px] uppercase tracking-wider border-b border-black pb-0.5 mb-0.5 bg-gray-100 flex justify-between px-2">
          <span>PHẦN TRẢ LỜI CÁC CÂU HỎI</span>
          <span className="font-normal text-[8.5px] italic">Tô đậm một phương án duy nhất cho mỗi câu</span>
        </div>

        {/* Bố cục cột câu hỏi linh hoạt */}
        <div
          className="grid gap-1.5 flex-1"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((colQuestions, colIdx) => (
            <div
              key={colIdx}
              className={`space-y-[1.5px] ${colIdx < columns.length - 1 ? 'border-r border-gray-400 pr-1.5' : ''}`}
            >
              {/* Header cột */}
              <div className="flex items-center justify-between text-[8px] font-bold border-b border-gray-400 pb-0.5 px-0.5 text-gray-700">
                <span className="w-5 text-center">Câu</span>
                <span className="w-3.5 text-center">A</span>
                <span className="w-3.5 text-center">B</span>
                <span className="w-3.5 text-center">C</span>
                <span className="w-3.5 text-center">D</span>
              </div>

              {/* Danh sách câu hỏi trong cột */}
              {colQuestions.map((qNum) => (
                <div
                  key={qNum}
                  className={`flex items-center justify-between py-[1px] px-0.5 rounded ${
                    qNum % 5 === 0 ? 'bg-gray-100 font-semibold border-b border-gray-300' : ''
                  }`}
                  data-omr-question={qNum}
                >
                  <span className="w-5 text-[8.5px] font-bold text-center">
                    {String(qNum).padStart(2, '0')}
                  </span>
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <div
                      key={opt}
                      className="w-3.5 h-3.5 rounded-full border border-black flex items-center justify-center text-[7.5px] font-bold"
                      data-omr-choice={`${qNum}-${opt}`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER: DÒNG ĐỊNH VỊ ĐÁY */}
      <div className="text-center text-[7.5px] text-gray-500 font-mono mt-1">
        HỆ THỐNG TRẮC NGHIỆM QUÂN SỰ VPA • PHIẾU CHẤM TỰ ĐỘNG BẰNG CAMERA • KHỔ A4 TIÊU CHUẨN
      </div>
    </div>
  );
};
