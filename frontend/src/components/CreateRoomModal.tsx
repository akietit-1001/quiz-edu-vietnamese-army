import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Tooltip } from './Tooltip';
import { NumberStepper } from './NumberStepper';

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];

interface CreateRoomModalProps {
  // Đề thi được chọn sẵn khi mở modal (VD: bấm "Tạo phòng thi" ngay trên một
  // dòng đề thi cụ thể trong kho đề thi) — có thể là đề gốc hoặc 1 mã đề biến
  // thể, cả hai trường hợp đều tự khớp đúng vào nhóm đề tương ứng bên dưới.
  initialQuizId?: string;
  onClose: () => void;
  onCreated: (roomCode: string) => void;
}

// Modal "Khởi tạo phòng thi mới" dùng chung cho Dashboard và trang quản lý
// kho đề thi — tự tải danh sách đề thi của riêng nó (không phụ thuộc state
// của trang cha) để có thể nhúng vào bất kỳ trang nào.
export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ initialQuizId, onClose, onCreated }) => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizzesLoaded, setQuizzesLoaded] = useState(false);
  const [searchQuizQuery, setSearchQuizQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(initialQuizId || '');
  const [antiCheat, setAntiCheat] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(0); // 0 = không giới hạn
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await axios.get('/api/quizzes?includeVariants=true');
        setQuizzes(response.data);
      } catch (err) {
        console.error('Lỗi lấy danh sách đề thi:', err);
      } finally {
        setQuizzesLoaded(true);
      }
    };
    fetchQuizzes();
  }, []);

  const filteredQuizzesForSelect = useMemo(() => {
    return quizzes.filter(q => {
      const isChild = !!q.parentQuizId;
      if (isChild) return false;

      const variants = quizzes.filter((v: any) => v.parentQuizId === q._id);
      const allCodes = [q.examCode || (variants.length > 0 ? '001' : ''), ...variants.map((v: any) => v.examCode)].filter(Boolean);

      if (selectedCategoryFilter && q.category !== selectedCategoryFilter) return false;

      if (!searchQuizQuery) return true;
      const term = searchQuizQuery.toLowerCase();

      const matchTitle = q.title.toLowerCase().includes(term);
      const matchShareCode = (q.shareCode || '').toLowerCase().includes(term);
      const matchExamCode = allCodes.some(code => code.toLowerCase().includes(term));
      const matchCreator = (q.creatorId?.fullName || '').toLowerCase().includes(term);

      return matchTitle || matchShareCode || matchExamCode || matchCreator;
    });
  }, [quizzes, selectedCategoryFilter, searchQuizQuery]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz || submitting) return;
    setSubmitting(true);
    try {
      const response = await axios.post('/api/rooms', {
        quizId: selectedQuiz,
        antiCheatEnabled: antiCheat,
        showResultImmediately: showResult,
        maxParticipants
      });
      onCreated(response.data.room.roomCode);
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi tạo phòng thi.', 'Lỗi tạo phòng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-5 shadow-2xl rounded-lg">
        <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light pb-2 mb-3">
          Khởi tạo phòng thi mới
        </h3>

        <form onSubmit={handleCreateRoom} className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-gray-500">Chọn đề thi từ kho</label>

            <div className="relative">
              <input
                type="text"
                value={searchQuizQuery}
                onChange={e => setSearchQuizQuery(e.target.value)}
                placeholder="Tìm theo tên đề thi hoặc mã chia sẻ..."
                className="w-full text-xs p-2 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand rounded-lg"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('')}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-all border ${
                  !selectedCategoryFilter
                    ? 'bg-vpa-olive border-transparent text-white dark:bg-vpa-gold dark:text-vpa-dark'
                    : 'border-vpa-olive-light/20 text-gray-500 hover:border-vpa-olive-light/50 dark:text-vpa-sand'
                }`}
              >
                Tất cả
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat ? '' : cat)}
                  className={`px-2 py-0.5 text-[9px] font-bold uppercase transition-all whitespace-nowrap border ${
                    selectedCategoryFilter === cat
                      ? 'bg-vpa-olive border-transparent text-white dark:bg-vpa-gold dark:text-vpa-dark'
                      : 'border-vpa-olive-light/20 text-gray-500 hover:border-vpa-olive-light/50 dark:text-vpa-sand'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="border border-vpa-olive-light/35 bg-white dark:bg-vpa-dark-card divide-y divide-vpa-olive-light/10 max-h-[260px] overflow-y-auto rounded shadow-inner">
              {!quizzesLoaded ? (
                <div className="p-4 text-center text-xs text-gray-400 italic">Đang tải danh sách đề thi...</div>
              ) : filteredQuizzesForSelect.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 italic">
                  {searchQuizQuery || selectedCategoryFilter ? 'Không tìm thấy đề thi phù hợp với bộ lọc.' : 'Không có đề thi nào trong kho.'}
                </div>
              ) : (
                filteredQuizzesForSelect.map(q => {
                  const isParentSelected = selectedQuiz === q._id;
                  const variants = quizzes.filter((v: any) => v.parentQuizId === q._id);
                  const isAnyVariantSelected = variants.some((v: any) => selectedQuiz === v._id);
                  const isActive = isParentSelected || isAnyVariantSelected;
                  const parentCode = q.examCode || (variants.length > 0 ? '001' : '');

                  return (
                    <div
                      key={q._id}
                      onClick={() => {
                        if (!isActive) {
                          setSelectedQuiz(q._id);
                        }
                      }}
                      className={`p-2.5 text-left transition-all flex flex-col group ${
                        isActive
                          ? 'bg-vpa-olive/15 dark:bg-vpa-gold/15 border-l-4 border-vpa-olive dark:border-vpa-gold'
                          : 'hover:bg-vpa-olive/5 dark:hover:bg-vpa-gold/5 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0">
                          <Tooltip content={q.title} className="block">
                            <h4 className={`text-xs font-bold transition-colors truncate ${
                              isActive ? 'text-vpa-olive dark:text-vpa-gold' : 'text-vpa-olive dark:text-vpa-sand group-hover:text-vpa-olive dark:group-hover:text-vpa-gold-bright'
                            }`}>
                              {q.title}
                            </h4>
                          </Tooltip>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9px] text-gray-400">
                            <span className="font-mono bg-vpa-olive-light/10 dark:bg-vpa-gold/10 px-1.5 py-0.2 rounded text-[8px] text-vpa-olive dark:text-vpa-gold-bright uppercase">{q.category}</span>
                            <span>{q.questions?.length || 0} câu / {q.duration || 45} phút</span>
                            <span className="font-mono font-bold text-vpa-gold uppercase">{q.shareCode}</span>
                            {(() => {
                              const allCodes = [parentCode, ...variants.map((v: any) => v.examCode)].filter(Boolean);
                              return allCodes.length > 0 ? (
                                <span className="font-mono bg-vpa-sand dark:bg-vpa-dark px-1.5 py-0.2 rounded text-[8px] text-vpa-olive dark:text-vpa-sand">Mã đề: {allCodes.join(', ')}</span>
                              ) : null;
                            })()}
                          </div>
                        </div>

                        {isActive && (
                          <div className="w-5 h-5 rounded-full bg-vpa-olive dark:bg-vpa-gold flex items-center justify-center text-white dark:text-vpa-dark">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {variants.length > 0 && isActive && (
                        <div className="mt-2.5 pt-2.5 border-t border-vpa-olive-light/10">
                          <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Chọn mã đề thi cụ thể cho phòng:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuiz(q._id);
                              }}
                              className={`px-2.5 py-1 text-[9px] font-bold uppercase border transition-all ${
                                selectedQuiz === q._id
                                  ? 'bg-vpa-olive border-transparent text-white dark:bg-vpa-gold dark:text-vpa-dark font-black shadow'
                                  : 'border-vpa-olive-light/20 text-gray-500 hover:border-vpa-olive-light/50 dark:text-gray-300'
                              }`}
                            >
                              Đề gốc ({parentCode})
                            </button>

                            {variants.map((v: any) => (
                              <button
                                key={v._id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedQuiz(v._id);
                                }}
                                className={`px-2.5 py-1 text-[9px] font-bold uppercase border transition-all ${
                                  selectedQuiz === v._id
                                    ? 'bg-vpa-olive border-transparent text-white dark:bg-vpa-gold dark:text-vpa-dark font-black shadow'
                                    : 'border-vpa-olive-light/20 text-gray-500 hover:border-vpa-olive-light/50 dark:text-gray-300'
                                }`}
                              >
                                Mã đề {v.examCode || 'N/A'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label htmlFor="createRoomMaxParticipants" className="block text-[9px] uppercase tracking-wider font-bold text-gray-500">
              Tham gia tối đa (chỉ tính thí sinh)
            </label>
            <NumberStepper
              id="createRoomMaxParticipants"
              value={maxParticipants}
              onChange={setMaxParticipants}
              min={0}
              className="flex items-stretch w-40 border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <label htmlFor="createRoomAntiCheat" className="flex items-center space-x-2 p-2 border border-vpa-olive-light/20 cursor-pointer select-none hover:border-vpa-olive-light/50 transition-colors">
              <input
                type="checkbox"
                id="createRoomAntiCheat"
                checked={antiCheat}
                onChange={e => setAntiCheat(e.target.checked)}
                className="w-4 h-4 flex-shrink-0 border-vpa-olive-light accent-vpa-olive"
              />
              <span className="text-[11px] text-vpa-olive dark:text-vpa-sand font-semibold leading-tight">
                Chống gian lận (khóa màn hình)
              </span>
            </label>

            <label htmlFor="createRoomShowResult" className="flex items-center space-x-2 p-2 border border-vpa-olive-light/20 cursor-pointer select-none hover:border-vpa-olive-light/50 transition-colors">
              <input
                type="checkbox"
                id="createRoomShowResult"
                checked={showResult}
                onChange={e => setShowResult(e.target.checked)}
                className="w-4 h-4 flex-shrink-0 border-vpa-olive-light accent-vpa-olive"
              />
              <span className="text-[11px] text-vpa-olive dark:text-vpa-sand font-semibold leading-tight">
                Hiện điểm ngay khi nộp bài
              </span>
            </label>
          </div>

          <div className="flex space-x-3 pt-3 border-t border-vpa-olive-light/20">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={!selectedQuiz || submitting}
              className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold disabled:opacity-50"
            >
              {submitting ? 'Đang tạo...' : 'Tạo phòng thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
