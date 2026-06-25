import React, { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';

interface VPAExportPopupProps {
  isOpen: boolean;
  onConfirm: (data: {
    upperUnit: string;
    currentUnit: string;
    position: string;
    province: string;
    showSignature: boolean;
    signerRank: string;
    signerName: string;
    format: 'docx' | 'pdf' | 'xlsx' | 'csv';
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    mirrorMargins: boolean;
    orientation?: 'portrait' | 'landscape';
    selectedQuizIds?: string[];
  }) => void;
  onCancel: () => void;
  defaultUnit?: string;
  defaultPosition?: string;
  defaultRank?: string;
  defaultName?: string;
  type: 'quiz' | 'results';
  previewData?: any; // Quiz object or attempts list
}

export const VPAExportPopup: React.FC<VPAExportPopupProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  defaultUnit = '',
  defaultPosition = '',
  defaultRank = 'Đại tá',
  defaultName = 'Nguyễn Văn A',
  type,
  previewData
}) => {
  const [upperUnit, setUpperUnit] = useState('BỘ QUỐC PHÒNG');
  const [currentUnit, setCurrentUnit] = useState(defaultUnit || 'HỌC VIỆN KỸ THUẬT QUÂN SỰ');
  const [position, setPosition] = useState(defaultPosition || 'TRƯỞNG PHÒNG ĐÀO TẠO');
  const [province, setProvince] = useState('Hà Nội');
  const [showSignature, setShowSignature] = useState(true);
  const [signerRank, setSignerRank] = useState(defaultRank);
  const [signerName, setSignerName] = useState(defaultName);
  
  const [marginTop, setMarginTop] = useState<number>(2.5);
  const [marginBottom, setMarginBottom] = useState<number>(2.0);
  const [marginLeft, setMarginLeft] = useState<number>(3.0);
  const [marginRight, setMarginRight] = useState<number>(1.5);
  const [mirrorMargins, setMirrorMargins] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [activePreviewTab, setActivePreviewTab] = useState<string>('parent');

  // Choose format based on type: quiz -> docx/pdf, results -> xlsx/docx/pdf/csv
  const [format, setFormat] = useState<'docx' | 'pdf' | 'xlsx' | 'csv'>(
    type === 'quiz' ? 'docx' : 'xlsx'
  );

  // Sync props when open
  useEffect(() => {
    if (isOpen) {
      if (defaultUnit) setCurrentUnit(defaultUnit);
      if (defaultPosition) setPosition(defaultPosition);
      if (defaultRank) setSignerRank(defaultRank);
      if (defaultName) setSignerName(defaultName);
      setMarginTop(2.5);
      setMarginBottom(2.0);
      setMarginLeft(3.0);
      setMarginRight(1.5);
      setMirrorMargins(true);
      setOrientation('portrait');
      setFormat(type === 'quiz' ? 'docx' : 'xlsx');
      setActivePreviewTab('parent');

      // Initialize selectedQuizIds with the parent and all variant IDs
      if (previewData) {
        const initialIds = [previewData._id];
        if (previewData.variants && Array.isArray(previewData.variants)) {
          previewData.variants.forEach((v: any) => initialIds.push(v._id));
        }
        setSelectedQuizIds(initialIds);
      }
    }
  }, [isOpen, defaultUnit, defaultPosition, defaultRank, defaultName, type, previewData]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    onConfirm({
      upperUnit,
      currentUnit,
      position,
      province,
      showSignature,
      signerRank,
      signerName,
      format,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      mirrorMargins,
      orientation,
      selectedQuizIds
    });
  };

  // SVGs for file formats
  const renderFormatIcon = (fmt: 'docx' | 'pdf' | 'xlsx' | 'csv') => {
    switch (fmt) {
      case 'docx':
        return (
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        );
      case 'xlsx':
      case 'csv':
        return (
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        );
    }
  };

  // Render Quiz questions in preview
  const renderQuizPreviewContent = (currentQuiz: any) => {
    if (!currentQuiz || !currentQuiz.questions) return null;
    const questions = currentQuiz.questions;
    return (
      <div className="mt-4 text-left border-t border-gray-300 pt-4 font-serif text-[11px] text-gray-800">
        <h4 className="text-center font-bold text-[12px] uppercase mb-1 font-serif">ĐỀ THI</h4>
        <p className="text-center font-bold mb-1 font-serif">MÔN THI: {(currentQuiz.title || '').toUpperCase()}</p>
        <p className="text-center italic mb-4 font-serif">Thời gian làm bài: {currentQuiz.duration || 45} phút (Không kể giao đề)</p>
        {currentQuiz.examCode && (
          <div className="text-center mb-3">
            <span className="inline-block border border-black font-mono font-bold px-3 py-0.5 text-[9px] text-black">
              Mã đề: {currentQuiz.examCode}
            </span>
          </div>
        )}
        
        {questions.map((q: any, idx: number) => (
          <div key={idx} className="mb-3 font-serif">
            <p className="font-bold font-serif">Câu {idx + 1}: {q.questionText}</p>
            {q.questionType === 'fill-in-the-blank' ? (
              <p className="pl-4 italic text-gray-500 font-serif">Đáp án: ..........................................................................</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 pl-4 mt-1 font-serif">
                {(q.options || []).map((opt: string, oIdx: number) => (
                  <p key={oIdx} className="font-serif">{String.fromCharCode(65 + oIdx)}. {opt}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render Results table in preview
  const renderResultsPreviewContent = () => {
    if (!previewData || !previewData.attempts) return null;
    const attempts = previewData.attempts.slice(0, 3); // Show first 3 attempts
    return (
      <div className="mt-4 text-left border-t border-gray-300 pt-4 font-serif text-[10px] text-gray-800">
        <h4 className="text-center font-bold text-[11px] uppercase mb-1">BÁO CÁO KẾT QUẢ THI</h4>
        <p className="text-center font-bold mb-3">PHÒNG THI: {previewData.room?.roomCode} - MÔN: {(previewData.room?.quizId?.title || '').toUpperCase()}</p>
        
        <table className="w-full border-collapse border border-gray-400 font-serif">
          <thead>
            <tr className="bg-gray-100 font-bold text-center">
              <th className="border border-gray-400 px-1 py-0.5">Họ và tên</th>
              <th className="border border-gray-400 px-1 py-0.5">Cấp bậc</th>
              <th className="border border-gray-400 px-1 py-0.5">Đơn vị</th>
              <th className="border border-gray-400 px-1 py-0.5">Điểm</th>
              <th className="border border-gray-400 px-1 py-0.5">Kết quả</th>
              <th className="border border-gray-400 px-1 py-0.5">Xếp loại</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((att: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-gray-400 px-1 py-0.5 font-bold">{att.userId?.fullName}</td>
                <td className="border border-gray-400 px-1 py-0.5 text-center">{att.userId?.rank || 'Binh nhì'}</td>
                <td className="border border-gray-400 px-1 py-0.5">{att.userId?.unit}</td>
                <td className="border border-gray-400 px-1 py-0.5 text-center">{att.score}/{att.totalQuestions}</td>
                <td className="border border-gray-400 px-1 py-0.5 text-center font-bold text-green-700">{att.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
                <td className="border border-gray-400 px-1 py-0.5 text-center">{att.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {previewData.attempts.length > 3 && (
          <p className="text-center italic text-gray-500 border-t border-dashed border-gray-300 pt-1 mt-2">
            [...còn tiếp {previewData.attempts.length - 3} kết quả học viên khác...]
          </p>
        )}
      </div>
    );
  };

  // Spreadsheet preview grid
  const renderSpreadsheetPreview = () => {
    if (!previewData) return null;
    const records = type === 'quiz' 
      ? (previewData.questions || [])
      : (previewData.attempts || []);
      
    const sampleRows = records.slice(0, 4);

    return (
      <div className="bg-white dark:bg-vpa-dark-card border border-green-700 p-2 font-mono text-[9px] min-h-[260px] overflow-x-auto select-none rounded shadow">
        {/* Spreadsheet headers */}
        <div className="flex bg-green-800 text-white font-bold px-2 py-1 items-center justify-between border-b border-green-950 mb-2">
          <span className="font-sans text-[10px] tracking-wide flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 15H5v-2h4.5v2zm0-3.5H5v-2h4.5v2zm0-3.5H5V7h4.5v2zm6 7H10.5v-2h5v2zm0-3.5H10.5v-2h5v2zm0-3.5H10.5V7h5v2zm4 7H16v-2h3v2zm0-3.5H16v-2h3v2zm0-3.5H16V7h3v2z"/></svg>
            BẢNG TÍNH EXCEL - TRÌNH XEM TRƯỚC
          </span>
          <span className="bg-green-700 text-[8px] px-1 py-0.2 rounded font-sans uppercase">{format}</span>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-gray-700 dark:text-gray-300">
          <thead>
            <tr className="bg-gray-100 dark:bg-vpa-olive-light/20 text-center font-bold">
              <th className="border border-gray-300 w-6 bg-gray-200 dark:bg-vpa-olive-light/40"></th>
              {type === 'quiz' ? (
                <>
                  <th className="border border-gray-300 px-1 py-1">Câu hỏi</th>
                  <th className="border border-gray-300 px-1 py-1">Loại</th>
                  <th className="border border-gray-300 px-1 py-1">Đáp án</th>
                  <th className="border border-gray-300 px-1 py-1">Giải thích</th>
                </>
              ) : (
                <>
                  <th className="border border-gray-300 px-1 py-1">Họ và tên</th>
                  <th className="border border-gray-300 px-1 py-1">Đơn vị</th>
                  <th className="border border-gray-300 px-1 py-1">Cấp bậc</th>
                  <th className="border border-gray-300 px-1 py-1">Đúng</th>
                  <th className="border border-gray-300 px-1 py-1">Xếp loại</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-green-50/20">
                <td className="border border-gray-300 text-center bg-gray-150 dark:bg-vpa-olive-light/10 font-bold text-gray-500 w-6">{idx + 1}</td>
                {type === 'quiz' ? (
                  <>
                    <td className="border border-gray-300 px-1 py-1 max-w-[120px] truncate">{item.questionText}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center">{item.questionType}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center truncate">{item.correctAnswers?.join(', ')}</td>
                    <td className="border border-gray-300 px-1 py-1 truncate">{item.explanation || ''}</td>
                  </>
                ) : (
                  <>
                    <td className="border border-gray-300 px-1 py-1 font-bold truncate">{item.userId?.fullName}</td>
                    <td className="border border-gray-300 px-1 py-1 truncate">{item.userId?.unit}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center">{item.userId?.rank || 'Binh nhì'}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold">{item.score}/{item.totalQuestions}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center">{item.rank}</td>
                  </>
                )}
              </tr>
            ))}
            {records.length > 4 && (
              <tr>
                <td className="border border-gray-300 text-center bg-gray-150 dark:bg-vpa-olive-light/10 font-bold text-gray-500">...</td>
                <td colSpan={type === 'quiz' ? 4 : 5} className="border border-gray-300 px-2 py-1 text-center italic text-gray-400">
                  [...Đã tải {records.length} dòng dữ liệu...]
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const allVersions: any[] = [];
  if (type === 'quiz' && previewData) {
    allVersions.push({
      id: 'parent',
      label: `Mã đề ${previewData.examCode || 'Gốc / 001'}`,
      quiz: previewData,
      checked: selectedQuizIds.includes(previewData._id)
    });
    if (previewData.variants && Array.isArray(previewData.variants)) {
      [...previewData.variants]
        .sort((a: any, b: any) => (a.examCode || '').localeCompare(b.examCode || ''))
        .forEach((v: any) => {
          allVersions.push({
            id: v._id,
            label: `Mã đề ${v.examCode || 'N/A'}`,
            quiz: v,
            checked: selectedQuizIds.includes(v._id)
          });
        });
    }
  }

  const currentQuizToShow = type === 'quiz'
    ? (allVersions.find(v => v.id === activePreviewTab)?.quiz || previewData)
    : previewData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none animate-fadeIn lg:h-[85vh] lg:max-h-[850px] max-h-[95vh] overflow-y-auto lg:overflow-hidden relative">
        
        {/* Absolute Close Button (X) */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-vpa-olive-light hover:text-vpa-red dark:text-vpa-sand/50 dark:hover:text-vpa-red transition-colors p-1.5 z-50 rounded-none border border-transparent hover:border-vpa-red/20 hover:bg-vpa-red/5"
          title="Đóng"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Left Column: Form & Settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-vpa-olive-light/20 pb-6 lg:pb-0 lg:pr-6 lg:h-full lg:max-h-full lg:overflow-y-auto pr-1 min-h-0">
          <div>
            {/* Header decoration */}
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3.5 h-3.5 bg-vpa-gold-bright rounded-none" />
              <h3 className="text-sm font-black tracking-wide uppercase text-vpa-olive dark:text-vpa-sand">
                Cấu hình
              </h3>
            </div>

            {/* Export Format Selectors */}
            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2">
                Định dạng tệp tin
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('docx')}
                  className={`p-3 border flex flex-col items-center justify-center space-y-1.5 transition-all rounded-none ${
                    format === 'docx'
                      ? 'border-blue-600 bg-blue-50/10 text-blue-800 dark:text-blue-300 shadow'
                      : 'border-vpa-olive-light/30 text-gray-400 hover:border-vpa-olive-light'
                  }`}
                >
                  {renderFormatIcon('docx')}
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tệp Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`p-3 border flex flex-col items-center justify-center space-y-1.5 transition-all rounded-none ${
                    format === 'pdf'
                      ? 'border-red-600 bg-red-50/10 text-red-800 dark:text-red-300 shadow'
                      : 'border-vpa-olive-light/30 text-gray-400 hover:border-vpa-olive-light'
                  }`}
                >
                  {renderFormatIcon('pdf')}
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tệp PDF (.pdf)</span>
                </button>

                {type === 'results' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFormat('xlsx')}
                      className={`p-3 border flex flex-col items-center justify-center space-y-1.5 transition-all rounded-none ${
                        format === 'xlsx'
                          ? 'border-green-600 bg-green-50/10 text-green-800 dark:text-green-300 shadow'
                          : 'border-vpa-olive-light/30 text-gray-400 hover:border-vpa-olive-light'
                      }`}
                    >
                      {renderFormatIcon('xlsx')}
                      <span className="text-[10px] font-bold uppercase tracking-wider">Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormat('csv')}
                      className={`p-3 border flex flex-col items-center justify-center space-y-1.5 transition-all rounded-none ${
                        format === 'csv'
                          ? 'border-green-700 bg-green-50/20 text-green-800 dark:text-green-300 shadow'
                          : 'border-vpa-olive-light/30 text-gray-400 hover:border-vpa-olive-light'
                      }`}
                    >
                      {renderFormatIcon('csv')}
                      <span className="text-[10px] font-bold uppercase tracking-wider">Tệp CSV (.csv)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quiz Codes/Variants Selector */}
            {type === 'quiz' && previewData && previewData.variants && previewData.variants.length > 0 && (
              <div className="mb-5 p-3 border border-vpa-olive-light/25 bg-vpa-olive-light/5 space-y-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Chọn mã đề thi muốn xuất bản
                </label>
                <div className="space-y-2">
                  {/* Parent Quiz */}
                  <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-vpa-olive-light/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedQuizIds.includes(previewData._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuizIds(prev => [...prev, previewData._id]);
                        } else {
                          setSelectedQuizIds(prev => prev.filter(id => id !== previewData._id));
                        }
                      }}
                      className="w-4 h-4 accent-vpa-gold rounded-none cursor-pointer"
                    />
                    <span className="text-xs text-vpa-olive dark:text-vpa-sand">
                      Mã đề {previewData.examCode || 'Gốc'}
                    </span>
                  </label>
                  {/* Variants */}
                  {[...previewData.variants]
                    .sort((a: any, b: any) => (a.examCode || '').localeCompare(b.examCode || ''))
                    .map((v: any) => (
                      <label key={v._id} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-vpa-olive-light/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedQuizIds.includes(v._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQuizIds(prev => [...prev, v._id]);
                            } else {
                              setSelectedQuizIds(prev => prev.filter(id => id !== v._id));
                            }
                          }}
                          className="w-4 h-4 accent-vpa-gold rounded-none cursor-pointer"
                        />
                        <span className="text-xs text-vpa-olive dark:text-vpa-sand">
                          Mã đề {v.examCode || 'N/A'}
                        </span>
                      </label>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Page Setup: Only show for Docx/PDF */}
            {(format === 'docx' || format === 'pdf') && (
              <div className="mb-5 p-3 border border-vpa-olive-light/25 bg-vpa-olive-light/5 space-y-3">
                <div className="flex items-center space-x-2 border-b border-vpa-olive-light/10 pb-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">Cấu hình trang in</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Hướng giấy</label>
                    <div className="flex border border-vpa-olive-light/30">
                      <button
                        type="button"
                        onClick={() => setOrientation('portrait')}
                        className={`flex-1 text-[10px] py-1 text-center font-bold transition-all ${
                          orientation === 'portrait'
                            ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-vpa-dark-card/50'
                        }`}
                      >
                        Dọc (Portrait)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrientation('landscape')}
                        className={`flex-1 text-[10px] py-1 text-center font-bold transition-all ${
                          orientation === 'landscape'
                            ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark'
                            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-vpa-dark-card/50'
                        }`}
                      >
                        Ngang (Landscape)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Căn lề (cm)</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <span className="block text-[8px] text-gray-400 text-center mb-0.5">Trên (Top)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={marginTop}
                          onChange={e => setMarginTop(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs p-1 text-center bg-transparent border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-gray-400 text-center mb-0.5">Dưới (Bot)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={marginBottom}
                          onChange={e => setMarginBottom(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs p-1 text-center bg-transparent border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-gray-400 text-center mb-0.5">Trái (Left)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={marginLeft}
                          onChange={e => setMarginLeft(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs p-1 text-center bg-transparent border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                        />
                      </div>
                      <div>
                        <span className="block text-[8px] text-gray-400 text-center mb-0.5">Phải (Right)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={marginRight}
                          onChange={e => setMarginRight(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs p-1 text-center bg-transparent border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="block text-[10px] font-bold text-vpa-olive dark:text-vpa-sand">Đảo lề trang chẵn</span>
                      <p className="text-[8px] text-gray-500">Đối xứng lề Trái/Phải cho trang chẵn khi in</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={mirrorMargins}
                      onChange={e => setMirrorMargins(e.target.checked)}
                      className="w-4 h-4 accent-vpa-gold rounded-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Signature Toggle */}
            <div className="mb-5 p-3 bg-vpa-olive-light/10 border border-vpa-olive-light/20 flex items-center justify-between">
              <div>
                <label htmlFor="popup-showSignature" className="block text-xs font-bold text-vpa-olive dark:text-vpa-sand cursor-pointer">Hiện chữ ký chỉ huy</label>
                <p className="text-[9px] text-gray-500">Đính kèm khung ký xác nhận ở cuối văn bản</p>
              </div>
              <input
                type="checkbox"
                id="popup-showSignature"
                checked={showSignature}
                onChange={e => setShowSignature(e.target.checked)}
                className="w-4.5 h-4.5 accent-vpa-gold rounded-none cursor-pointer"
              />
            </div>

            {/* Setup Inputs */}
            <div className="space-y-3">
              <div>
                <label htmlFor="popup-upperUnit" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị cấp trên</label>
                <input
                  type="text"
                  id="popup-upperUnit"
                  value={upperUnit}
                  onChange={e => setUpperUnit(e.target.value)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono uppercase"
                />
              </div>
              <div>
                <label htmlFor="popup-currentUnit" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị hiện tại</label>
                <input
                  type="text"
                  id="popup-currentUnit"
                  value={currentUnit}
                  onChange={e => setCurrentUnit(e.target.value)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono uppercase"
                />
              </div>
              <div>
                <label htmlFor="popup-position" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chức vụ người ký</label>
                <input
                  type="text"
                  id="popup-position"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono uppercase"
                />
              </div>

              {showSignature && (
                <div className="grid grid-cols-2 gap-2 border-l-2 border-vpa-gold pl-2 my-2 py-1">
                  <div>
                    <label htmlFor="popup-signerRank" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Cấp bậc người ký</label>
                    <input
                      type="text"
                      id="popup-signerRank"
                      value={signerRank}
                      onChange={e => setSignerRank(e.target.value)}
                      placeholder="VD: Đại tá"
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="popup-signerName" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Họ tên người ký</label>
                    <input
                      type="text"
                      id="popup-signerName"
                      value={signerName}
                      onChange={e => setSignerName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A"
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="popup-province" className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Địa danh / Tỉnh</label>
                <input
                  type="text"
                  id="popup-province"
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-vpa-olive-light/20 pt-4 mt-6">
            <button
              type="button"
              onClick={handleConfirmClick}
              className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-none font-bold w-full md:w-auto text-center"
            >
              {format === 'pdf' ? 'Xác nhận in PDF' : 'Xác nhận tải tệp'}
            </button>
          </div>
        </div>

        {/* Right Column: Premium Document Live Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col lg:h-full lg:max-h-full min-h-0">
          <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-2 flex-shrink-0">
            Xem trước
          </label>
          
          {type === 'quiz' && allVersions.length > 1 && (
            <div className="flex border-b border-vpa-olive-light/20 mb-3 bg-vpa-sand/20 dark:bg-vpa-dark/20 p-1 gap-1.5 flex-wrap flex-shrink-0">
              {allVersions.map((ver) => (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => setActivePreviewTab(ver.id)}
                  className={`px-3 py-1 text-[10px] font-bold transition-all uppercase rounded-none flex items-center space-x-1.5 ${
                    activePreviewTab === ver.id
                      ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark shadow'
                      : 'text-vpa-olive-light dark:text-vpa-sand hover:bg-vpa-sand-light dark:hover:bg-vpa-dark-card/50'
                  } ${!ver.checked ? 'opacity-50' : ''}`}
                >
                  <span>{ver.label}</span>
                  {!ver.checked && (
                    <span className="text-[8px] bg-gray-400 text-white dark:bg-gray-700 px-1 py-0.2 lowercase font-normal">
                      (không xuất)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {(format === 'xlsx' || format === 'csv') ? (
            renderSpreadsheetPreview()
          ) : (
            <div className="border border-vpa-olive-light/35 bg-vpa-sand/30 dark:bg-vpa-dark-card/50 p-6 font-serif leading-relaxed flex-1 overflow-y-auto select-none rounded shadow-inner text-black flex justify-center items-start min-h-[350px]">
              <div 
                className={`bg-white border border-gray-200 shadow-md transition-all duration-300 ${
                  orientation === 'landscape' 
                    ? 'w-full max-w-2xl aspect-[1.41/1]' 
                    : 'w-full max-w-md aspect-[1/1.41]'
                }`}
                style={{
                  paddingTop: `${marginTop * 14}px`,
                  paddingBottom: `${marginBottom * 14}px`,
                  paddingLeft: `${marginLeft * 14}px`,
                  paddingRight: `${marginRight * 14}px`
                }}
              >
                
                {/* VPA Document Header block */}
                <div className="flex justify-between items-start text-[10px] leading-tight mb-6 text-black font-serif">
                  <div className="text-center w-[38%] font-serif">
                    <p className="uppercase font-serif">{upperUnit || 'BỘ QUỐC PHÒNG'}</p>
                    <p className="font-bold uppercase font-serif">{currentUnit || 'ĐƠN VỊ THI'}</p>
                    <p className="font-bold tracking-tighter mt-0.5">---------</p>
                  </div>
                  <div className="text-center w-[58%] font-serif">
                    <p className="font-bold text-[10.5px] font-serif whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold border-b border-black pb-1 inline-block mx-auto text-[10.5px] font-serif whitespace-nowrap">
                      Độc lập - Tự do - Hạnh phúc
                    </p>
                    <p className="italic mt-1.5 text-gray-600 font-serif">
                      {province || 'Hà Nội'}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                {/* Dynamic Content block */}
                {type === 'quiz' ? renderQuizPreviewContent(currentQuizToShow) : renderResultsPreviewContent()}

                {/* Signature block preview */}
                {showSignature && (
                  <div className="flex justify-end mt-8 text-black font-serif">
                    <div className="text-center w-[45%] font-serif">
                      <p className="font-bold uppercase text-[11px] font-serif">{position || 'TRƯỞNG PHÒNG ĐÀO TẠO'}</p>
                      <p className="italic text-[9.5px] text-gray-500 mb-10 font-serif">(Ký và ghi rõ họ tên)</p>
                      <p className="font-bold text-[11px] font-serif">{signerRank} {signerName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VPAExportPopup;
