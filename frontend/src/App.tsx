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

export const App: React.FC = () => {
  const dispatch = useAppDispatch();

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

  // 2. Persistent authentication recovery & Header setup on mount
  useEffect(() => {
    if (token && user) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      dispatch(setCurrentView('dashboard'));
    }
  }, [token, user, dispatch]);

  const handleLoginSuccess = (userData: any, accessToken: string) => {
    dispatch(setAuth({ user: userData, accessToken }));
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    dispatch(setCurrentView('dashboard'));
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

            localStorage.setItem('accessToken', accessToken);
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
    </div>
  );
};
export default App;
