import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getAppSocket } from '../utils/socket';
import { Play, ClipboardText, Plus, ShieldCheck, ShieldWarning, BookOpen, UserPlus, Check, X, Users, MorphIcon, EyeData, SignInData } from '../icons';
import { useSubviewBack } from '../hooks/useSubviewBack';
import { NumberStepper } from '../components/NumberStepper';
import { Tooltip } from '../components/Tooltip';
import { AdminStatsPanel } from '../components/AdminStatsPanel';
import { InviteToRoomModal } from '../components/InviteToRoomModal';

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];

// fetchQuizzes() chỉ chạy đúng 1 lần lúc mount nên không có số liệu cũ trong
// session để đoán số dòng skeleton. Nhớ lại số đề của lần tải trước (qua
// localStorage) để những lần mở trang sau, skeleton khớp đúng ngay từ đầu
// thay vì luôn cố định 4 thẻ bất kể thực tế có bao nhiêu đề.
const QUIZ_SKELETON_CACHE_KEY = 'vpa_dashboard_quiz_skeleton_count';
const getInitialQuizSkeletonCount = () => {
  const cached = parseInt(localStorage.getItem(QUIZ_SKELETON_CACHE_KEY) || '', 10);
  return Number.isFinite(cached) && cached > 0 ? Math.min(cached, 6) : 4;
};

// Mọi đề (kể cả bản gốc) đều được lưu title kèm hậu tố "- Mã đề 001" ở BE
// (xem quizController.js) để phân biệt trong bảng quản lý — nhưng trên thẻ
// ôn luyện chỉ cần tên đề, mã đề cụ thể đã có tab riêng để chọn.
const stripExamCodeSuffix = (title: string) => title.replace(/\s*-\s*Mã đề\s*\S+\s*$/i, '');

