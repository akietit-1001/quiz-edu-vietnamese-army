import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, ShareNetwork, CheckCircle, EyeSlash } from '@phosphor-icons/react';

interface ShareQuizModalProps {
  quiz: { _id: string; title: string };
  onClose: () => void;
}

interface ShareEntry {
  userId: { _id: string; fullName: string; email: string; rank?: string; position?: string };
  sharedAt: string;
  viewedAt: string | null;
}

export const ShareQuizModal: React.FC<ShareQuizModalProps> = ({ quiz, onClose }) => {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchShares = async () => {
    setLoadingShares(true);
    try {
      const res = await axios.get(`/api/quizzes/${quiz._id}/shares`);
      setShares(res.data.sharedWith || []);
    } catch (err) {
      console.error('Lỗi tải danh sách chia sẻ:', err);
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    fetchShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz._id]);

  const handleAddEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email || pendingEmails.includes(email)) return;
    setPendingEmails([...pendingEmails, email]);
    setEmailInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setPendingEmails(pendingEmails.filter(e => e !== email));
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalEmails = [...pendingEmails];
    const typed = emailInput.trim().toLowerCase();
    if (typed && !finalEmails.includes(typed)) {
      finalEmails.push(typed);
    }

    if (finalEmails.length === 0) {
      setError('Vui lòng nhập ít nhất 1 email để chia sẻ.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`/api/quizzes/${quiz._id}/share`, { emails: finalEmails });
      setSuccess(res.data.message || 'Đã chia sẻ đề thi thành công.');
      setPendingEmails([]);
      setEmailInput('');
      fetchShares();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể chia sẻ đề thi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    const confirmed = await window.showConfirm('Thu hồi quyền xem đề thi của đồng chí này?', 'Xác nhận thu hồi');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/quizzes/${quiz._id}/share/${userId}`);
      setShares(prev => prev.filter(s => s.userId._id !== userId));
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Không thể thu hồi chia sẻ.', 'Lỗi');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X size={18} />
        </button>

        <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
          <ShareNetwork size={18} className="text-vpa-olive dark:text-vpa-sand" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand">Chia sẻ đề thi</h3>
            <p className="text-[10px] text-gray-500 truncate">{quiz.title}</p>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
          Đề thi vẫn ở chế độ nội bộ — chỉ những đồng chí có tên trong danh sách dưới đây mới xem được, không công khai toàn hệ thống.
        </p>

        <form onSubmit={handleShare} className="space-y-3">
          <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-mono">
            Chia sẻ tới (nhập email, Enter hoặc "Thêm" để thêm nhiều người)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="email@gmail.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddEmail(emailInput);
                }
              }}
              className="flex-1 text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleAddEmail(emailInput)}
              disabled={!emailInput.trim()}
              className="px-4 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs uppercase font-bold tracking-wider transition-colors disabled:opacity-50 rounded-lg"
            >
              Thêm
            </button>
          </div>

          {pendingEmails.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-vpa-sand/20 dark:bg-vpa-dark/30 border border-vpa-olive-light/20 rounded-lg">
              {pendingEmails.map(email => (
                <div
                  key={email}
                  className="flex items-center space-x-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark px-2 py-1 text-[10px] font-mono font-semibold rounded"
                >
                  <span>{email}</span>
                  <button type="button" onClick={() => handleRemoveEmail(email)} className="hover:bg-white/20 dark:hover:bg-black/10 rounded p-0.5">
                    <X size={10} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {success && (
            <p className="text-green-600 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 p-2 border border-green-500/20 rounded">{success}</p>
          )}
          {error && (
            <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || (pendingEmails.length === 0 && !emailInput.trim())}
            className="w-full py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold disabled:opacity-50 transition-colors rounded-lg"
          >
            {submitting ? 'Đang chia sẻ...' : 'Chia sẻ'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-vpa-olive-light/20">
          <label className="block text-[9px] uppercase tracking-wider text-gray-500 font-mono mb-2">
            Đã chia sẻ với ({shares.length} đồng chí)
          </label>

          {loadingShares ? (
            <div className="py-4 text-center text-[10px] text-gray-400">Đang tải...</div>
          ) : shares.length === 0 ? (
            <div className="py-4 text-center text-[10px] text-gray-400">Chưa chia sẻ với ai.</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {shares.map(s => (
                <div
                  key={s.userId._id}
                  className="flex items-center justify-between px-3 py-2 border border-vpa-olive-light/20 rounded-lg text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-vpa-olive dark:text-vpa-sand truncate">
                      {s.userId.rank ? `${s.userId.rank} ` : ''}{s.userId.fullName}
                    </p>
                    <p className="text-[9px] text-gray-400 truncate">{s.userId.email}</p>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0 ml-2">
                    {s.viewedAt ? (
                      <span className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-500 font-bold uppercase">
                        <CheckCircle size={12} weight="fill" /> Đã xem
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-gray-400 uppercase">
                        <EyeSlash size={12} /> Chưa xem
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.userId._id)}
                      title="Thu hồi quyền xem"
                      className="text-vpa-red hover:bg-vpa-red/10 p-1 rounded"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ShareQuizModal;
