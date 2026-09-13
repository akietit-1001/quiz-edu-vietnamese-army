import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, Printer } from '../icons';
import { OmrSheetPage, type OmrPrintData } from './OmrSheetTemplate';

interface OmrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz?: any;
  availableQuizzes?: any[];
  defaultUnit?: string;
  defaultUpperUnit?: string;
}

export const OmrPrintModal: React.FC<OmrPrintModalProps> = ({
  isOpen,
  onClose,
  quiz: initialQuiz,
  availableQuizzes = [],
  defaultUnit = '',
  defaultUpperUnit = ''
}) => {
  const [quizzesList, setQuizzesList] = useState<any[]>(availableQuizzes);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(initialQuiz || null);
  const [upperUnit, setUpperUnit] = useState(defaultUpperUnit || 'BỘ QUỐC PHÒNG');
  const [currentUnit, setCurrentUnit] = useState(defaultUnit || 'ĐƠN VỊ TỔ CHỨC THI');
  const [examCode, setExamCode] = useState('101');
  const [roomCode, setRoomCode] = useState('');
  const [totalQuestions, setTotalQuestions] = useState<number>(initialQuiz?.questions?.length || 40);

  // Tải danh sách đề thi nếu chưa có
  useEffect(() => {
    if (availableQuizzes && availableQuizzes.length > 0) {
      setQuizzesList(availableQuizzes);
      if (!selectedQuiz && availableQuizzes.length > 0) {
        setSelectedQuiz(availableQuizzes[0]);
      }
    } else {
      axios.get('/api/quizzes')
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

  useEffect(() => {
    if (initialQuiz) {
      setSelectedQuiz(initialQuiz);
    }
  }, [initialQuiz]);

  useEffect(() => {
    if (selectedQuiz) {
      const qCount = selectedQuiz.questions?.length || selectedQuiz.totalQuestions || 40;
      setTotalQuestions(qCount);
    }
    if (defaultUpperUnit) setUpperUnit(defaultUpperUnit);
    if (defaultUnit) setCurrentUnit(defaultUnit);
  }, [selectedQuiz, defaultUnit, defaultUpperUnit]);

  if (!isOpen) return null;

  const currentQuiz = selectedQuiz || initialQuiz || { _id: 'SAMPLE_QUIZ', title: 'Bài kiểm tra trắc nghiệm', questions: [] };

  const printData: OmrPrintData = {
    upperUnit,
    currentUnit,
    quizTitle: currentQuiz.title || 'Bài kiểm tra',
    quizId: currentQuiz._id || '',
    totalQuestions,
    examCode,
    roomCode
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanTitle = (currentQuiz.title || 'Phieu_OMR').replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');
    document.title = `Phieu_tra_loi_OMR_${cleanTitle}_MaDe_${examCode}`;

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
            className="p-1 rounded text-gray-500 hover:text-vpa-red hover:bg-black/10 transition-colors"
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
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-gray-100 dark:bg-vpa-dark text-gray-600"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Đơn vị cấp trên</label>
              <input
                type="text"
                value={upperUnit}
                onChange={(e) => setUpperUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand"
                placeholder="BỘ QUỐC PHÒNG..."
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-700 dark:text-gray-300 block">Đơn vị tổ chức thi</label>
              <input
                type="text"
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand"
                placeholder="TRUNG ĐOÀN 1..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300 block">Mã đề thi</label>
                <input
                  type="text"
                  maxLength={4}
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand font-mono font-bold"
                  placeholder="101"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-gray-300 block">Số câu hỏi</label>
                <select
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-vpa-olive-light/40 rounded bg-white dark:bg-vpa-dark-card text-vpa-dark dark:text-vpa-sand font-bold"
                >
                  <option value={20}>20 câu</option>
                  <option value={30}>30 câu</option>
                  <option value={40}>40 câu</option>
                  <option value={50}>50 câu</option>
                  <option value={60}>60 câu</option>
                  <option value={80}>80 câu</option>
                  <option value={100}>100 câu</option>
                </select>
              </div>
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

            {/* Hướng dẫn kỹ thuật */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1">
                <span>💡</span> Lưu ý in ấn OMR:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[10.5px]">
                <li>Chọn khổ giấy <strong>A4</strong>, tỷ lệ <strong>100% (Fit to page)</strong> khi in.</li>
                <li>4 hình vuông đen ở 4 góc là điểm neo để camera điện thoại tự động căn phẳng.</li>
                <li>Mã QR ở góc trên sẽ giúp camera nhận diện ngay mã đề thi.</li>
              </ul>
            </div>

            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-4 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark font-bold rounded shadow hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
            >
              <Printer size={16} weight="bold" />
              <span>In Phiếu Trả Lời Trắc Nghiệm</span>
            </button>
          </div>

          {/* Live Preview Area */}
          <div className="flex-1 bg-gray-200 dark:bg-black/60 p-4 overflow-y-auto flex items-start justify-center">
            <div className="origin-top transform scale-[0.68] sm:scale-[0.78] md:scale-[0.82] lg:scale-[0.88] shadow-2xl transition-transform">
              <OmrSheetPage data={printData} />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container exclusively rendered during window.print() */}
      <div className="hidden print:block print:fixed print:inset-0 print:m-0 print:p-0 print:bg-white print:z-[99999]">
        <OmrSheetPage data={printData} />
      </div>
    </div>,
    document.body
  );
};
