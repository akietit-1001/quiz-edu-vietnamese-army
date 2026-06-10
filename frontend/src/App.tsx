import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

declare global {
  interface Window {
    showAlert: (message: string, title?: string) => Promise<void>;
    showConfirm: (message: string, title?: string) => Promise<boolean>;
  }
}
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import QuizManagement from './pages/QuizManagement';
import UserManagement from './pages/UserManagement';
import RoomLobby from './pages/RoomLobby';
import ExamTaker from './pages/ExamTaker';
import RoomResults from './pages/RoomResults';
import { ArrowUp } from '@phosphor-icons/react';

// Redux Integration
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setAuth, updateUser, clearAuth } from './store/slices/authSlice';
import { setDarkMode, setCurrentView } from './store/slices/uiSlice';
import { startRoomLobby, startExam, clearExam } from './store/slices/examSlice';

const RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const POSITIONS = ['Chiến sĩ', 'Tiểu đội trưởng', 'Trung đội phó', 'Trung đội trưởng', 'Đại đội phó', 'Đại đội trưởng', 'Tiểu đoàn phó', 'Tiểu đoàn trưởng', 'Chính trị viên', 'Học viên', 'Giảng viên', 'Khác'];

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Select states from Redux
  const { user, token } = useAppSelector((state) => state.auth);
  const { darkMode, currentView } = useAppSelector((state) => state.ui);
  const {
    activeRoomCode,
    activeRoomId,
    activeQuizId,
    activeExamMode,
    activeRoomSettings,
  } = useAppSelector((state) => state.exam);

  // Global Dialog State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  // Edit Profile states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileDOB, setProfileDOB] = useState('');
  const [profileRank, setProfileRank] = useState('Binh nhì');
  const [profilePosition, setProfilePosition] = useState('Chiến sĩ');
  const [profileUnit, setProfileUnit] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Change Password states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleOpenEditProfile = () => {
    if (!user) return;
    setProfileName(user.fullName || '');
    setProfileDOB(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
    setProfileRank(user.rank || 'Binh nhì');
    setProfilePosition(user.position || 'Chiến sĩ');
    setProfileUnit(user.unit || '');
    setProfileAddress(user.address || '');
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
      
      const updatedUser = res.data.user;
      dispatch(updateUser(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setProfileSuccess('Cập nhật hồ sơ cá nhân thành công!');
      
      setTimeout(() => {
        setShowEditProfileModal(false);
      }, 1000);
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
    }
  };

  const handleOpenChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPwError('');
    setPwSuccess('');
    setShowChangePasswordModal(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword !== confirmNewPassword) {
      setPwError('Mật khẩu xác nhận không chính xác.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setPwLoading(true);
    try {
      const response = await axios.put('/api/users/change-password', {
        currentPassword,
        newPassword
      });
      setPwSuccess(response.data.message || 'Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPwSuccess('');
      }, 1500);
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setPwLoading(false);
    }
  };

  // Register global alert/confirm handlers
  useEffect(() => {
    window.showAlert = (message: string, title: string = 'Thông báo') => {
      return new Promise<void>((resolve) => {
        setModal({
          isOpen: true,
          type: 'alert',
          title,
          message,
          onConfirm: () => {
            setModal(prev => ({ ...prev, isOpen: false }));
            resolve();
          }
        });
      });
    };

    window.showConfirm = (message: string, title: string = 'Xác nhận') => {
      return new Promise<boolean>((resolve) => {
        setModal({
          isOpen: true,
          type: 'confirm',
          title,
          message,
          onConfirm: () => {
            setModal(prev => ({ ...prev, isOpen: false }));
            resolve(true);
          },
          onCancel: () => {
            setModal(prev => ({ ...prev, isOpen: false }));
            resolve(false);
          }
        });
      });
    };
  }, []);

  // Scroll ontop state
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 1. Initial configuration and dark mode sync
  useEffect(() => {
    // Sync theme
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.style.backgroundColor = '#070a09'; // Set base dark background
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#f8f8fa'; // Set base light background
    }
  }, [darkMode]);



  // 2. Persistent authentication recovery & Silent refresh on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const res = await axios.post('/api/auth/refresh-token', {}, { withCredentials: true });
          const { accessToken } = res.data;
          const parsedUser = JSON.parse(savedUser);
          dispatch(setAuth({ user: parsedUser, accessToken }));
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          const urlParams = new URLSearchParams(window.location.search);
          const roomCodeParam = urlParams.get('joinRoom');
          if (roomCodeParam) {
            window.history.replaceState({}, document.title, window.location.pathname);
            handleJoinRoom(roomCodeParam);
          } else {
            dispatch(setCurrentView('dashboard'));
          }
        } catch (err) {
          console.error('Không thể tự động khôi phục phiên đăng nhập:', err);
          dispatch(clearAuth());
          dispatch(setCurrentView('login'));
        }
      } else {
        dispatch(setCurrentView('login'));
      }
      setCheckingAuth(false);
    };
    initAuth();
  }, [dispatch]);

  // Keep axios header in sync when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const handleLoginSuccess = (userData: any, accessToken: string) => {
    dispatch(setAuth({ user: userData, accessToken }));
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomCodeParam = urlParams.get('joinRoom');
    if (roomCodeParam) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleJoinRoom(roomCodeParam);
    } else {
      dispatch(setCurrentView('dashboard'));
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout request failed, cleaning local storage.');
    }
    dispatch(clearAuth());
    delete axios.defaults.headers.common['Authorization'];
    dispatch(setCurrentView('login'));
  };

  // Keep handleLogout reference fresh for the interceptor
  const handleLogoutRef = useRef(handleLogout);
  useEffect(() => {
    handleLogoutRef.current = handleLogout;
  }, [handleLogout]);

  // Global Axios interceptor to silently refresh token on 401 errors
  useEffect(() => {
    let isRefreshing = false;
    let failedQueue: any[] = [];

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach((prom) => {
        if (error) {
          prom.reject(error);
        } else {
          prom.resolve(token);
        }
      });
      failedQueue = [];
    };

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          // Exclude auth routes to prevent infinite loops
          const url = originalRequest.url || '';
          if (
            url.includes('/api/auth/login') ||
            url.includes('/api/auth/refresh-token') ||
            url.includes('/api/auth/logout')
          ) {
            return Promise.reject(error);
          }

          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
                  originalRequest.headers.set('Authorization', `Bearer ${token}`);
                } else {
                  if (!originalRequest.headers) originalRequest.headers = {};
                  originalRequest.headers['Authorization'] = `Bearer ${token}`;
                }
                return axios(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const res = await axios.post('/api/auth/refresh-token', {}, { withCredentials: true });
            const { accessToken } = res.data;

            dispatch(setAuth({ user, accessToken }));
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            
            if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
              originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);
            } else {
              if (!originalRequest.headers) originalRequest.headers = {};
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            }

            processQueue(null, accessToken);
            return axios(originalRequest);
          } catch (refreshError) {
            processQueue(refreshError, null);
            handleLogoutRef.current();
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleJoinRoom = (roomCode: string) => {
    dispatch(startRoomLobby(roomCode));
    dispatch(setCurrentView('lobby'));
  };

  const handleStartExam = (roomId: string, quizId: string, settings: any) => {
    dispatch(startExam({ roomId, quizId, mode: 'exam', settings }));
    dispatch(setCurrentView('taker'));
  };

  const handleStartPractice = (quizId: string, mode: 'practice' | 'mock') => {
    dispatch(startExam({
      roomId: null,
      quizId,
      mode,
      settings: { antiCheatEnabled: mode === 'mock', showResultImmediately: true }
    }));
    dispatch(setCurrentView('taker'));
  };

  const handleExamFinished = async (attempt: any) => {
    if (attempt) {
      await window.showAlert(`Nộp bài thành công! Điểm của đồng chí: ${attempt.score}/${attempt.totalQuestions} (${attempt.rank})`, 'Thông báo kết quả');
    }
    dispatch(clearExam());
    dispatch(setCurrentView('dashboard'));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#070a09] flex flex-col items-center justify-center font-mono">
        <div className="w-12 h-12 border-2 border-[#e5a93b] border-t-transparent animate-spin mb-4" />
        <h2 className="text-[#e5a93b] text-xs font-bold uppercase tracking-widest animate-pulse">
          Hệ thống trắc nghiệm quân sự
        </h2>
        <span className="text-[10px] text-gray-500 uppercase mt-2">
          Đang xác thực phiên làm việc...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-vpa-sand dark:bg-vpa-dark transition-colors duration-300">
      
      {/* Unauthenticated view container */}
      {(!token || !user) ? (
        currentView === 'register' ? (
          <Register 
            onRegisterSuccess={handleLoginSuccess}
            onNavigateToLogin={() => dispatch(setCurrentView('login'))}
          />
        ) : (
          <Login 
            onLoginSuccess={handleLoginSuccess}
            onNavigateToRegister={() => dispatch(setCurrentView('register'))}
          />
        )
      ) : (
        /* Authenticated view container */
        <>
          <Navbar 
            user={user}
            onLogout={handleLogout}
            darkMode={darkMode}
            setDarkMode={(val: boolean) => dispatch(setDarkMode(val))}
            onOpenEditProfile={handleOpenEditProfile}
            onOpenChangePassword={handleOpenChangePassword}
          />
          <main className="transition-colors duration-300">
            {currentView === 'dashboard' && (
              <Dashboard 
                user={user}
                setUser={(val: any) => dispatch(updateUser(val))}
                onJoinRoom={handleJoinRoom}
                onNavigateToQuizMgmt={() => dispatch(setCurrentView('quiz-mgmt'))}
                onNavigateToUserMgmt={() => dispatch(setCurrentView('user-mgmt'))}
                onStartPractice={handleStartPractice}
              />
            )}
            {currentView === 'quiz-mgmt' && (
              <QuizManagement 
                user={user}
                onNavigateBack={() => dispatch(setCurrentView('dashboard'))}
              />
            )}
            {currentView === 'user-mgmt' && (
              <UserManagement 
                user={user}
                onNavigateBack={() => dispatch(setCurrentView('dashboard'))}
              />
            )}
            {currentView === 'lobby' && activeRoomCode && (
              <RoomLobby 
                user={user}
                roomCode={activeRoomCode}
                onLeave={() => {
                  dispatch(clearExam());
                  dispatch(setCurrentView('dashboard'));
                }}
                onExamStarted={handleStartExam}
                onNavigateToResults={(roomId) => {
                  dispatch(startExam({ roomId, quizId: '', mode: 'exam', settings: {} }));
                  dispatch(setCurrentView('results'));
                }}
              />
            )}
            {currentView === 'taker' && activeQuizId && (
              <ExamTaker 
                user={user}
                roomId={activeRoomId}
                quizId={activeQuizId}
                roomCode={activeRoomCode}
                settings={activeRoomSettings}
                mode={activeExamMode}
                onFinished={handleExamFinished}
              />
            )}
            {currentView === 'results' && activeRoomId && (
              <RoomResults 
                user={user}
                roomId={activeRoomId}
                onNavigateBack={() => {
                  dispatch(clearExam());
                  dispatch(setCurrentView('dashboard'));
                }}
              />
            )}
          </main>
        </>
      )}
      
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark border border-vpa-olive-light/35 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center rounded-none"
          title="Lên đầu trang"
        >
          <ArrowUp size={18} weight="bold" />
        </button>
      )}

      {modal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl relative animate-scale-up">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${modal.type === 'confirm' ? 'bg-vpa-gold' : 'bg-vpa-red'}`} />
            
            <div className="mt-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand flex items-center space-x-2">
                <span className={`inline-block w-2.5 h-2.5 ${modal.type === 'confirm' ? 'bg-vpa-gold' : 'bg-vpa-red'}`} />
                <span>{modal.title}</span>
              </h3>
              
              <div className="mt-4 text-xs md:text-sm text-vpa-olive-light dark:text-gray-300 leading-relaxed font-mono whitespace-pre-line border-l-2 border-vpa-olive-light/20 dark:border-vpa-gold/20 pl-3 py-1">
                {modal.message}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => modal.onCancel?.()}
                  className="px-4 py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs font-bold uppercase tracking-wider hover:bg-vpa-olive-light/10 transition-colors"
                >
                  Bỏ qua
                </button>
              )}
              <button
                onClick={() => modal.onConfirm?.()}
                className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold-bright rounded-none" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
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
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold uppercase font-mono"
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
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
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

      {/* CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none animate-fadeIn">
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-red rounded-none" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand font-mono">
                Thay đổi mật khẩu quân nhân
              </h3>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                />
              </div>

              {pwSuccess && (
                <p className="text-green-600 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 p-2 border border-green-500/20">{pwSuccess}</p>
              )}

              {pwError && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{pwError}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-none"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-none font-bold"
                >
                  {pwLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
