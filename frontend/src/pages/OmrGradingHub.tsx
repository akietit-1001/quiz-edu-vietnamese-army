import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { getAppSocket } from '../utils/socket';
import {
  ArrowLeft,
  Check,
  X,
  Printer,
  FileArrowDown,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  DeviceMobile
} from '../icons';
import { OmrPrintModal } from '../components/OmrPrintModal';
import { VPAExportPopup } from '../components/VPAExportPopup';

interface OmrGradingHubProps {
  user: any;
  roomId?: string;
  quizId?: string;
  roomCode?: string;
  onNavigateBack: () => void;
}

export const OmrGradingHub: React.FC<OmrGradingHubProps> = ({
  user,
  roomId,
  quizId,
  roomCode: propRoomCode,
  onNavigateBack
}) => {
  const [sessionCode] = useState(propRoomCode || roomId || quizId || 'OMR-SESSION');
  const [sessionData, setSessionData] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [, setLoading] = useState(true);
  const [scannerConnected, setScannerConnected] = useState(false);
  const [qrPairingUrl, setQrPairingUrl] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<string[]>([]);
  const [lanIp, setLanIp] = useState<string>(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '192.168.1.2';
    }
    return window.location.hostname;
  });
  const [showIpSettings, setShowIpSettings] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizFilter, setSelectedQuizFilter] = useState<string>('ALL');
  
  // Modal states
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [editingAttempt, setEditingAttempt] = useState<any | null>(null);

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Lấy danh sách các đề thi duy nhất xuất hiện trong danh sách bài chấm
  const uniqueQuizzes = React.useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    attempts.forEach(a => {
      const qId = a.quizId?._id || a.quizId || 'UNKNOWN';
      const title = a.quizId?.title || 'Đề thi trắc nghiệm';
      if (!map.has(qId)) {
        map.set(qId, { id: qId, title, count: 0 });
      }
      map.get(qId)!.count++;
    });
    return Array.from(map.values());
  }, [attempts]);

  // Tính URL máy quét: Trên Domain chính thức dùng thẳng domain, trên localhost hỗ trợ IP LAN
  const getCompanionUrl = () => {
    let host = window.location.origin;

    if (isLocalhost) {
      const rawInput = lanIp.trim();
      if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
        host = rawInput.replace(/\/+$/, '');
      } else {
        const port = window.location.port ? `:${window.location.port}` : '';
        const selectedIp = rawInput || '192.168.1.2';
        host = `http://${selectedIp}${port}`;
      }
    }

    const token = localStorage.getItem('token') || '';
    return `${host}/omr-scanner?session=${sessionCode}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  };

  // 1. Tải thông tin phiên chấm
  const fetchSessionData = async () => {
    try {
      const code = sessionCode;
      const res = await axios.get(`/api/omr/session/${code}`);
      setSessionData(res.data);
      if (res.data.serverIps && Array.isArray(res.data.serverIps) && res.data.serverIps.length > 0) {
        setAvailableIps(res.data.serverIps);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          setLanIp(res.data.serverIps[0]);
        }
      }
      setAttempts(res.data.existingAttempts || []);
      if (res.data.existingAttempts?.length > 0 && !selectedAttempt) {
        setSelectedAttempt(res.data.existingAttempts[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Lỗi tải dữ liệu phiên OMR:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [sessionCode]);

  // 2. Sinh QR Code ghép đôi với điện thoại
  useEffect(() => {
    if (sessionCode) {
      const companionUrl = getCompanionUrl();

      QRCode.toDataURL(companionUrl, {
        margin: 1,
        width: 220,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then(url => setQrPairingUrl(url))
        .catch(err => console.error('Lỗi sinh QR ghép đôi:', err));
    }
  }, [sessionCode, lanIp]);

  // 3. Lắng nghe Socket.io Realtime từ Điện thoại
  useEffect(() => {
    const socket = getAppSocket();
    socket.connect();

    const channelCode = sessionCode.toUpperCase();
    socket.emit('joinOmrSession', { sessionCode: channelCode, role: 'hub' });

    // Khi điện thoại kết nối vào
    const handleScannerConnected = () => {
      setScannerConnected(true);
    };

    // Khi điện thoại thoát trình duyệt / ngắt kết nối
    const handleScannerDisconnected = () => {
      setScannerConnected(false);
    };

    // Nhận trạng thái máy quét ban đầu từ server
    const handleScannerStatus = ({ isConnected }: { isConnected: boolean }) => {
      setScannerConnected(isConnected);
    };

    // Khi có bài thi mới vừa được điện thoại quét xong!
    const handleNewScan = (newAttempt: any) => {
      setAttempts(prev => {
        // Tránh trùng lặp
        const filtered = prev.filter(a => a._id !== newAttempt._id);
        return [newAttempt, ...filtered];
      });
      setSelectedAttempt(newAttempt);
      setScannerConnected(true);
    };

    // Khi có bài thi được cập nhật
    const handleScanUpdated = (updatedAttempt: any) => {
      setAttempts(prev => prev.map(a => (a._id === updatedAttempt._id ? updatedAttempt : a)));
      if (selectedAttempt?._id === updatedAttempt._id) {
        setSelectedAttempt(updatedAttempt);
      }
    };

    // Khi có bài thi bị xóa
    const handleScanDeleted = ({ attemptId }: { attemptId: string }) => {
      setAttempts(prev => prev.filter(a => a._id !== attemptId));
      if (selectedAttempt?._id === attemptId) {
        setSelectedAttempt(null);
      }
    };

    socket.on('omrScannerConnected', handleScannerConnected);
    socket.on('omrScannerDisconnected', handleScannerDisconnected);
    socket.on('omrScannerStatus', handleScannerStatus);
    socket.on('omrNewScan', handleNewScan);
    socket.on('omrScanUpdated', handleScanUpdated);
    socket.on('omrScanDeleted', handleScanDeleted);

    return () => {
      socket.off('omrScannerConnected', handleScannerConnected);
      socket.off('omrScannerDisconnected', handleScannerDisconnected);
      socket.off('omrScannerStatus', handleScannerStatus);
      socket.off('omrNewScan', handleNewScan);
      socket.off('omrScanUpdated', handleScanUpdated);
      socket.off('omrScanDeleted', handleScanDeleted);
      socket.emit('leaveOmrSession', { sessionCode: channelCode });
    };
  }, [sessionCode, selectedAttempt]);

  // Lưu chỉnh sửa thủ công bài thi
  const handleSaveEdit = async () => {
    if (!editingAttempt) return;
    try {
      const res = await axios.put(`/api/omr/attempt/${editingAttempt._id}`, {
        sbd: editingAttempt.candidateInfo?.sbd,
        fullName: editingAttempt.candidateInfo?.fullName,
        examCode: editingAttempt.examCode,
        answers: editingAttempt.answers
      });

      setSelectedAttempt(res.data.attempt);
      setEditingAttempt(null);
      await window.showAlert('Đã lưu thay đổi bài thi thành công!', 'Thông báo');
    } catch (err: any) {
      alert('Lỗi lưu thay đổi: ' + (err.response?.data?.message || err.message));
    }
  };

  // Xóa bài thi
  const handleDeleteAttempt = async (attemptId: string) => {
    const confirm = await window.showConfirm('Đồng chí có chắc chắn muốn xóa bài thi này khỏi danh sách?', 'Xác nhận xóa');
    if (!confirm) return;

    try {
      await axios.delete(`/api/omr/attempt/${attemptId}`);
    } catch (err: any) {
      alert('Lỗi xóa bài thi: ' + (err.response?.data?.message || err.message));
    }
  };

  // Lọc danh sách bài thi theo từ khóa tìm kiếm và đề thi đã chọn
  const filteredAttempts = attempts.filter(a => {
    const sbd = a.candidateInfo?.sbd || '';
    const name = a.candidateInfo?.fullName || a.userId?.fullName || '';
    const matchesSearch = sbd.toLowerCase().includes(searchTerm.toLowerCase()) || name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedQuizFilter === 'ALL') return matchesSearch;
    const qId = a.quizId?._id || a.quizId;
    return matchesSearch && qId === selectedQuizFilter;
  });

  // Thống kê nhanh
  const totalScanned = attempts.length;
  const avgScore = totalScanned > 0
    ? (attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalScanned).toFixed(1)
    : '0';
  const passedCount = attempts.filter(a => a.isPassed).length;
  const passRate = totalScanned > 0 ? Math.round((passedCount / totalScanned) * 100) : 0;

  // Lấy danh sách câu hỏi của bài thi đang được chọn để đối soát
  const activeQuestions = selectedAttempt?.quizId?.questions || sessionData?.quiz?.questions || [];

  return (
    <div className="min-h-screen bg-vpa-sand dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand font-sans flex flex-col">
      {/* ========================================================================= */}
      {/* TOP HEADER BAR                                                            */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-vpa-dark-card border-b border-vpa-olive-light/20 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateBack}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-vpa-olive dark:text-vpa-gold transition-colors flex items-center space-x-1"
          >
            <ArrowLeft size={18} weight="bold" />
            <span className="text-xs font-bold hidden sm:inline">Quay lại</span>
          </button>
          <div className="h-6 w-[1px] bg-gray-300 dark:bg-gray-700" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-vpa-gold animate-pulse" />
              <h1 className="text-sm font-black uppercase tracking-wider text-vpa-olive dark:text-vpa-gold">
                BÀN CHẤM THI OMR OFFLINE & ĐỒNG BỘ REALTIME
              </h1>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              {sessionData?.room ? (
                <>Phòng thi: <span className="font-bold text-black dark:text-white">{sessionData.room.roomCode}</span> • Đề: {sessionData?.quiz?.title || 'Đang tải...'} ({sessionData?.quiz?.totalQuestions || 0} câu)</>
              ) : (
                <>Phiên làm việc: <span className="font-bold text-black dark:text-white">{sessionCode}</span> • Đã chấm: <strong className="text-vpa-olive dark:text-vpa-gold">{attempts.length} bài</strong> • Tự nhận diện đề qua mã QR trên phiếu</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Nút In Phiếu OMR */}
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3 py-1.5 bg-white dark:bg-vpa-dark border border-vpa-olive-light/40 hover:border-vpa-gold rounded text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Printer size={15} weight="bold" className="text-vpa-olive dark:text-vpa-gold" />
            <span>In Phiếu Trắc Nghiệm</span>
          </button>

          {/* Nút Xuất Báo Cáo */}
          <button
            onClick={() => setShowExportPopup(true)}
            className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark rounded text-xs font-bold flex items-center space-x-1.5 shadow hover:opacity-90 transition-all"
          >
            <FileArrowDown size={15} weight="bold" />
            <span>Xuất Báo Cáo Kết Quả</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN BODY: 2 CỘT (Cột trái: Ghép đôi & Danh sách bài / Cột phải: Chi tiết) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* CỘT TRÁI: QR KẾT NỐI & DANH SÁCH BÀI THI QUÉT ĐƯỢC */}
        <div className="w-full lg:w-96 flex flex-col gap-3">
          {/* Card Ghép Đôi Điện Thoại (Pairing Card) */}
          <div className="bg-white dark:bg-vpa-dark-card border border-vpa-olive-light/30 rounded-lg p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-vpa-olive dark:text-vpa-gold flex items-center gap-1.5">
                <DeviceMobile size={16} weight="bold" />
                <span>KẾT NỐI ĐIỆN THOẠI QUÉT</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  scannerConnected
                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${scannerConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>{scannerConnected ? 'Máy quét sẵn sàng' : 'Chờ điện thoại'}</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              {/* QR Code */}
              <div className="bg-white p-1.5 rounded-lg border border-gray-300 shadow-sm shrink-0 flex flex-col items-center">
                {qrPairingUrl ? (
                  <img src={qrPairingUrl} alt="QR Ghép đôi máy quét" className="w-28 h-28 object-contain" />
                ) : (
                  <div className="w-28 h-28 bg-gray-100 animate-pulse rounded" />
                )}
                <span className="text-[9px] font-mono text-gray-500 mt-1 font-semibold">QR Quét bài OMR</span>
              </div>

              {/* Hướng dẫn và thao tác */}
              <div className="text-[11px] text-gray-600 dark:text-gray-300 space-y-2 flex-1">
                <div className="leading-snug space-y-1">
                  {isLocalhost ? (
                    <>
                      <p>1. Điện thoại & máy tính vào <strong>cùng Wi-Fi</strong>.</p>
                      <p>2. Dùng <strong>Camera điện thoại</strong> quét mã QR bên cạnh.</p>
                      <p>3. Lia camera qua từng bài thi $\rightarrow$ điểm số <strong>tự động nhận diện đề</strong> và nhảy realtime!</p>
                    </>
                  ) : (
                    <>
                      <p>1. Dùng <strong>Camera điện thoại</strong> (4G/Wi-Fi) quét mã QR bên cạnh.</p>
                      <p>2. Lia camera qua từng bài thi $\rightarrow$ kết quả chấm <strong>tự động nhận diện đề</strong> và nhảy realtime!</p>
                    </>
                  )}
                </div>

                {/* Các nút tiện ích */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getCompanionUrl());
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-vpa-dark dark:hover:bg-black/40 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-bold text-vpa-olive dark:text-vpa-gold transition-colors flex items-center gap-1"
                  >
                    {copiedLink ? <Check size={12} weight="bold" className="text-green-600" /> : null}
                    <span>{copiedLink ? 'Đã sao chép!' : 'Sao chép link'}</span>
                  </button>

                  {isLocalhost && (
                    <button
                      type="button"
                      onClick={() => setShowIpSettings(!showIpSettings)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-vpa-dark dark:hover:bg-black/40 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-bold text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      {showIpSettings ? '▲ Đóng' : '⚙️ Đổi IP'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bảng tùy chỉnh IP LAN khi mở cấu hình (chỉ ở localhost) */}
            {isLocalhost && showIpSettings && (
              <div className="mt-2 p-2.5 bg-gray-50 dark:bg-vpa-dark/80 border border-vpa-olive-light/20 rounded-md text-[11px] space-y-2">
                <div className="font-bold text-vpa-olive dark:text-vpa-gold flex items-center justify-between">
                  <span>CẤU HÌNH ĐỊA CHỈ IP MÁY TÍNH (MẠNG LAN)</span>
                </div>
                
                {availableIps.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500">IP phát hiện được:</span>
                    <div className="flex flex-wrap gap-1">
                      {availableIps.map(ip => (
                        <button
                          key={ip}
                          type="button"
                          onClick={() => setLanIp(ip)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                            lanIp === ip
                              ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent shadow-xs'
                              : 'bg-white dark:bg-vpa-dark border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-vpa-gold'
                          }`}
                        >
                          {ip} {lanIp === ip ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 block">Địa chỉ IP hoặc Hostname tùy chỉnh:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={lanIp}
                      onChange={(e) => setLanIp(e.target.value)}
                      placeholder="Ví dụ: 192.168.1.2"
                      className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand"
                    />
                    <button
                      type="button"
                      onClick={() => setLanIp(window.location.hostname === 'localhost' ? (availableIps[0] || '192.168.1.2') : window.location.hostname)}
                      className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-[10px] font-bold"
                    >
                      Mặc định
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Danh sách bài thi đã quét */}
          <div className="bg-white dark:bg-vpa-dark-card border border-vpa-olive-light/30 rounded-lg flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 border-b border-vpa-olive-light/20 flex flex-col gap-2 bg-gray-50/50 dark:bg-black/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide">
                  ĐÃ QUÉT ({filteredAttempts.length}/{attempts.length})
                </span>
                <div className="relative w-36 sm:w-44">
                  <MagnifyingGlass size={14} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm SBD / Họ tên..."
                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-vpa-dark text-vpa-dark dark:text-vpa-sand"
                  />
                </div>
              </div>

              {/* Bộ lọc theo Đề thi nếu trong phiên có nhiều đề khác nhau */}
              {uniqueQuizzes.length > 1 && (
                <div className="pt-1">
                  <select
                    value={selectedQuizFilter}
                    onChange={(e) => setSelectedQuizFilter(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] font-bold border border-vpa-olive-light/30 rounded bg-white dark:bg-vpa-dark text-vpa-olive dark:text-vpa-gold"
                  >
                    <option value="ALL">📋 Tất cả đề thi ({attempts.length} bài)</option>
                    {uniqueQuizzes.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.count} bài)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
              {filteredAttempts.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  <p>Chưa có bài thi nào được quét.</p>
                  <p className="mt-1 text-[11px]">Hãy dùng camera điện thoại quét các phiếu làm bài để tự động nhận diện!</p>
                </div>
              ) : (
                filteredAttempts.map((attempt) => {
                  const isSelected = selectedAttempt?._id === attempt._id;
                  const sbd = attempt.candidateInfo?.sbd || '---';
                  const name = attempt.candidateInfo?.fullName || attempt.userId?.fullName || 'Thí sinh';
                  const quizName = attempt.quizId?.title || 'Đề thi trắc nghiệm';

                  return (
                    <div
                      key={attempt._id}
                      onClick={() => setSelectedAttempt(attempt)}
                      className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-vpa-gold/15 dark:bg-vpa-gold/20 border-l-4 border-vpa-gold font-medium'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-vpa-olive dark:text-vpa-gold">
                            SBD: {sbd}
                          </span>
                          <span className="text-xs font-bold truncate">{name}</span>
                        </div>
                        <div className="text-[10px] text-vpa-olive dark:text-vpa-gold font-bold truncate mt-0.5">
                          {quizName}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center space-x-2">
                          <span>Mã đề: {attempt.examCode || '101'}</span>
                          <span>•</span>
                          <span>{new Date(attempt.completedAt).toLocaleTimeString('vi-VN')}</span>
                          {attempt.isManualEdited && (
                            <span className="text-amber-500 font-bold">• Đã sửa</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-sm text-vpa-olive dark:text-vpa-gold">
                          {attempt.score}/{attempt.totalQuestions}
                        </span>
                        <span
                          className={`block text-[9.5px] font-bold ${
                            attempt.isPassed ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                          }`}
                        >
                          {attempt.rank}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT BÀI THI & ĐỐI SOÁT ẢNH QUÉT */}
        <div className="flex-1 bg-white dark:bg-vpa-dark-card border border-vpa-olive-light/30 rounded-lg flex flex-col overflow-hidden shadow-sm">
          {!selectedAttempt ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <DeviceMobile size={48} className="text-gray-300 dark:text-gray-600 mb-2" />
              <h3 className="font-bold text-sm">Chưa chọn bài thi nào</h3>
              <p className="text-xs mt-1">Chọn một bài thi trong danh sách bên trái hoặc dùng camera điện thoại quét bài mới.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header Chi tiết bài thi */}
              <div className="p-3.5 border-b border-vpa-olive-light/20 flex items-center justify-between bg-gray-50 dark:bg-black/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-vpa-olive/10 dark:bg-vpa-gold/10 p-2 rounded-lg">
                    <span className="font-mono font-black text-xl text-vpa-olive dark:text-vpa-gold">
                      {selectedAttempt.score}/{selectedAttempt.totalQuestions}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-vpa-olive dark:text-vpa-gold">
                      {selectedAttempt.candidateInfo?.fullName || selectedAttempt.userId?.fullName || 'Thí sinh'}
                    </h2>
                    <p className="text-xs text-gray-500 font-mono">
                      SBD: <strong className="text-black dark:text-white">{selectedAttempt.candidateInfo?.sbd || '---'}</strong> • Đề: <strong className="text-vpa-olive dark:text-vpa-gold">{selectedAttempt.quizId?.title || sessionData?.quiz?.title || 'Đề thi'}</strong> • Mã đề: {selectedAttempt.examCode} • Xếp loại: <strong>{selectedAttempt.rank}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingAttempt(JSON.parse(JSON.stringify(selectedAttempt)))}
                    className="px-3 py-1.5 bg-vpa-gold/20 text-vpa-olive dark:text-vpa-gold border border-vpa-gold/40 hover:bg-vpa-gold/30 rounded text-xs font-bold flex items-center space-x-1 transition-all"
                  >
                    <PencilSimple size={14} weight="bold" />
                    <span>Sửa điểm / SBD</span>
                  </button>

                  <button
                    onClick={() => handleDeleteAttempt(selectedAttempt._id)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="Xóa bài thi này"
                  >
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Nội dung đối soát: Ảnh nắn phối cảnh (Trái) & Ma trận câu hỏi (Phải) */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
                {/* Khung xem ảnh scan đã nắn thẳng */}
                <div className="w-full md:w-1/2 p-3 bg-gray-100 dark:bg-black/40 flex flex-col items-center justify-center overflow-auto">
                  {selectedAttempt.scannedImageUrl ? (
                    <img
                      src={selectedAttempt.scannedImageUrl}
                      alt="Ảnh phiếu thi đã scan"
                      className="max-h-[600px] w-auto object-contain rounded shadow-lg border border-black/30"
                    />
                  ) : (
                    <div className="text-xs text-gray-400 p-8 text-center">
                      Không có ảnh chụp lưu kèm cho bài thi này.
                    </div>
                  )}
                </div>

                {/* Khung ma trận câu hỏi đúng / sai */}
                <div className="w-full md:w-1/2 p-3 overflow-y-auto">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-600 dark:text-gray-300">
                    BẢNG ĐỐI SOÁT ĐÁP ÁN CÁC CÂU HỎI
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeQuestions.map((q: any, idx: number) => {
                      const qNum = idx + 1;
                      const attemptAns = selectedAttempt.answers?.find((a: any) => a.questionIndex === qNum);
                      const chosenOpt = attemptAns?.selectedAnswers?.[0] || '---';

                      // Kiểm tra tính đúng sai
                      let isCorrect = false;
                      if (chosenOpt !== '---' && q.correctAnswers?.length > 0) {
                        const correctSet = q.correctAnswers.map((a: any) => String(a).toUpperCase());
                        const letterMap: Record<string, string> = { 'A': '0', 'B': '1', 'C': '2', 'D': '3' };
                        if (correctSet.includes(chosenOpt) || (letterMap[chosenOpt] && correctSet.includes(letterMap[chosenOpt]))) {
                          isCorrect = true;
                        }
                      }

                      return (
                        <div
                          key={qNum}
                          className={`p-2 rounded border text-xs flex items-center justify-between ${
                            isCorrect
                              ? 'bg-green-500/10 border-green-500/40 text-green-900 dark:text-green-300'
                              : chosenOpt === '---'
                              ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500'
                              : 'bg-red-500/10 border-red-500/40 text-red-900 dark:text-red-300'
                          }`}
                        >
                          <span className="font-bold">Câu {qNum}:</span>
                          <span className="font-mono font-black text-sm">{chosenOpt}</span>
                          {isCorrect ? (
                            <Check size={14} weight="bold" className="text-green-600" />
                          ) : (
                            <X size={14} weight="bold" className="text-red-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SUMMARY FOOTER BAR                                                 */}
      {/* ========================================================================= */}
      <footer className="bg-white dark:bg-vpa-dark-card border-t border-vpa-olive-light/20 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-6">
          <span>Tổng số bài: <strong className="text-vpa-olive dark:text-vpa-gold font-mono">{totalScanned}</strong></span>
          <span>Điểm trung bình: <strong className="text-vpa-olive dark:text-vpa-gold font-mono">{avgScore}</strong></span>
          <span>Tỷ lệ đạt: <strong className="text-green-600 font-mono">{passRate}%</strong></span>
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          HỆ THỐNG TRẮC NGHIỆM QUÂN SỰ VPA • PHÂN HỆ CHẤM OMR TỰ ĐỘNG
        </div>
      </footer>

      {/* MODAL SỬA ĐIỂM / SBD THỦ CÔNG */}
      {editingAttempt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white dark:bg-vpa-dark-card border border-vpa-olive-light/40 w-full max-w-xl max-h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-vpa-olive-light/20 flex items-center justify-between bg-vpa-gold/10">
              <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-gold">
                Chỉnh sửa thông tin bài thi (SBD & Đáp án)
              </h3>
              <button onClick={() => setEditingAttempt(null)} className="p-1 text-gray-500 hover:text-black">
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Số báo danh (SBD)</label>
                  <input
                    type="text"
                    value={editingAttempt.candidateInfo?.sbd || ''}
                    onChange={(e) => setEditingAttempt({
                      ...editingAttempt,
                      candidateInfo: { ...editingAttempt.candidateInfo, sbd: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded dark:bg-vpa-dark font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Họ và tên</label>
                  <input
                    type="text"
                    value={editingAttempt.candidateInfo?.fullName || ''}
                    onChange={(e) => setEditingAttempt({
                      ...editingAttempt,
                      candidateInfo: { ...editingAttempt.candidateInfo, fullName: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded dark:bg-vpa-dark"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Chỉnh sửa đáp án từng câu</label>
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-50 dark:bg-black/20 rounded border">
                  {(editingAttempt.quizId?.questions || sessionData?.quiz?.questions)?.map((_q: any, idx: number) => {
                    const qNum = idx + 1;
                    const ansObj = editingAttempt.answers?.find((a: any) => a.questionIndex === qNum);
                    const currentOpt = ansObj?.selectedAnswers?.[0] || '';

                    return (
                      <div key={qNum} className="flex items-center space-x-1 text-xs">
                        <span className="font-bold w-10">C{qNum}:</span>
                        <select
                          value={currentOpt}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newAnswers = [...(editingAttempt.answers || [])];
                            const existingIdx = newAnswers.findIndex(a => a.questionIndex === qNum);
                            if (existingIdx !== -1) {
                              newAnswers[existingIdx].selectedAnswers = val ? [val] : [];
                            } else {
                              newAnswers.push({ questionIndex: qNum, selectedAnswers: val ? [val] : [] });
                            }
                            setEditingAttempt({ ...editingAttempt, answers: newAnswers });
                          }}
                          className="px-1 py-1 border rounded bg-white dark:bg-vpa-dark font-mono font-bold text-xs"
                        >
                          <option value="">Trống</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-vpa-olive-light/20 flex justify-end space-x-2 bg-gray-50 dark:bg-black/10">
              <button
                onClick={() => setEditingAttempt(null)}
                className="px-4 py-2 border rounded font-bold text-xs hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-vpa-gold text-vpa-dark font-black rounded text-xs hover:bg-yellow-500 shadow"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IN PHIẾU OMR */}
      {showPrintModal && (
        <OmrPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          omrExam={sessionData?.omrExam}
          quiz={selectedAttempt?.quizId || sessionData?.quiz || (sessionData?.allQuizzes?.[0] || null)}
          availableQuizzes={sessionData?.allQuizzes || []}
          defaultUnit={sessionData?.omrExam?.currentUnit || user?.unitId?.name || ''}
          defaultUpperUnit={sessionData?.omrExam?.upperUnit || ''}
        />
      )}

      {/* POPUP XUẤT BÁO CÁO VPA */}
      {showExportPopup && (
        <VPAExportPopup
          isOpen={showExportPopup}
          onCancel={() => setShowExportPopup(false)}
          onConfirm={(exportOptions) => {
            setShowExportPopup(false);
            const params = new URLSearchParams({
              format: exportOptions.format,
              sessionCode: sessionCode || '',
              omrExamId: sessionData?.omrExam?._id || '',
              quizId: selectedQuizFilter !== 'ALL' ? selectedQuizFilter : (sessionData?.quiz?._id || ''),
              upperUnit: exportOptions.upperUnit || '',
              currentUnit: exportOptions.currentUnit || '',
              province: exportOptions.province || '',
              position: exportOptions.position || '',
              signerRank: exportOptions.signerRank || '',
              signerName: exportOptions.signerName || '',
              showSignature: String(exportOptions.showSignature),
              orientation: exportOptions.orientation || 'landscape'
            });
            window.location.href = `/api/omr/export/results?${params.toString()}`;
          }}
          type="results"
          previewData={filteredAttempts}
          defaultUnit={sessionData?.omrExam?.currentUnit || user?.unitId?.name || ''}
          defaultUpperUnit={sessionData?.omrExam?.upperUnit || ''}
        />
      )}
    </div>
  );
};

export default OmrGradingHub;

