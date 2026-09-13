import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Printer, Check } from '../icons';
import { OmrSheetPage, type OmrPrintData } from './OmrSheetTemplate';

interface OmrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz?: any;
  omrExam?: any;
  availableQuizzes?: any[];
  defaultUnit?: string;
  defaultUpperUnit?: string;
}

export const OmrPrintModal: React.FC<OmrPrintModalProps> = ({
  isOpen,
  onClose,
  quiz: initialQuiz,
  omrExam,
  availableQuizzes = [],
  defaultUnit = '',
  defaultUpperUnit = ''
}) => {
  const [quizzesList, setQuizzesList] = useState<any[]>(availableQuizzes);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(omrExam?.quizId || initialQuiz || null);
  const [upperUnit, setUpperUnit] = useState(omrExam?.upperUnit || defaultUpperUnit || 'BỘ QUỐC PHÒNG');
  const [currentUnit, setCurrentUnit] = useState(omrExam?.currentUnit || defaultUnit || 'ĐƠN VỊ TỔ CHỨC THI');
  const [examCode, setExamCode] = useState(omrExam?.examCodes?.[0] || '101');
  const [availableExamCodes, setAvailableExamCodes] = useState<string[]>(
    omrExam?.examCodes && omrExam.examCodes.length > 0 ? omrExam.examCodes : ['101']
  );
  const [printAllCodes, setPrintAllCodes] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState(omrExam?.roomCode || '');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(40);
  const [totalQuestions, setTotalQuestions] = useState<number>(40);

  // 1. Tải danh sách đề thi nếu chưa có
  useEffect(() => {
    if (availableQuizzes && availableQuizzes.length > 0) {
      setQuizzesList(availableQuizzes);
      if (!selectedQuiz && availableQuizzes.length > 0) {
        setSelectedQuiz(availableQuizzes[0]);
      }
    } else {
      axios.get('/api/quizzes', { params: { includeVariants: 'true' } })
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data.quizzes || []);
          setQuizzesList(list);
          if (!selectedQuiz && list.length > 0) {
            setSelectedQuiz(list[0]);
          }
        })
        .catch(err => console.error('Lỗi tải danh sách đề thi:', err));
    }
  }, [availableQuizzes]);

  // 2. Đồng bộ khi nhận props omrExam hoặc initialQuiz
  useEffect(() => {
    if (omrExam) {
      if (omrExam.quizId) setSelectedQuiz(omrExam.quizId);
      if (omrExam.upperUnit) setUpperUnit(omrExam.upperUnit);
      if (omrExam.currentUnit) setCurrentUnit(omrExam.currentUnit);
      if (omrExam.roomCode) setRoomCode(omrExam.roomCode);

      if (omrExam.examCodes && omrExam.examCodes.length > 0) {
        setAvailableExamCodes(omrExam.examCodes);
        setExamCode(omrExam.examCodes[0]);
      }

      const qCount = omrExam.totalQuestions || omrExam.quizId?.questions?.length || 40;
      setQuizQuestionCount(qCount);
      setTotalQuestions(qCount);
    } else if (initialQuiz) {
      setSelectedQuiz(initialQuiz);
    }
  }, [omrExam, initialQuiz]);

  // 3. Tải chi tiết Đề thi (bao gồm số câu hỏi và tất cả mã đề biến thể) khi chọn đề thi
  useEffect(() => {
    if (!selectedQuiz) return;

    const quizId = typeof selectedQuiz === 'string' ? selectedQuiz : selectedQuiz._id;
    if (!quizId) return;

    axios.get(`/api/quizzes/${quizId}`, { params: { includeVariants: 'true' } })
      .then(res => {
        const fullQuiz = res.data;
        const count = fullQuiz.questions?.length || fullQuiz.totalQuestions || 40;
        setQuizQuestionCount(count);
        setTotalQuestions(count);

        // Trích xuất tất cả các mã đề thi của đề gốc và đề biến thể
        let codes: string[] = [];
        if (omrExam?.examCodes && omrExam.examCodes.length > 0) {
          codes = omrExam.examCodes;
        } else {
          if (fullQuiz.examCode) codes.push(String(fullQuiz.examCode).trim());
          if (Array.isArray(fullQuiz.variants)) {
            fullQuiz.variants.forEach((v: any) => {
              if (v.examCode && !codes.includes(String(v.examCode).trim())) {
                codes.push(String(v.examCode).trim());
              }
            });
          }
        }

        if (codes.length === 0) codes = ['101'];
        setAvailableExamCodes(codes);
        if (!codes.includes(examCode)) {
          setExamCode(codes[0]);
        }
      })
      .catch(err => {
        console.error('Lỗi tải chi tiết đề thi:', err);
        const fallbackCount = selectedQuiz.questions?.length || selectedQuiz.totalQuestions || 40;
        setQuizQuestionCount(fallbackCount);
        setTotalQuestions(fallbackCount);
      });

    if (defaultUpperUnit && !omrExam) setUpperUnit(defaultUpperUnit);
    if (defaultUnit && !omrExam) setCurrentUnit(defaultUnit);
  }, [selectedQuiz, defaultUnit, defaultUpperUnit, omrExam]);

  if (!isOpen) return null;

  const currentQuiz = selectedQuiz || omrExam?.quizId || initialQuiz || { _id: 'SAMPLE_QUIZ', title: 'Bài kiểm tra trắc nghiệm', questions: [] };

  const printData: OmrPrintData = {
    upperUnit,
    currentUnit,
    quizTitle: currentQuiz.title || omrExam?.title || 'Bài kiểm tra',
    quizId: currentQuiz._id || '',
    batchCode: omrExam?.code || '',
    batchId: omrExam?._id || '',
    totalQuestions,
    examCode,
    roomCode
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanTitle = (currentQuiz.title || 'Phieu_OMR').replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');
    document.title = printAllCodes
      ? `Phieu_tra_loi_OMR_${cleanTitle}_TatCaMaDe`
      : `Phieu_tra_loi_OMR_${cleanTitle}_MaDe_${examCode}`;

    window.print();
    document.title = originalTitle;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light/50 w-full max-w-5xl h-[94vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 py-3 border-b border-vpa-olive-light/30 flex items-center justify-between bg-vpa-olive/10 dark:bg-vpa-gold/10">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-vpa-gold rounded-sm inline-block" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-gold">
              In Phiếu Trả Lời Trắc Nghiệm OMR (Chuẩn A4 Máy Quét)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-500 hover:text-vpa-red hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Content split into Settings (Left) & Live Preview (Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Settings Sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-vpa-olive-light/20 p-4 overflow-y-auto space-y-4 bg-vpa-sand/50 dark:bg-vpa-dark/50 text-xs">
            {/* Chọn Đề Thi */}
            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Chọn Đề thi cần in phiếu</label>
              {quizzesList.length > 0 ? (
                <select
                  value={selectedQuiz?._id || ''}
                  onChange={(e) => {
                    const found = quizzesList.find(q => q._id === e.target.value);
                    if (found) setSelectedQuiz(found);
                  }}
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand font-bold"
                >
                  {quizzesList.map(q => (
                    <option key={q._id} value={q._id}>
                      {q.title} ({q.questions?.length || q.totalQuestions || 40} câu)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={currentQuiz.title || ''}
                  disabled
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-gray-100 dark:bg-vpa-dark text-gray-600 font-semibold"
                />
              )}
            </div>

            {/* Số câu hỏi (Tự động khớp chính xác với số câu của đề thi) */}
            <div className="space-y-1.5 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded">
              <div className="flex items-center justify-between">
                <label className="font-bold text-emerald-900 dark:text-emerald-300">
                  Số câu hỏi trên phiếu
                </label>
                <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Check size={12} weight="bold" /> Khớp đề thi
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-24 px-2.5 py-1 border border-emerald-600/40 rounded bg-white dark:bg-vpa-dark-card text-emerald-950 dark:text-emerald-200 font-bold font-mono text-sm"
                />
                <span className="text-gray-600 dark:text-gray-300 font-semibold">câu</span>
                {totalQuestions !== quizQuestionCount && (
                  <button
                    type="button"
                    onClick={() => setTotalQuestions(quizQuestionCount)}
                    className="ml-auto text-[10px] text-vpa-olive dark:text-vpa-gold hover:underline font-bold cursor-pointer"
                    title={`Đặt lại số câu đúng theo đề thi (${quizQuestionCount} câu)`}
                  >
                    Về gốc ({quizQuestionCount} câu)
                  </button>
                )}
              </div>
              <p className="text-[10px] text-emerald-800 dark:text-emerald-300 italic">
                * Phiếu in A4 sẽ tự động chia cột câu hỏi từ 1 đến đúng {totalQuestions} câu.
              </p>
            </div>

            {/* Mã đề thi (Đồng bộ với các mã đề của đề thi) */}
            <div className="space-y-1.5 p-2.5 bg-vpa-gold/10 border border-vpa-gold/30 rounded">
              <div className="flex items-center justify-between">
                <label className="font-bold text-gray-800 dark:text-gray-200">
                  Mã đề thi
                </label>
                <span className="text-[10.5px] font-mono text-gray-600 dark:text-gray-400">
                  {availableExamCodes.length} mã đề
                </span>
              </div>

              {/* Các nút chọn mã đề nhanh */}
              {availableExamCodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {availableExamCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setExamCode(code)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        examCode === code && !printAllCodes
                          ? 'bg-vpa-gold text-vpa-dark shadow-sm scale-105 border border-yellow-600'
                          : 'bg-white dark:bg-vpa-dark-card text-gray-700 dark:text-gray-300 border border-gray-300 hover:border-vpa-gold'
                      }`}
                    >
                      Mã {code}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={examCode}
                  disabled={printAllCodes}
                  onChange={(e) => setExamCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand font-mono font-bold disabled:opacity-50"
                  placeholder="101"
                />
              </div>

              {/* Tùy chọn in toàn bộ các mã đề */}
              {availableExamCodes.length > 1 && (
                <label className="flex items-center gap-2 pt-1 border-t border-vpa-gold/20 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printAllCodes}
                    onChange={(e) => setPrintAllCodes(e.target.checked)}
                    className="w-3.5 h-3.5 accent-vpa-gold rounded"
                  />
                  <span className="text-[11px] font-bold text-vpa-olive dark:text-vpa-gold">
                    In toàn bộ {availableExamCodes.length} mã đề ({availableExamCodes.join(', ')})
                  </span>
                </label>
              )}
            </div>

            {/* Đơn vị cấp trên & Đơn vị tổ chức */}
            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Đơn vị cấp trên</label>
              <input
                type="text"
                value={upperUnit}
                onChange={(e) => setUpperUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand uppercase font-semibold"
                placeholder="BỘ QUỐC PHÒNG..."
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Đơn vị tổ chức thi</label>
              <input
                type="text"
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand uppercase font-semibold"
                placeholder="TRUNG ĐOÀN 1..."
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Mã phòng thi (tùy chọn)</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand font-mono uppercase"
                placeholder="VD: PHONG01"
              />
            </div>

            {/* Hướng dẫn in ấn */}
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1">
                <span>💡</span> Lưu ý khi in phiếu OMR:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[10.5px]">
                <li>Chọn khổ giấy <strong>A4</strong>, tỷ lệ <strong>100% (Fit to page)</strong> khi in.</li>
                <li>4 hình vuông đen ở 4 góc là điểm neo để camera tự căn góc phối cảnh.</li>
                <li>Mã QR ở góc trên chứa thông tin đề thi và số câu để camera tự nhận diện.</li>
              </ul>
            </div>

            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-4 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark font-bold rounded shadow hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Printer size={16} weight="bold" />
              <span>
                {printAllCodes
                  ? `In Tất Cả ${availableExamCodes.length} Mã Đề (${availableExamCodes.join(', ')})`
                  : `In Phiếu Trả Lời (Mã ${examCode} • ${totalQuestions} câu)`}
              </span>
            </button>
          </div>

          {/* Live Preview Area */}
          <div className="flex-1 bg-gray-200 dark:bg-black/60 p-4 overflow-y-auto flex flex-col items-center justify-start gap-4">
            {printAllCodes && availableExamCodes.length > 1 ? (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 rounded text-center text-xs font-bold text-yellow-900 dark:text-yellow-200 w-full max-w-xl">
                  📄 Chế độ in hàng loạt: Sẽ in {availableExamCodes.length} trang A4 riêng biệt cho các mã đề ({availableExamCodes.join(', ')}).
                </div>
                {availableExamCodes.map((code) => (
                  <div key={code} className="origin-top transform scale-[0.68] sm:scale-[0.78] md:scale-[0.82] lg:scale-[0.88] shadow-2xl transition-transform">
                    <OmrSheetPage data={{ ...printData, examCode: code }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="origin-top transform scale-[0.68] sm:scale-[0.78] md:scale-[0.82] lg:scale-[0.88] shadow-2xl transition-transform">
                <OmrSheetPage data={printData} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit Print Rules: Force Portrait A4 and Exact Color reproduction */}
      <style>{`
        @page {
          size: A4 portrait !important;
          margin: 0 !important;
        }
        @media print {
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .omr-print-target {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Hidden container exclusively rendered during window.print() */}
      <div className="hidden print:block omr-print-target">
        {printAllCodes && availableExamCodes.length > 1 ? (
          availableExamCodes.map((code) => (
            <OmrSheetPage key={code} data={{ ...printData, examCode: code }} />
          ))
        ) : (
          <OmrSheetPage data={printData} />
        )}
      </div>
    </div>,
    document.body
  );
};
