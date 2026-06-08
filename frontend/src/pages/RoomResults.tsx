import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ArrowLeft, DownloadSimple, Funnel, ShieldWarning } from '@phosphor-icons/react';
import { VPAExportPopup } from '../components/VPAExportPopup';

interface RoomResultsProps {
  user: any;
  roomId: string;
  onNavigateBack: () => void;
}

export const RoomResults: React.FC<RoomResultsProps> = ({ user, roomId, onNavigateBack }) => {
  const [room, setRoom] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Sorting
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('completedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // VPA Export configurations
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [printData, setPrintData] = useState<{
    upperUnit: string;
    currentUnit: string;
    province: string;
    position: string;
    showSignature: boolean;
    signerRank: string;
    signerName: string;
    room: any;
    attempts: any[];
  } | null>(null);

  useEffect(() => {
    if (printData) {
      const originalTitle = document.title;
      const cleanRoomCode = (printData.room?.roomCode || 'Phong_thi')
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .trim();
      document.title = `Bao_cao_ket_qua_${cleanRoomCode}`;

      const timer = setTimeout(() => {
        window.print();
        document.title = originalTitle;
        setPrintData(null);
      }, 500);
      return () => {
        clearTimeout(timer);
        document.title = originalTitle;
      };
    }
  }, [printData]);

  useEffect(() => {
    fetchResults();
  }, [roomId, sortBy, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortOrder]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`/api/rooms/${roomId}/results`, {
        params: { sortBy, order: sortOrder }
      });
      setRoom(response.data.room);
      setAttempts(response.data.attempts);
      setLoading(false);
    } catch (err) {
      setError('Lỗi tải kết quả phòng thi.');
      setLoading(false);
    }
  };

  const handleExportConfirm = (vpaData: {
    upperUnit: string;
    currentUnit: string;
    position: string;
    province: string;
    showSignature: boolean;
    signerRank: string;
    signerName: string;
    format: 'docx' | 'pdf' | 'xlsx' | 'csv';
  }) => {
    setShowExportPopup(false);
    
    if (vpaData.format === 'pdf') {
      setPrintData({
        upperUnit: vpaData.upperUnit,
        currentUnit: vpaData.currentUnit,
        province: vpaData.province,
        position: vpaData.position,
        showSignature: vpaData.showSignature,
        signerRank: vpaData.signerRank,
        signerName: vpaData.signerName,
        room,
        attempts: filteredAttempts
      });
      return;
    }

    // Construct export URL
    const token = localStorage.getItem('accessToken');
    const url = `/api/rooms/${roomId}/results/export?` + 
      `format=${vpaData.format}` +
      `&upperUnit=${encodeURIComponent(vpaData.upperUnit)}` +
      `&currentUnit=${encodeURIComponent(vpaData.currentUnit)}` +
      `&position=${encodeURIComponent(vpaData.position)}` +
      `&province=${encodeURIComponent(vpaData.province)}` +
      `&showSignature=${vpaData.showSignature}` +
      `&signerRank=${encodeURIComponent(vpaData.signerRank)}` +
      `&signerName=${encodeURIComponent(vpaData.signerName)}` +
      `&token=${token}`; // Provide token as query param if download starts outside axios header context

    triggerBlobDownload(url, `Bao_cao_ket_qua_${room?.roomCode}.${vpaData.format}`);
  };

  const triggerBlobDownload = async (url: string, filename: string) => {
    try {
      const response = await axios.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      await window.showAlert('Lỗi tải tệp tin xuất bản.', 'Lỗi tải tệp');
    }
  };

  const filteredAttempts = attempts.filter(att => {
    const term = search.toLowerCase();
    return (
      att.userId.fullName.toLowerCase().includes(term) ||
      att.userId.unit.toLowerCase().includes(term) ||
      (att.userId.rank || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredAttempts.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const displayedAttempts = filteredAttempts.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-vpa-sand dark:bg-vpa-dark">
        <p className="text-xs font-mono uppercase tracking-widest text-vpa-olive dark:text-vpa-sand animate-pulse-slow">
          Đang tổng hợp kết quả thi...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              Báo cáo kết quả phòng thi: <span className="font-mono text-vpa-gold font-extrabold">{room?.roomCode}</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Đề kiểm tra: {room?.quizId?.title}
            </p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex space-x-3">
          <button
            onClick={() => setShowExportPopup(true)}
            className="px-3 py-1.5 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
          >
            <DownloadSimple size={16} />
            <span>Xuất Excel</span>
          </button>
          <button
            onClick={() => setShowExportPopup(true)}
            className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
          >
            <DownloadSimple size={16} />
            <span>Xuất báo cáo Word</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Controls: Search, Sort */}
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between rounded-none">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm tên, cấp bậc, đơn vị..."
                className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
              />
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <Funnel size={14} className="text-vpa-gold" />
                <span className="text-gray-500 uppercase text-[9px]">Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-transparent border-b border-vpa-olive-light focus:outline-none text-vpa-olive dark:text-vpa-sand dark:bg-vpa-dark-card"
                >
                  <option value="completedAt">Mới nộp nhất</option>
                  <option value="score">Điểm số</option>
                  <option value="antiCheatViolations">Vi phạm gian lận</option>
                </select>
              </div>

              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="bg-transparent border-b border-vpa-olive-light focus:outline-none text-vpa-olive dark:text-vpa-sand dark:bg-vpa-dark-card"
              >
                <option value="desc">Giảm dần</option>
                <option value="asc">Tăng dần</option>
              </select>
            </div>
          </div>

          {/* Results Table */}
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                    <th className="py-3 px-4">Quân nhân</th>
                    <th className="py-3 px-4">Cấp bậc</th>
                    <th className="py-3 px-4">Chức vụ</th>
                    <th className="py-3 px-4">Đơn vị công tác</th>
                    <th className="py-3 px-4 text-center">Số câu đúng</th>
                    <th className="py-3 px-4 text-center">Kết quả</th>
                    <th className="py-3 px-4 text-center">Xếp loại</th>
                    <th className="py-3 px-4 text-center">Giám sát chống gian lận</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAttempts.map(att => {
                    const correctRatio = Math.round((att.score / att.totalQuestions) * 100);
                    return (
                      <tr key={att._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                        <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{att.userId.fullName}</td>
                        <td className="py-3 px-4">{att.userId.rank || 'Binh nhì'}</td>
                        <td className="py-3 px-4">{att.userId.position || 'Học viên'}</td>
                        <td className="py-3 px-4 uppercase">{att.userId.unit}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {att.score}/{att.totalQuestions} ({correctRatio}%)
                        </td>
                        <td className="py-3 px-4 text-center">
                          {att.isPassed ? (
                            <span className="text-green-600 font-extrabold uppercase bg-green-500/10 px-2 py-0.5 border border-green-500/30">ĐẠT</span>
                          ) : (
                            <span className="text-vpa-red font-extrabold uppercase bg-vpa-red/10 px-2 py-0.5 border border-vpa-red/30">KHÔNG ĐẠT</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold">{att.rank}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {att.antiCheatViolations > 0 ? (
                            <span className="text-vpa-red font-mono font-bold flex items-center justify-center space-x-1 bg-vpa-red/10 py-0.5 border border-vpa-red/30">
                              <ShieldWarning size={14} />
                              <span>Rời màn hình {att.antiCheatViolations} lần</span>
                            </span>
                          ) : (
                            <span className="text-green-600 font-mono font-bold">An toàn (0)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAttempts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400">Không tìm thấy kết quả làm bài nào khớp bộ lọc.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3">
                <span className="text-gray-500 text-center sm:text-left">
                  Hiển thị {startIndex + 1} - {Math.min(startIndex + pageSize, filteredAttempts.length)} trong tổng số {filteredAttempts.length} kết quả làm bài
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                  >
                    Trước
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    if (
                      totalPages > 6 &&
                      p !== 1 &&
                      p !== totalPages &&
                      Math.abs(p - page) > 1
                    ) {
                      if (p === 2 && page > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                      if (p === totalPages - 1 && page < totalPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                      return null;
                    }
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 flex items-center justify-center border transition-all ${
                          page === p
                            ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark font-black shadow-sm'
                            : 'border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* VPA Output custom settings popup */}
      <VPAExportPopup
        isOpen={showExportPopup}
        defaultUnit={user?.unit}
        defaultPosition={user?.position}
        defaultRank={user?.rank}
        defaultName={user?.fullName}
        type="results"
        previewData={{ room, attempts: filteredAttempts }}
        onCancel={() => setShowExportPopup(false)}
        onConfirm={handleExportConfirm}
      />

      {/* Printable VPA Report Container */}
      {printData && createPortal(
        <div className="print-area-only p-12 text-black bg-white leading-relaxed text-sm font-serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          {/* Header */}
          <div className="flex justify-between items-start text-xs leading-normal mb-8 font-serif">
            <div className="text-center w-[38%] font-serif">
              <p className="uppercase font-serif">{printData.upperUnit}</p>
              <p className="font-bold uppercase font-serif">{printData.currentUnit}</p>
              <p className="font-bold mt-0.5">---------</p>
            </div>
            <div className="text-center w-[58%] font-serif">
              <p className="font-bold text-[13px] font-serif whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold border-b border-black pb-1 inline-block mx-auto text-[13px] font-serif whitespace-nowrap">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <p className="italic mt-1.5 font-serif">
                {printData.province}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-6 font-serif">
            <h2 className="text-lg font-bold uppercase tracking-wide font-serif">BÁO CÁO KẾT QUẢ THI</h2>
            <p className="font-bold mt-1 font-serif">
              PHÒNG THI: {printData.room?.roomCode} - ĐỀ THI: {printData.room?.quizId?.title?.toUpperCase()}
            </p>
          </div>

          {/* Results Table */}
          <table className="w-full border-collapse border border-black text-xs my-6 font-serif">
            <thead>
              <tr className="bg-gray-100 font-bold text-center font-serif">
                <th className="border border-black p-2 w-12 font-serif">STT</th>
                <th className="border border-black p-2 font-serif">Họ và tên</th>
                <th className="border border-black p-2 font-serif">Cấp bậc</th>
                <th className="border border-black p-2 font-serif">Đơn vị</th>
                <th className="border border-black p-2 font-serif">Số câu đúng</th>
                <th className="border border-black p-2 font-serif">Tỷ lệ (%)</th>
                <th className="border border-black p-2 font-serif">Kết quả</th>
                <th className="border border-black p-2 font-serif">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {printData.attempts.map((att, idx) => {
                const correctRatio = Math.round((att.score / att.totalQuestions) * 100);
                return (
                  <tr key={idx} className="text-center font-serif">
                    <td className="border border-black p-2 font-serif">{idx + 1}</td>
                    <td className="border border-black p-2 text-left font-bold font-serif">{att.userId?.fullName}</td>
                    <td className="border border-black p-2 font-serif">{att.userId?.rank || 'Binh nhì'}</td>
                    <td className="border border-black p-2 text-left font-serif">{att.userId?.unit}</td>
                    <td className="border border-black p-2 font-serif">{att.score}/{att.totalQuestions}</td>
                    <td className="border border-black p-2 font-serif">{correctRatio}%</td>
                    <td className="border border-black p-2 font-bold font-serif">{att.isPassed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td>
                    <td className="border border-black p-2 font-serif">{att.rank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Signatures */}
          {printData.showSignature && (
            <div className="flex justify-end mt-12 font-serif">
              <div className="text-center w-[45%] font-serif">
                <p className="font-bold uppercase font-serif text-sm">{printData.position}</p>
                <p className="italic text-xs text-gray-500 mb-16 font-serif">(Ký, ghi rõ họ tên)</p>
                <p className="font-bold text-sm font-serif">{printData.signerRank} {printData.signerName}</p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
export default RoomResults;
