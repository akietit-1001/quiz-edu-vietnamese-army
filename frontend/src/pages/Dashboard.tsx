import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, ClipboardText, Plus, ShieldCheck, ShieldWarning, BookOpen, PencilSimple } from '@phosphor-icons/react';

interface DashboardProps {
  user: any;
  setUser: (user: any) => void;
  onJoinRoom: (roomCode: string) => void;
  onNavigateToQuizMgmt: () => void;
  onNavigateToUserMgmt: () => void;
  onStartPractice: (quizId: string, mode: 'practice' | 'mock') => void;
}

const RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const POSITIONS = ['Chiến sĩ', 'Tiểu đội trưởng', 'Trung đội phó', 'Trung đội trưởng', 'Đại đội phó', 'Đại đội trưởng', 'Tiểu đoàn phó', 'Tiểu đoàn trưởng', 'Chính trị viên', 'Học viên', 'Giảng viên', 'Khác'];

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  setUser,
  onJoinRoom,
  onNavigateToQuizMgmt,
  onNavigateToUserMgmt,
  onStartPractice
}) => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  
  // Edit Profile states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profileDOB, setProfileDOB] = useState(user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
  const [profileRank, setProfileRank] = useState(user?.rank || 'Binh nhì');
  const [profilePosition, setProfilePosition] = useState(user?.position || 'Chiến sĩ');
  const [profileUnit, setProfileUnit] = useState(user?.unit || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // 2FA states in UI
  const [otp2FA, setOtp2FA] = useState('');
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [msg2FA, setMsg2FA] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);

  // Room creation state
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [antiCheat, setAntiCheat] = useState(true);
  const [showResult, setShowResult] = useState(true);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await axios.get('/api/quizzes');
      setQuizzes(response.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách đề thi:', err);
    }
  };

  const handleOpenEditProfile = () => {
    setProfileName(user?.fullName || '');
    setProfileDOB(user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
    setProfileRank(user?.rank || 'Binh nhì');
    setProfilePosition(user?.position || 'Chiến sĩ');
    setProfileUnit(user?.unit || '');
    setProfileAddress(user?.address || '');
    setProfileError('');
    setProfileSuccess('');
    setShowEditProfileModal(true);
  };

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await axios.put('/api/users/profile', {
        fullName: profileName,
        dateOfBirth: profileDOB,
        rank: profileRank,
        position: profilePosition,
        unit: profileUnit,
        address: profileAddress
      });
      
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setProfileSuccess('Cập nhật hồ sơ cá nhân thành công!');
      
      setTimeout(() => {
        setShowEditProfileModal(false);
      }, 1000);
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
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
      setUser({ ...user, twoFactorEnabled: true });
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
      setUser({ ...user, twoFactorEnabled: false });
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
      onJoinRoom(response.data.room.roomCode);
    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Lỗi tạo phòng thi.', 'Lỗi tạo phòng');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Welcome Banner */}
      <div className="relative border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-8 mb-8 overflow-hidden rounded-none shadow-md">
        <div className="absolute top-0 right-0 w-48 h-48 bg-vpa-olive/5 dark:bg-vpa-gold/5 rounded-full filter blur-3xl" />
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleOpenEditProfile}
            className="px-3 py-1.5 border border-vpa-olive-light/40 text-vpa-olive dark:text-vpa-sand text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light/10 transition-colors flex items-center space-x-1"
          >
            <PencilSimple size={12} />
            <span>Sửa hồ sơ</span>
          </button>
        </div>
        <h1 className="text-xl md:text-2xl font-extrabold text-vpa-olive dark:text-vpa-sand uppercase tracking-wider">
          Xin chào, {user?.fullName || 'Đồng chí'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono uppercase tracking-wider">
          Cấp bậc: {user?.rank} | Đơn vị: {user?.unit}
        </p>

        {/* 2FA Status Banner */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-vpa-olive-light/20 pt-6">
          {user?.twoFactorEnabled ? (
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-500 text-xs font-bold">
              <ShieldCheck size={20} />
              <span>BẢO MẬT 2FA ĐANG BẬT (GỬI OTP VỀ GMAIL)</span>
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
                      onClick={() => setShowCreateRoomModal(true)}
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

        {/* Right Side: Quiz List */}
        <div className="lg:col-span-2 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
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
            {quizzes.map(quiz => (
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
            {quizzes.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-400">
                <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider">Chưa có đề thi được xuất bản</p>
              </div>
            )}
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
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none">
            <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light pb-2 mb-4">
              Khởi tạo phòng thi mới
            </h3>
            
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">Chọn đề thi</label>
                <select
                  required
                  value={selectedQuiz}
                  onChange={e => setSelectedQuiz(e.target.value)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold dark:bg-vpa-dark-card text-vpa-olive dark:text-vpa-sand"
                >
                  <option value="">-- Chọn đề thi trong kho --</option>
                  {quizzes.map(q => (
                    <option key={q._id} value={q._id}>{q.title} ({q.questions.length} câu)</option>
                  ))}
                </select>
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
                  onClick={() => setShowCreateRoomModal(false)}
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

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Header decoration */}
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold-bright rounded-none" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand">
                Cập nhật hồ sơ cá nhân
              </h3>
            </div>

            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Họ và tên của đồng chí</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  required
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Cấp bậc</label>
                  <select
                    value={profileRank}
                    onChange={e => setProfileRank(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  >
                    {RANKS.map(rk => (
                      <option key={rk} value={rk} className="dark:bg-vpa-dark">{rk}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Chức vụ</label>
                  <select
                    value={profilePosition}
                    onChange={e => setProfilePosition(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  >
                    {POSITIONS.map(ps => (
                      <option key={ps} value={ps} className="dark:bg-vpa-dark">{ps}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị</label>
                <input
                  type="text"
                  value={profileUnit}
                  onChange={e => setProfileUnit(e.target.value)}
                  required
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={profileDOB}
                    onChange={e => setProfileDOB(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={e => setProfileAddress(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                  />
                </div>
              </div>

              {profileSuccess && (
                <p className="text-green-600 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 p-2 border border-green-500/20">{profileSuccess}</p>
              )}

              {profileError && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{profileError}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-none"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-none font-bold"
                >
                  Cập nhật
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
