import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ClipboardText, CheckCircle, XCircle } from '../icons';
import { Pagination } from '../components/Pagination';

interface MyHistoryProps {
  onNavigateBack: () => void;
}

const RANK_COLORS: Record<string, string> = {
  'Xuất sắc': 'text-green-600 dark:text-green-500',
  'Giỏi': 'text-vpa-gold dark:text-vpa-gold-bright',
  'Khá': 'text-blue-600 dark:text-blue-400',
  'Trung bình': 'text-gray-500',
  'Yếu': 'text-vpa-red'
};

const MODE_LABEL: Record<string, string> = {
  exam: 'Thi chính thức',
  practice: 'Ôn luyện',
  mock: 'Thi thử'
};

export const MyHistory: React.FC<MyHistoryProps> = ({ onNavigateBack }) => {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  const fetchAttempts = async (p: number) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/rooms/my-attempts', { params: { page: p, limit: PAGE_SIZE } });
      setAttempts(res.data.attempts || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalCount(res.data.totalCount || 0);
    } catch (err) {
      console.error('Lỗi tải lịch sử làm bài:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center space-x-3 mb-6">
        <button
          onClick={onNavigateBack}
          className="p-2 border border-vpa-olive-light/40 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors rounded-lg"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-extrabold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
          Lịch sử làm bài của tôi
        </h1>
      </div>

      <div className="border border-vpa-olive-light/30 bg-vpa-sand-light dark:bg-vpa-dark-card rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-gray-400">
            <div className="w-8 h-8 border-2 border-vpa-olive dark:border-vpa-gold border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[10px] uppercase tracking-wider">Đang tải lịch sử...</span>
          </div>
        ) : attempts.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-gray-400">
            <ClipboardText size={32} className="mb-3 opacity-50" />
            <span className="text-xs">Đồng chí chưa hoàn thành bài thi nào.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-vpa-olive-light/20 text-[10px] uppercase tracking-wider text-gray-500 bg-vpa-olive/5 dark:bg-vpa-gold/5">
                  <th className="text-left px-4 py-3 font-bold">Đề thi</th>
                  <th className="text-left px-4 py-3 font-bold">Hình thức</th>
                  <th className="text-center px-4 py-3 font-bold">Kết quả</th>
                  <th className="text-center px-4 py-3 font-bold">Tỷ lệ</th>
                  <th className="text-center px-4 py-3 font-bold">Xếp loại</th>
                  <th className="text-right px-4 py-3 font-bold">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((att) => {
                  const ratio = att.totalQuestions > 0 ? Math.round((att.score / att.totalQuestions) * 100) : 0;
                  return (
                    <tr key={att._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-vpa-olive dark:text-vpa-sand">
                          {att.quizId?.title || 'Đề thi đã bị xoá'}
                        </span>
                        {att.roomId?.roomCode && (
                          <span className="block text-[10px] text-gray-400 font-mono">Phòng: {att.roomId.roomCode}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{MODE_LABEL[att.mode] || att.mode}</td>
                      <td className="px-4 py-3 text-center">
                        {att.isPassed ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-500 font-bold">
                            <CheckCircle size={14} weight="fill" /> ĐẠT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-vpa-red font-bold">
                            <XCircle size={14} weight="fill" /> KHÔNG ĐẠT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {att.score}/{att.totalQuestions} ({ratio}%)
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${RANK_COLORS[att.rank] || ''}`}>{att.rank}</td>
                      <td className="px-4 py-3 text-right text-gray-400 font-mono text-[11px]">
                        {att.completedAt ? new Date(att.completedAt).toLocaleString('vi-VN') : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && attempts.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="lượt thi"
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default MyHistory;
