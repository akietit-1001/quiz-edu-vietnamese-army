import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Play, ClipboardText, Plus, ShieldCheck, ShieldWarning, BookOpen, UserPlus, Check, X, Eye, Users, SignIn } from '@phosphor-icons/react';

const CATEGORIES = ['Chính trị', 'Quân sự', 'Truyền thống quân đội', 'Hậu cần - Kỹ thuật', 'Điều lệnh', 'Khác'];

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
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<'examinee' | 'examiner'>('examinee');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const fetchManagedUsers = async () => {
    if (user?.role === 'admin' || user?.role === 'master-admin' || user?.role === 'sub-admin') {
      try {
        const response = await axios.get('/api/users');
        setManagedUsers(response.data);
      } catch (err) {
        console.error('Lỗi lấy danh sách quân nhân quản lý:', err);
      }
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchInvitations();
    fetchMyRooms();
    fetchManagedUsers();
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

  // Connect to socket for real-time invitation notifications
  useEffect(() => {
    if (!user?.id) return;

    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/');
    const socket = io(socketUrl);

    socket.emit('registerUser', user.id);

    socket.on('newInvitation', () => {
      fetchInvitations();
    });

    socket.on('roomParticipantsChanged', () => {
      fetchMyRooms();
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/quizzes');
      setQuizzes(response.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách đề thi:', err);
    } finally {
      setLoading(false);
    }
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

  // Create room controls
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    try {
      const response = await axios.post('/api/rooms', {
        quizId: selectedQuiz,
        antiCheatEnabled: antiCheat,
        showResultImmediately: showResult
      });
      setShowCreateRoomModal(false);
      setSelectedQuiz('');
      setSearchQuizQuery('');
      setSelectedCategoryFilter('');
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
    setInviteEmail('');
    setInviteEmails([]);
    setInviteRole('examinee');
    setInviteError('');
    setInviteSuccess('');
    setShowInviteModal(true);
  };

  const handleAddEmail = (emailToAdd: string) => {
    const email = emailToAdd.trim().toLowerCase();
    if (!email) return;
    if (inviteEmails.includes(email)) {
      setInviteError('Email này đã có trong danh sách chuẩn bị mời.');
      return;
    }
    setInviteEmails([...inviteEmails, email]);
    setInviteEmail('');
    setInviteError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setInviteEmails(inviteEmails.filter(e => e !== emailToRemove));
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalEmails = [...inviteEmails];
    const typed = inviteEmail.trim().toLowerCase();
    if (typed && !finalEmails.includes(typed)) {
      finalEmails.push(typed);
    }

    if (finalEmails.length === 0) {
      setInviteError('Đồng chí vui lòng nhập hoặc chọn ít nhất một quân nhân để mời.');
      return;
    }

    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const response = await axios.post('/api/invitations', {
        roomCode: inviteRoomCode,
        recipientEmails: finalEmails,
        role: inviteRole
      });
      setInviteSuccess(response.data.message || 'Đã gửi lời mời thành công!');
      setInviteEmail('');
      setInviteEmails([]);
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Không thể gửi lời mời.');
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredUsers = React.useMemo(() => {
    return inviteEmail.trim() === ''
      ? managedUsers
      : managedUsers.filter(u =>
          u.fullName.toLowerCase().includes(inviteEmail.toLowerCase()) ||
          u.email.toLowerCase().includes(inviteEmail.toLowerCase()) ||
          (u.rank && u.rank.toLowerCase().includes(inviteEmail.toLowerCase()))
        );
  }, [inviteEmail, managedUsers]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Welcome Banner */}
      <div className="relative border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-8 mb-8 overflow-hidden rounded-none shadow-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-vpa-olive/5 dark:bg-vpa-gold/5 rounded-full filter blur-3xl" />

        <h1 className="text-xl md:text-2xl font-extrabold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider">
          Xin chào, {user?.rank ? `${user.rank} ` : ''}{user?.fullName || 'Đồng chí'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono uppercase tracking-wider">
          Chức vụ: {user?.position || 'N/A'} | Đơn vị: {user?.unit || 'N/A'}
        </p>

        {/* 2FA Status Banner */}
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
            <button
              onClick={handleDisable2FA}
              className="px-3 py-1 bg-vpa-red/10 border border-vpa-red/30 text-vpa-red text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-red hover:text-white transition-colors"
            >
              Tắt bảo mật 2FA
            </button>
          )}
        </div>
      </div>

      {/* Offline Pending Submissions Banner */}
      {pendingSubmissions.length > 0 && (
        <div className="border border-vpa-red bg-vpa-red/5 p-6 mb-8 rounded-none shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 border-b border-vpa-red/20 pb-2 mb-2">
              <span className="w-2.5 h-2.5 bg-vpa-red rounded-none" />
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
            className="md:self-start px-4 py-2 bg-vpa-red hover:bg-vpa-red-light text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 rounded-none"
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin mr-2" />
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
        <div className="border border-vpa-gold bg-vpa-gold/5 dark:bg-vpa-gold/10 p-6 mb-8 rounded-none shadow-md">
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
                <div>
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
                    {inv.senderId?.rank ? `${inv.senderId.rank} ` : 'Đồng chí '}<span className="font-bold">{inv.senderId?.fullName || 'Chủ phòng'}</span> ({inv.senderId?.position || 'Chức vụ N/A'} | {inv.senderId?.unit || 'Đơn vị N/A'}) mời đồng chí tham gia phòng thi với vai trò <span className="font-bold">{inv.role === 'examiner' ? 'Giám khảo' : 'Thí sinh'}</span>.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-mono">
                    Đề thi: {inv.roomId?.quizId?.title || 'Đề thi trắc nghiệm'}
                  </p>
                </div>
                <div className="flex space-x-3 mt-3 md:mt-0">
                  <button
                    onClick={() => handleDeclineInvitation(inv._id)}
                    className="px-3 py-1.5 border border-vpa-red/50 text-vpa-red text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-red hover:text-white transition-colors flex items-center space-x-1"
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
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
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
                  className="w-full text-center text-lg tracking-[8px] p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold font-mono text-vpa-olive dark:text-vpa-sand"
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
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
              <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider mb-4 pb-2 border-b border-vpa-olive-light/30 flex items-center space-x-2">
                <Plus size={18} />
                <span>Nhiệm vụ Quản trị</span>
              </h3>

              <div className="space-y-3">
                {(user?.role === 'admin' || user?.role === 'master-admin') && (
                  <>
                    <button
                      onClick={() => { setShowCreateRoomModal(true); setSelectedQuiz(''); setSearchQuizQuery(''); setSelectedCategoryFilter(''); }}
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
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none animate-fadeIn">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-vpa-olive-light/30">
                <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider flex items-center space-x-2 font-semibold">
                  <Users size={20} className="text-vpa-olive dark:text-vpa-gold-bright" />
                  <span>Danh sách phòng thi đã tạo</span>
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light/40 text-gray-500">
                  {myRooms.length} Phòng thi
                </span>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {myRooms.map(room => (
                  <div
                    key={room._id}
                    className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 transition-all hover:border-vpa-gold flex flex-col md:flex-row md:items-center justify-between"
                  >
                    <div>
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
                      <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand mb-0.5">
                        Đề: {room.quizId?.title || 'Đề thi trắc nghiệm'}
                      </h4>
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
                        {room.status === 'finished' ? <Eye size={12} /> : <SignIn size={12} />}
                        <span>{room.status === 'finished' ? 'Xem kết quả' : 'Vào phòng'}</span>
                      </button>
                    </div>
                  </div>
                ))}
                {myRooms.length === 0 && (
                  <div className="text-center py-8 text-gray-400 border border-dashed border-vpa-olive-light/25">
                    <p className="text-xs uppercase tracking-wider font-mono">Chưa khởi tạo phòng thi nào</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz List */}
          <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-vpa-olive-light/30">
              <h3 className="text-sm font-bold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider flex items-center space-x-2">
                <ClipboardText size={20} />
                <span>Đề thi thử & Ôn luyện</span>
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light text-gray-500">
                {quizzes.length} Đề thi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
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
            ) : quizzes.map(quiz => (
              <div
                key={quiz._id}
                className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 transition-all hover:border-vpa-gold flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-vpa-olive/10 dark:bg-vpa-gold/10 text-vpa-olive dark:text-vpa-gold-bright">
                      {quiz.category}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">Code: {quiz.shareCode}</span>
                  </div>
                  <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand mb-1">
                    {quiz.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 line-clamp-2 mb-4">
                    {quiz.description || 'Không có mô tả chi tiết.'}
                  </p>
                </div>

                <div className="flex justify-between items-center border-t border-vpa-olive-light/10 pt-3 text-[10px]">
                  <span className="text-gray-400">
                    {quiz.questions.length} câu | {quiz.duration} phút
                  </span>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onStartPractice(quiz._id, 'practice')}
                      className="px-2 py-1 border border-vpa-olive-light/50 hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors font-bold uppercase text-[9px]"
                    >
                      Ôn luyện
                    </button>
                    <button
                      onClick={() => onStartPractice(quiz._id, 'mock')}
                      className="px-2 py-1 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors font-bold uppercase text-[9px]"
                    >
                      Thi thử
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && quizzes.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400">
                <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider">Chưa có đề thi được xuất bản</p>
              </div>
            )}
          </div>
        </div>
      </div>

      </div>

      {/* 2FA SETUP MODAL */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none">
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
                  className="w-full text-center text-lg tracking-[8px] p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold font-mono"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2FAModal(false)}
                  className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
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
          <div className="w-full max-w-lg border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none">
            <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light pb-2 mb-4">
              Khởi tạo phòng thi mới
            </h3>
            
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-1">Chọn đề thi từ kho</label>
                
                {/* Search input for quizzes */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={searchQuizQuery}
                    onChange={e => setSearchQuizQuery(e.target.value)}
                    placeholder="Tìm theo tên đề thi hoặc mã chia sẻ..."
                    className="w-full text-xs p-2.5 pl-8 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold text-vpa-olive dark:text-vpa-sand"
                  />
                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Quick Category filter buttons */}
                <div className="flex space-x-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
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
                <div className="border border-vpa-olive-light/35 bg-white dark:bg-vpa-dark-card divide-y divide-vpa-olive-light/10 max-h-[220px] overflow-y-auto rounded shadow-inner">
                  {filteredQuizzesForSelect.length === 0 ? (
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
                          className={`p-3 text-left transition-all flex flex-col group ${
                            isActive 
                              ? 'bg-vpa-olive/15 dark:bg-vpa-gold/15 border-l-4 border-vpa-olive dark:border-vpa-gold'
                              : 'hover:bg-vpa-olive/5 dark:hover:bg-vpa-gold/5 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h4 className={`text-xs font-bold transition-colors ${
                                isActive ? 'text-vpa-olive dark:text-vpa-gold' : 'text-vpa-olive dark:text-vpa-sand group-hover:text-vpa-olive dark:group-hover:text-vpa-gold-bright'
                              }`}>
                                {q.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-gray-400 mt-1">
                                <span className="font-mono bg-vpa-olive-light/10 dark:bg-vpa-gold/10 px-1.5 py-0.2 rounded text-[8px] text-vpa-olive dark:text-vpa-gold-bright uppercase">{q.category}</span>
                                <span>•</span>
                                <span>{q.questions?.length || 0} câu / {q.duration || 45} phút</span>
                                <span>•</span>
                                <span className="font-mono font-bold text-vpa-gold uppercase">Mã chia sẻ: {q.shareCode}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-gray-400 mt-1">
                                <span className="italic text-gray-500">Người soạn: {q.creatorId?.fullName || 'Hệ thống'}</span>
                                {(() => {
                                  const allCodes = [parentCode, ...variants.map((v: any) => v.examCode)].filter(Boolean);
                                  return allCodes.length > 0 ? (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono bg-vpa-sand dark:bg-vpa-dark px-1.5 py-0.2 rounded text-[8px] text-vpa-olive dark:text-vpa-sand">Mã đề: {allCodes.join(', ')}</span>
                                    </>
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="antiCheat"
                  checked={antiCheat}
                  onChange={e => setAntiCheat(e.target.checked)}
                  className="w-4 h-4 border-vpa-olive-light accent-vpa-olive"
                />
                <label htmlFor="antiCheat" className="text-xs text-vpa-olive dark:text-vpa-sand select-none font-semibold">
                  Kích hoạt chống gian lận (Khóa màn hình)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showResult"
                  checked={showResult}
                  onChange={e => setShowResult(e.target.checked)}
                  className="w-4 h-4 border-vpa-olive-light accent-vpa-olive"
                />
                <label htmlFor="showResult" className="text-xs text-vpa-olive dark:text-vpa-sand select-none font-semibold">
                  Hiển thị điểm thi cho thí sinh ngay khi thi xong
                </label>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-vpa-olive-light/20">
                <button
                  type="button"
                  onClick={() => { setShowCreateRoomModal(false); setSelectedQuiz(''); setSearchQuizQuery(''); setSelectedCategoryFilter(''); }}
                  className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white"
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

      {/* INVITE USER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none relative">
            <button 
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <UserPlus size={18} className="text-vpa-olive dark:text-vpa-sand" />
              <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand">
                Mời quân nhân tham gia phòng {inviteRoomCode}
              </h3>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="relative">
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-mono">
                  Quân nhân nhận lời mời (Nhập email hoặc chọn từ danh sách)
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 flex relative">
                    <input
                      type="text"
                      placeholder="Tìm theo tên, cấp bậc hoặc nhập email..."
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                      className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                    />
                    {managedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        className="px-3 border-y border-r border-vpa-olive-light hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors font-bold text-xs"
                        title="Hiện danh sách quân nhân quản lý"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddEmail(inviteEmail)}
                    disabled={!inviteEmail.trim()}
                    className="px-4 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs uppercase font-bold tracking-wider transition-colors disabled:opacity-50"
                  >
                    Thêm
                  </button>
                </div>

                {/* Suggestions / Dropdown List */}
                {showSuggestions && filteredUsers.length > 0 && (
                  <div className="absolute z-[100] left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light shadow-2xl font-mono text-xs">
                    {filteredUsers.map(u => (
                      <div
                        key={u._id}
                        onMouseDown={() => {
                          handleAddEmail(u.email);
                          setShowSuggestions(false);
                        }}
                        className="p-2.5 cursor-pointer hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/15 text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light/10 last:border-none flex flex-col justify-start items-start"
                      >
                        <div className="w-full flex justify-between items-center">
                          <span className="font-bold text-xs">{u.rank ? `${u.rank} ` : ''}{u.fullName}</span>
                          <span className="text-[9px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light bg-vpa-olive/5 text-gray-500">
                            {u.unit || 'Đơn vị N/A'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                          Chức vụ: <span className="font-semibold text-vpa-olive dark:text-vpa-sand">{u.position || 'N/A'}</span>
                        </div>
                        <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                          Email: {u.email}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected User Chips */}
                {inviteEmails.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-[8px] uppercase tracking-wider text-gray-400 mb-1 font-mono">
                      Danh sách chuẩn bị mời ({inviteEmails.length} quân nhân)
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-vpa-sand/20 dark:bg-vpa-dark/30 border border-vpa-olive-light/20 max-h-32 overflow-y-auto">
                      {inviteEmails.map(email => {
                        const userObj = managedUsers.find(u => u.email === email);
                        return (
                          <div 
                            key={email}
                            className="flex items-center space-x-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark px-2 py-1 text-[10px] font-mono tracking-wider font-semibold"
                          >
                            <span>{userObj ? `${userObj.rank ? userObj.rank + ' ' : ''}${userObj.fullName}` : email}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="hover:bg-white/20 dark:hover:bg-black/10 rounded p-0.5 transition-colors"
                              title="Xóa"
                            >
                              <X size={10} weight="bold" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-mono">
                  Vai trò trong phòng thi
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'examinee' | 'examiner')}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card"
                >
                  <option value="examinee">Thí sinh (Tham gia làm bài thi)</option>
                  <option value="examiner">Giám khảo/Giám thị (Giám sát phòng thi)</option>
                </select>
              </div>

              {inviteSuccess && (
                <p className="text-green-600 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 p-2 border border-green-500/20">
                  {inviteSuccess}
                </p>
              )}

              {inviteError && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">
                  {inviteError}
                </p>
              )}

              <div className="flex space-x-3 pt-4 border-t border-vpa-olive-light/20">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading || (inviteEmails.length === 0 && !inviteEmail.trim())}
                  className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs uppercase font-bold disabled:opacity-50 transition-colors"
                >
                  {inviteLoading ? 'Đang gửi lời mời...' : 'Gửi lời mời'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default Dashboard;