// 1 đề gốc có thể có nhiều mã đề (biến thể xáo trộn câu hỏi/đáp án) — cho
// phép chọn đúng mã đề cần ôn luyện/thi thử ngay trên thẻ thay vì luôn cố
// định vào đề gốc (mã 001).
const PracticeQuizCard: React.FC<{
  quiz: any;
  variants: any[];
  onStartPractice: (quizId: string, mode: 'practice' | 'mock') => void;
}> = ({ quiz, variants, onStartPractice }) => {
  const allVersions = React.useMemo(
    () => [quiz, ...[...variants].sort((a, b) => (a.examCode || '').localeCompare(b.examCode || ''))],
    [quiz, variants]
  );
  const [activeId, setActiveId] = useState(quiz._id);
  const active = allVersions.find(v => v._id === activeId) || quiz;
  const baseTitle = stripExamCodeSuffix(quiz.title);

  return (
    <div className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 transition-all hover:border-vpa-gold flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-vpa-olive/10 dark:bg-vpa-gold/10 text-vpa-olive dark:text-vpa-gold-bright">
            {quiz.category}
          </span>
          <span className="text-[9px] font-mono text-gray-400">Code: {quiz.shareCode}</span>
        </div>
        <Tooltip content={baseTitle} className="block">
          <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand mb-1 line-clamp-2">
            {baseTitle}
          </h4>
        </Tooltip>
        <Tooltip content={quiz.description} className="block">
          <p className="text-[10px] text-gray-500 line-clamp-2 mb-2">
            {quiz.description || 'Không có mô tả chi tiết.'}
          </p>
        </Tooltip>

        {allVersions.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {allVersions.map(v => (
              <button
                key={v._id}
                type="button"
                onClick={() => setActiveId(v._id)}
                className={`px-1.5 py-0.5 text-[8px] font-mono font-bold border transition-colors ${
                  activeId === v._id
                    ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                    : 'border-vpa-olive-light/40 text-gray-400 hover:border-vpa-gold hover:text-vpa-gold'
                }`}
              >
                Mã {v.examCode || '001'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-t border-vpa-olive-light/10 pt-3 text-[10px]">
        <span className="text-gray-400">
          {active.questions.length} câu | {active.duration} phút
        </span>

        <div className="flex space-x-2">
          <button
            onClick={() => onStartPractice(active._id, 'practice')}
            className="px-2 py-1 border border-vpa-olive-light/50 hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors font-bold uppercase text-[9px] rounded-lg"
          >
            Ôn luyện
          </button>
          <button
            onClick={() => onStartPractice(active._id, 'mock')}
            className="px-2 py-1 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors font-bold uppercase text-[9px] rounded-lg"
          >
            Thi thử
          </button>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  user: any;
  setUser: (user: any) => void;
  onJoinRoom: (roomCode: string) => void;
  onNavigateToQuizMgmt: () => void;
  onNavigateToUserMgmt: () => void;
  onStartPractice: (quizId: string, mode: 'practice' | 'mock') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  setUser,
  onJoinRoom,
  onNavigateToQuizMgmt,
  onNavigateToUserMgmt,
  onStartPractice
}) => {
  // `quizzes`: danh sách đầy đủ (không phân trang) — chỉ tải khi mở modal
  // "Tạo phòng thi" (cần thấy hết đề để chọn), không tải lúc vào Dashboard.
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizzesLoadedForModal, setQuizzesLoadedForModal] = useState(false);

  // `practiceQuizzes`: danh sách phân trang riêng cho lưới "Ôn luyện" — tải
  // từng trang qua nút "Xem thêm" thay vì tải hết 1 lần lúc vào trang.
  const [practiceQuizzes, setPracticeQuizzes] = useState<any[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(true);
  const [practiceLoadingMore, setPracticeLoadingMore] = useState(false);
  const [practicePage, setPracticePage] = useState(1);
  const [practiceTotalPages, setPracticeTotalPages] = useState(1);
  const [practiceTotalCount, setPracticeTotalCount] = useState(0);
  const PRACTICE_PAGE_SIZE = 6;

  const [quizSkeletonCount] = useState(getInitialQuizSkeletonCount);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  
  // Offline pending submissions state
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  
  // 2FA states in UI
  const [otp2FA, setOtp2FA] = useState('');
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [msg2FA, setMsg2FA] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);

  // Room creation state
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [searchQuizQuery, setSearchQuizQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [antiCheat, setAntiCheat] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(0); // 0 = không giới hạn

  // Đề gốc dùng cho lưới "Ôn luyện" — quizzes giờ chứa cả mã đề biến thể
  // (phục vụ bộ chọn mã đề khi tạo phòng bên dưới), nhưng lưới ôn luyện chỉ
  // nên hiện đề gốc, không hiện từng mã đề biến thể như một đề riêng.
  const rootQuizzesForPractice = React.useMemo(
    () => practiceQuizzes.filter(q => !q.parentQuizId),
    [practiceQuizzes]
  );

  // Filter quizzes for select box
  const filteredQuizzesForSelect = React.useMemo(() => {
    return quizzes.filter(q => {
      const isChild = !!q.parentQuizId;
      if (isChild) return false;

      // Find all variants to compile all associated exam codes
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

  // Invitations & Rooms state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [myRoomsTab, setMyRoomsTab] = useState<'active' | 'finished'>('active');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState('');

  const fetchInvitations = async () => {
    try {
      const response = await axios.get('/api/invitations');
      setInvitations(response.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách lời mời:', err);
    }
  };

  const fetchMyRooms = async () => {
    if (user?.role === 'admin' || user?.role === 'master-admin') {
      try {
        const response = await axios.get('/api/rooms');
        setMyRooms(response.data);
      } catch (err) {
        console.error('Lỗi lấy danh sách phòng thi:', err);
      }
    }
  };

  // Tách phòng đã kết thúc ra khỏi danh sách chính — phòng thi tích lũy theo
  // thời gian nên để chung sẽ nhanh chóng làm loãng những phòng đang thi/chờ
  // thi thực sự cần theo dõi.
  const activeMyRooms = React.useMemo(() => myRooms.filter(r => r.status !== 'finished'), [myRooms]);
  const finishedMyRooms = React.useMemo(() => myRooms.filter(r => r.status === 'finished'), [myRooms]);
  const visibleMyRooms = myRoomsTab === 'active' ? activeMyRooms : finishedMyRooms;

  useEffect(() => {
    fetchPracticeQuizzes(1);
    fetchInvitations();
    fetchMyRooms();
  }, [user]);

  useEffect(() => {
    const cached = localStorage.getItem('pending-submissions');
    if (cached) {
      try {
        setPendingSubmissions(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSyncSubmissions = async () => {
    if (syncing) return;
    setSyncing(true);
    let successCount = 0;
    const remainingPending: any[] = [];

    const cached = localStorage.getItem('pending-submissions');
    if (!cached) {
      setSyncing(false);
      return;
    }

    let items: any[] = [];
    try {
      items = JSON.parse(cached);
    } catch (e) {
      localStorage.removeItem('pending-submissions');
      setPendingSubmissions([]);
      setSyncing(false);
      return;
    }

    for (const item of items) {
      try {
        await axios.post('/api/rooms/submit', {
          roomId: item.roomId,
          quizId: item.quizId,
          answers: item.answers,
          mode: item.mode,
          antiCheatViolations: item.antiCheatViolations
        });
        successCount++;
      } catch (err: any) {
        if (err.response && (err.response.status === 400 || err.response.status === 404)) {
          console.warn('Discarding invalid/duplicate attempt during sync:', err.response.data?.message);
        } else {
          remainingPending.push(item);
        }
      }
    }

    if (successCount > 0) {
      await window.showAlert(
        `Đã đồng bộ thành công ${successCount} bài thi về máy chủ trung tâm!`,
        'Đồng bộ kết quả'
      );
    } else if (remainingPending.length > 0) {
      await window.showAlert(
        'Đồng bộ thất bại. Không có kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng truyền số liệu quân sự.',
        'Lỗi đồng bộ'
      );
    }

    localStorage.setItem('pending-submissions', JSON.stringify(remainingPending));
    setPendingSubmissions(remainingPending);
    setSyncing(false);
  };

  // Dùng chung 1 socket cho toàn app (xem utils/socket.ts) thay vì tự mở kết
  // nối riêng — App.tsx sở hữu vòng đời connect/disconnect (connect lúc đăng
  // nhập, disconnect lúc đăng xuất); ở đây chỉ đảm bảo đã connect + đăng ký
  // kênh cá nhân (idempotent, an toàn khi gọi lại) rồi gắn/gỡ listener riêng
  // của Dashboard. Cảnh báo gian lận / nộp bài cho host giờ đi qua icon
  // chuông thông báo (NotificationBell), không xử lý riêng ở đây nữa.
  useEffect(() => {
    if (!user?.id) return;

    const socket = getAppSocket();
    socket.connect();
    socket.emit('registerUser', user.id);

    const handleNewInvitation = () => fetchInvitations();
    const handleRoomParticipantsChanged = () => fetchMyRooms();

    socket.on('newInvitation', handleNewInvitation);
    socket.on('roomParticipantsChanged', handleRoomParticipantsChanged);

    return () => {
      socket.off('newInvitation', handleNewInvitation);
      socket.off('roomParticipantsChanged', handleRoomParticipantsChanged);
    };
  }, [user]);

  // Danh sách đầy đủ, chỉ dùng cho bộ chọn đề khi tạo phòng thi — tải khi mở
  // modal (đã có sẵn thì thôi, không tải lại mỗi lần mở).
  const fetchQuizzesForModal = async () => {
    if (quizzesLoadedForModal) return;
    try {
      const response = await axios.get('/api/quizzes?includeVariants=true');
      setQuizzes(response.data);
      setQuizzesLoadedForModal(true);
    } catch (err) {
      console.error('Lỗi lấy danh sách đề thi:', err);
    }
  };

  const fetchPracticeQuizzes = async (page: number) => {
    if (page === 1) setPracticeLoading(true);
    else setPracticeLoadingMore(true);
    try {
      // includeVariants=true: cần cả đề gốc lẫn các mã đề biến thể để nhóm lại
      // theo tab mã đề trên từng thẻ ôn luyện.
      const response = await axios.get('/api/quizzes', {
        params: { includeVariants: 'true', page, limit: PRACTICE_PAGE_SIZE }
      });
      setPracticeQuizzes(prev => (page === 1 ? response.data.quizzes : [...prev, ...response.data.quizzes]));
      setPracticePage(response.data.currentPage);
      setPracticeTotalPages(response.data.totalPages);
      setPracticeTotalCount(response.data.totalCount);
      if (response.data.totalCount > 0) {
        localStorage.setItem(QUIZ_SKELETON_CACHE_KEY, String(response.data.totalCount));
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách đề thi:', err);
    } finally {
      setPracticeLoading(false);
      setPracticeLoadingMore(false);
    }
  };

  const handleLoadMorePractice = () => {
    if (practiceLoadingMore || practicePage >= practiceTotalPages) return;
    fetchPracticeQuizzes(practicePage + 1);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (roomCode.length !== 6) {
      setError('Mã phòng thi phải có đúng 6 ký tự.');
      return;
    }
    onJoinRoom(roomCode);
  };

  // 2FA controls
  const handleSetup2FA = async () => {
    setLoading2FA(true);
    try {
      const response = await axios.post('/api/auth/setup-2fa');
      setMsg2FA(response.data.message);
      setShow2FAModal(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể thiết lập 2FA.');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading2FA(true);
    try {
      const response = await axios.post('/api/auth/enable-2fa', { code: otp2FA });
      const updatedUser = { ...user, twoFactorEnabled: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShow2FAModal(false);
      setOtp2FA('');
      await window.showAlert(response.data.message, 'Xác thực hai yếu tố');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác.');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    const confirmDisable = await window.showConfirm('Đồng chí có chắc chắn muốn tắt bảo mật 2FA?', 'Tắt bảo mật 2FA');
    if (!confirmDisable) return;
    try {
      const response = await axios.post('/api/auth/disable-2fa');
      const updatedUser = { ...user, twoFactorEnabled: false };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      await window.showAlert(response.data.message, 'Bảo mật 2FA');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tắt 2FA.');
    }
  };

  const handleRevokeTrustedDevices = async () => {
    const confirmed = await window.showConfirm(
      'Thu hồi tất cả thiết bị đang được tin cậy? Lần đăng nhập tiếp theo trên mọi thiết bị (kể cả thiết bị đang dùng) sẽ cần nhập lại mã OTP.',
      'Thu hồi thiết bị tin cậy'
    );
    if (!confirmed) return;
    try {
      const response = await axios.post('/api/auth/revoke-trusted-devices');
      await window.showAlert(response.data.message, 'Bảo mật 2FA');
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Không thể thu hồi thiết bị tin cậy.', 'Lỗi');
    }
  };

  // Create room controls
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    try {
      const response = await axios.post('/api/rooms', {
        quizId: selectedQuiz,
        antiCheatEnabled: antiCheat,
        showResultImmediately: showResult,
        maxParticipants
      });
      setShowCreateRoomModal(false);
      setSelectedQuiz('');
      setSearchQuizQuery('');
      setSelectedCategoryFilter('');
      setMaxParticipants(0);
      await fetchMyRooms();
      onJoinRoom(response.data.room.roomCode);
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi tạo phòng thi.', 'Lỗi tạo phòng');
    }
  };

  const handleAcceptInvitation = async (id: string) => {
    try {
      const response = await axios.put(`/api/invitations/${id}/respond`, { status: 'accepted' });
      if (response.data.action === 'join' && response.data.roomCode) {
        onJoinRoom(response.data.roomCode);
      }
      fetchInvitations();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi chấp nhận lời mời.', 'Lỗi phản hồi');
    }
  };

  const handleDeclineInvitation = async (id: string) => {
    try {
      await axios.put(`/api/invitations/${id}/respond`, { status: 'declined' });
      fetchInvitations();
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi từ chối lời mời.', 'Lỗi phản hồi');
    }
  };

  const handleOpenInvite = (roomCode: string) => {
    setInviteRoomCode(roomCode);
    setShowInviteModal(true);
  };

  // Cho phép nút Back trình duyệt đóng từng modal thay vì thoát thẳng ra
  // trang trước đó — xem chi tiết trong useSubviewBack.
  useSubviewBack(showCreateRoomModal, () => setShowCreateRoomModal(false));
  useSubviewBack(show2FAModal, () => setShow2FAModal(false));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Welcome Banner */}
      <div className="relative border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-8 mb-8 overflow-hidden rounded-lg shadow-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-vpa-olive/5 dark:bg-vpa-gold/5 rounded-full filter blur-3xl" />

        <h1 className="text-xl md:text-2xl font-extrabold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider">
          Xin chào, {user?.rank ? `${user.rank} ` : ''}{user?.fullName || 'Đồng chí'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono uppercase tracking-wider">
          Chức vụ: {user?.position || 'N/A'} | Đơn vị: {user?.unit?.name || 'N/A'}
        </p>

        {/* 2FA Status Banner — Chiến sĩ không có email nên không thể dùng 2FA */}
        {user?.email && (
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-vpa-olive-light/20 pt-6">
          {user?.twoFactorEnabled ? (
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-500 text-xs font-bold">
              <ShieldCheck size={20} />
              <span>BẢO MẬT 2FA ĐANG BẬT</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-vpa-red text-xs font-bold">
              <ShieldWarning size={20} />
              <span>BẢO MẬT 2FA ĐANG TẮT</span>
            </div>
          )}
          
          {!user?.twoFactorEnabled ? (
            <button
              onClick={handleSetup2FA}
              disabled={loading2FA}
              className="px-3 py-1 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
            >
              {loading2FA ? 'Đang gửi OTP...' : 'Bật bảo mật 2FA'}
            </button>
          ) : (
            <>
              <button
                onClick={handleDisable2FA}
                className="px-3 py-1 bg-vpa-red/10 border border-vpa-red/30 text-vpa-red text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-red hover:text-white transition-colors rounded-lg"
              >
                Tắt bảo mật 2FA
              </button>
              <button
                onClick={handleRevokeTrustedDevices}
                title="Bắt tất cả thiết bị (kể cả thiết bị đang dùng) phải nhập lại OTP ở lần đăng nhập tiếp theo"
                className="px-3 py-1 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light/10 transition-colors rounded-lg"
              >
                Thu hồi thiết bị tin cậy
              </button>
            </>
          )}
        </div>
        )}
      </div>

      {/* Admin/Sub-admin/Master-admin overview stats */}
      {(user?.role === 'admin' || user?.role === 'master-admin' || user?.role === 'sub-admin') && (
        <AdminStatsPanel />
      )}

      {/* Offline Pending Submissions Banner */}
      {pendingSubmissions.length > 0 && (
        <div className="border border-vpa-red bg-vpa-red/5 p-6 mb-8 rounded-lg shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 border-b border-vpa-red/20 pb-2 mb-2">
              <span className="w-2.5 h-2.5 bg-vpa-red rounded-lg" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-red">
                Báo cáo: Phát hiện bài thi lưu ngoại tuyến (Offline)
              </h3>
            </div>
            <p className="text-xs text-vpa-olive dark:text-vpa-sand leading-relaxed font-mono">
              Hệ thống phát hiện **{pendingSubmissions.length} bài thi** của đồng chí chưa thể gửi về máy chủ trung tâm do mất kết nối mạng lúc làm bài.
            </p>
            <div className="mt-2 space-y-1">
              {pendingSubmissions.map((item, idx) => (
                <div key={item.id || idx} className="text-[10px] text-gray-500 font-mono">
                  • {item.quizTitle} ({item.mode === 'practice' ? 'Ôn luyện' : 'Thi chính thức'}) - {item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : 'N/A'}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleSyncSubmissions}
            disabled={syncing}
            className="md:self-start px-4 py-2 bg-vpa-red hover:bg-vpa-red-light text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 rounded-lg"
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <span>Đồng bộ ngay ({pendingSubmissions.length})</span>
            )}
          </button>
        </div>
      )}

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <div className="border border-vpa-gold bg-vpa-gold/5 dark:bg-vpa-gold/10 p-6 mb-8 rounded-lg shadow-md">
          <div className="flex items-center space-x-2 border-b border-vpa-gold/30 pb-3 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vpa-gold opacity-75 animate-duration-1000"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-vpa-gold"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-gold-bright">
              LỜI MỜI MỚI VÀO PHÒNG THI ({invitations.length})
            </h3>
          </div>
          <div className="space-y-3">
            {invitations.map(inv => (
              <div 
                key={inv._id}
                className="flex flex-col md:flex-row md:items-center justify-between border border-vpa-olive-light/20 bg-vpa-sand/30 dark:bg-vpa-dark/30 p-4 transition-all hover:border-vpa-gold"
              >
                <div className="min-w-0 flex-1 mr-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 border ${
                      inv.role === 'examiner' 
                        ? 'border-vpa-red bg-vpa-red/10 text-vpa-red font-bold' 
                        : 'border-vpa-olive bg-vpa-olive/10 text-vpa-olive dark:text-vpa-gold dark:border-vpa-gold'
                    }`}>
                      {inv.role === 'examiner' ? 'Giám khảo/Giám thị' : 'Thí sinh'}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Mã phòng: <span className="font-bold text-vpa-olive dark:text-vpa-gold-bright">{inv.roomCode}</span></span>
                  </div>
                  <p className="text-xs text-vpa-olive dark:text-vpa-sand">
                    {inv.senderId?.rank ? `${inv.senderId.rank} ` : 'Đồng chí '}<span className="font-bold">{inv.senderId?.fullName || 'Chủ phòng'}</span> ({inv.senderId?.position || 'Chức vụ N/A'} | {inv.senderId?.unitId?.name || 'Đơn vị N/A'}) mời đồng chí tham gia phòng thi với vai trò <span className="font-bold">{inv.role === 'examiner' ? 'Giám khảo' : 'Thí sinh'}</span>.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-mono">
                    Đề thi: {inv.roomId?.quizId?.title || 'Đề thi trắc nghiệm'}
                  </p>
                </div>
                <div className="flex space-x-3 mt-3 md:mt-0">
                  <button
                    onClick={() => handleDeclineInvitation(inv._id)}
                    className="px-3 py-1.5 border border-vpa-red/50 text-vpa-red text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-red hover:text-white transition-colors flex items-center space-x-1 rounded-lg"
                  >
                    <X size={12} />
                    <span>Từ chối</span>
                  </button>
                  <button
                    onClick={() => handleAcceptInvitation(inv._id)}
                    className="px-4 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors flex items-center space-x-1"
                  >
                    <Check size={12} />
                    <span>Chấp nhận</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Left is quick action, right is lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Room Join & Creation */}
        <div className="space-y-8">
          
          {/* Join Exam Room */}
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
            <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider mb-4 pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
              <Play size={18} />
              <span>Tham gia phòng thi</span>
            </h3>

            {error && (
              <p className="text-xs text-vpa-red bg-vpa-red/10 p-2 border-l-2 border-vpa-red mb-4">{error}</p>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-mono">
                  Mã phòng thi
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="VPA123"
                  className="w-full text-center text-lg tracking-[8px] p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold font-mono text-vpa-olive dark:text-vpa-sand rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark uppercase tracking-wider text-xs font-bold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
              >
                Vào hàng chờ thi
              </button>
            </form>
          </div>

          {/* Quick Actions for Admins & Commanders */}
          {(user?.role === 'admin' || user?.role === 'master-admin' || user?.role === 'sub-admin') && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
              <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider mb-4 pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                <Plus size={18} />
                <span>Nhiệm vụ Quản trị</span>
              </h3>

              <div className="space-y-3">
                {(user?.role === 'admin' || user?.role === 'master-admin') && (
                  <>
                    <button
                      onClick={() => { setShowCreateRoomModal(true); setSelectedQuiz(''); setSearchQuizQuery(''); setSelectedCategoryFilter(''); setMaxParticipants(0); fetchQuizzesForModal(); }}
                      className="w-full py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase tracking-wider font-bold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors text-center"
                    >
                      Tạo phòng thi mới
                    </button>
                    <button
                      onClick={onNavigateToQuizMgmt}
                      className="w-full py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider font-bold hover:bg-vpa-olive-light/10 transition-colors text-center"
                    >
                      Quản lý kho đề thi
                    </button>
                  </>
                )}
                
                <button
                  onClick={onNavigateToUserMgmt}
                  className="w-full py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider font-bold hover:bg-vpa-olive-light/10 transition-colors text-center"
                >
                  Quản lý quân nhân đơn vị
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Side */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Created Exam Rooms (Host only) */}
          {(user?.role === 'admin' || user?.role === 'master-admin') && (
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg animate-fadeIn">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-vpa-olive-light/30">
                <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider flex items-center space-x-2 font-semibold">
                  <Users size={20} className="text-vpa-olive dark:text-vpa-gold-bright" />
                  <span>Danh sách phòng thi đã tạo</span>
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light/40 text-gray-500">
                  {myRooms.length} Phòng thi
                </span>
              </div>

              <div className="flex items-center space-x-1 mb-4">
                <button
                  type="button"
                  onClick={() => setMyRoomsTab('active')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    myRoomsTab === 'active'
                      ? 'border-vpa-gold text-vpa-olive dark:text-vpa-sand'
                      : 'border-transparent text-gray-400 hover:text-vpa-olive dark:hover:text-vpa-sand'
                  }`}
                >
                  Đang hoạt động ({activeMyRooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMyRoomsTab('finished')}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    myRoomsTab === 'finished'
                      ? 'border-vpa-gold text-vpa-olive dark:text-vpa-sand'
                      : 'border-transparent text-gray-400 hover:text-vpa-olive dark:hover:text-vpa-sand'
                  }`}
                >
                  Đã kết thúc ({finishedMyRooms.length})
                </button>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {visibleMyRooms.map(room => (
                  <div
                    key={room._id}
                    className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 transition-all hover:border-vpa-gold flex flex-col md:flex-row md:items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="text-xs font-mono font-bold tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold dark:text-vpa-dark px-2 py-0.5">
                          {room.roomCode}
                        </span>
                        <span className={`text-[8px] font-mono px-2 py-0.5 border ${
                          room.status === 'active' 
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600'
                            : room.status === 'finished'
                            ? 'border-red-500 bg-red-500/10 text-red-600 font-bold'
                            : 'border-vpa-olive-light text-gray-500 bg-vpa-olive/5'
                        }`}>
                          {room.status === 'waiting' ? 'ĐANG CHỜ THI' : room.status === 'active' ? 'ĐANG THI' : 'ĐÃ KẾT THÚC'}
                        </span>
                      </div>
                      <Tooltip content={room.quizId?.title || 'Đề thi trắc nghiệm'} className="block">
                        <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand mb-0.5 truncate">
                          Đề: {room.quizId?.title || 'Đề thi trắc nghiệm'}
                        </h4>
                      </Tooltip>
                      <p className="text-[10px] text-gray-500 font-mono">
                        Thời gian: {room.quizId?.duration || 45} phút | Quân số tham gia: {room.participants?.filter((p: any) => p.status !== 'left').length || 0}
                      </p>
                    </div>

                    <div className="flex space-x-2 mt-3 md:mt-0 flex-shrink-0">
                      {room.status !== 'finished' && (
                        <button
                          onClick={() => handleOpenInvite(room.roomCode)}
                          className="px-3 py-1.5 border border-vpa-olive-light/60 hover:border-vpa-gold text-vpa-olive dark:text-vpa-sand text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center space-x-1 whitespace-nowrap flex-shrink-0"
                        >
                          <UserPlus size={12} />
                          <span>Mời quân nhân</span>
                        </button>
                      )}
                      <button
                        onClick={() => onJoinRoom(room.roomCode)}
                        className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors flex items-center space-x-1 whitespace-nowrap flex-shrink-0"
                      >
                        <MorphIcon icon={room.status === 'finished' ? EyeData : SignInData} size={12} />
                        <span>{room.status === 'finished' ? 'Xem kết quả' : 'Vào phòng'}</span>
                      </button>
                    </div>
                  </div>
                ))}
                {visibleMyRooms.length === 0 && (
                  <div className="text-center py-8 text-gray-400 border border-dashed border-vpa-olive-light/25">
                    <p className="text-xs uppercase tracking-wider font-mono">
                      {myRoomsTab === 'active' ? 'Chưa khởi tạo phòng thi nào' : 'Chưa có phòng thi nào kết thúc'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz List */}
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-lg">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-vpa-olive-light/30">
              <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider flex items-center space-x-2">
                <ClipboardText size={20} />
                <span>Đề thi thử & Ôn luyện</span>
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light text-gray-500">
                {practiceTotalCount} Đề thi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {practiceLoading ? (
              Array.from({ length: quizSkeletonCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="border border-vpa-olive-light/30 bg-vpa-sand/30 dark:bg-vpa-dark/15 p-4 animate-pulse flex flex-col justify-between h-40"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-16 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                      <div className="w-16 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    </div>
                    <div className="w-3/4 h-4 bg-vpa-olive-light/20 dark:bg-vpa-gold/20 rounded mb-2"></div>
                    <div className="w-full h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded mb-1"></div>
                    <div className="w-5/6 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                  </div>
                  <div className="flex justify-between items-center border-t border-vpa-olive-light/10 pt-3">
                    <div className="w-24 h-3 bg-vpa-olive-light/10 dark:bg-vpa-gold/10 rounded"></div>
                    <div className="flex space-x-2">
                      <div className="w-14 h-6 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                      <div className="w-14 h-6 bg-vpa-olive-light/20 dark:bg-vpa-gold/15 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : rootQuizzesForPractice.map(quiz => (
              <PracticeQuizCard
                key={quiz._id}
                quiz={quiz}
                variants={practiceQuizzes.filter(v => v.parentQuizId === quiz._id)}
                onStartPractice={onStartPractice}
              />
            ))}
            {!practiceLoading && rootQuizzesForPractice.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400">
                <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider">Chưa có đề thi được xuất bản</p>
              </div>
            )}
          </div>

          {!practiceLoading && practicePage < practiceTotalPages && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={handleLoadMorePractice}
                disabled={practiceLoadingMore}
                className="px-4 py-2 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand text-xs font-bold uppercase tracking-wider hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {practiceLoadingMore ? 'Đang tải...' : 'Xem thêm'}
              </button>
            </div>
          )}
        </div>
      </div>

      </div>

      {/* 2FA SETUP MODAL */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg">
            <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light pb-2 mb-4">
              XÁC MINH KÍCH HOẠT 2FA
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{msg2FA}</p>
            
            <form onSubmit={handleEnable2FA} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">Mã OTP gửi về Gmail</label>
                <input
                  type="text"
                  required
                  placeholder="123456"
                  maxLength={6}
                  value={otp2FA}
                  onChange={e => setOtp2FA(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-lg tracking-[8px] p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2FAModal(false)}
                  className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading2FA}
                  className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold"
                >
                  Kích hoạt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-5 shadow-2xl rounded-lg">
            <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light pb-2 mb-3">
              Khởi tạo phòng thi mới
            </h3>

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[9px] uppercase tracking-wider font-bold text-gray-500">Chọn đề thi từ kho</label>

                {/* Search input for quizzes */}
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

                {/* Quick Category filter buttons */}
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

                {/* Custom scrollable quizzes list */}
                <div className="border border-vpa-olive-light/35 bg-white dark:bg-vpa-dark-card divide-y divide-vpa-olive-light/10 max-h-[260px] overflow-y-auto rounded shadow-inner">
                  {!quizzesLoadedForModal ? (
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

                            {/* Selected Checkmark */}
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-vpa-olive dark:bg-vpa-gold flex items-center justify-center text-white dark:text-vpa-dark">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Version Codes Selection Sub-menu (Only if variants exist and this quiz group is active) */}
                          {variants.length > 0 && isActive && (
                            <div className="mt-2.5 pt-2.5 border-t border-vpa-olive-light/10">
                              <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                Chọn mã đề thi cụ thể cho phòng:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {/* Option for Parent Quiz */}
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

                                {/* Options for Variants */}
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
                <label htmlFor="maxParticipants" className="block text-[9px] uppercase tracking-wider font-bold text-gray-500">
                  Tham gia tối đa (chỉ tính thí sinh)
                </label>
                <NumberStepper
                  id="maxParticipants"
                  value={maxParticipants}
                  onChange={setMaxParticipants}
                  min={0}
                  className="flex items-stretch w-40 border border-vpa-olive-light bg-transparent focus-within:border-vpa-gold rounded-lg overflow-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label htmlFor="antiCheat" className="flex items-center space-x-2 p-2 border border-vpa-olive-light/20 cursor-pointer select-none hover:border-vpa-olive-light/50 transition-colors">
                  <input
                    type="checkbox"
                    id="antiCheat"
                    checked={antiCheat}
                    onChange={e => setAntiCheat(e.target.checked)}
                    className="w-4 h-4 flex-shrink-0 border-vpa-olive-light accent-vpa-olive"
                  />
                  <span className="text-[11px] text-vpa-olive dark:text-vpa-sand font-semibold leading-tight">
                    Chống gian lận (khóa màn hình)
                  </span>
                </label>

                <label htmlFor="showResult" className="flex items-center space-x-2 p-2 border border-vpa-olive-light/20 cursor-pointer select-none hover:border-vpa-olive-light/50 transition-colors">
                  <input
                    type="checkbox"
                    id="showResult"
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
                  onClick={() => { setShowCreateRoomModal(false); setSelectedQuiz(''); setSearchQuizQuery(''); setSelectedCategoryFilter(''); setMaxParticipants(0); }}
                  className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!selectedQuiz}
                  className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold disabled:opacity-50"
                >
                  Tạo phòng thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InviteToRoomModal
        isOpen={showInviteModal}
        roomCode={inviteRoomCode}
        user={user}
        onClose={() => setShowInviteModal(false)}
      />

    </div>
  );
};
export default Dashboard;
