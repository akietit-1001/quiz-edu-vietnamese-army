import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { Hourglass, ShieldWarning } from '@phosphor-icons/react';

interface ExamTakerProps {
  user: any;
  roomId: string | null; // null if practice/mock mode
  quizId: string;
  roomCode: string | null;
  settings: any;
  mode: 'exam' | 'practice' | 'mock';
  onFinished: (attempt: any) => void;
}

export const ExamTaker: React.FC<ExamTakerProps> = ({
  user,
  roomId,
  quizId,
  roomCode,
  settings,
  mode,
  onFinished
}) => {

  const [quiz, setQuiz] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]); // Array of { questionIndex, selectedAnswers: string[] }
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [violations, setViolations] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Đang chuẩn bị đề thi...');
  const [error, setError] = useState('');

  // Refs for tracking mutable states inside listeners
  const violationsRef = useRef(0);
  const isSubmittingRef = useRef(false);

  // 1. Fetch Quiz Data and Initialize Answers (Offline Recovery check)
  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      const res = await axios.get(`/api/quizzes/${quizId}`);
      setQuiz(res.data);
      setTimeLeft(res.data.duration * 60);

      // Check offline recovery from localStorage
      const cached = localStorage.getItem(`quiz-attempt-${quizId}`);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setAnswers(cachedData.answers);
          setViolations(cachedData.violations);
          violationsRef.current = cachedData.violations;
          if (cachedData.timeLeft) setTimeLeft(cachedData.timeLeft);
        } catch (e) {
          initializeEmptyAnswers(res.data.questions);
        }
      } else {
        initializeEmptyAnswers(res.data.questions);
      }
      setLoading(false);
    } catch (err) {
      setError('Không thể tải đề thi quân sự.');
      setLoading(false);
    }
  };

  const initializeEmptyAnswers = (questionsList: any[]) => {
    const empty = questionsList.map((_, idx) => ({
      questionIndex: idx,
      selectedAnswers: []
    }));
    setAnswers(empty);
  };

  // 2. Offline Auto-Save every 5 seconds
  useEffect(() => {
    if (loading || !quiz || mode === 'practice') return;
    const interval = setInterval(() => {
      localStorage.setItem(`quiz-attempt-${quizId}`, JSON.stringify({
        answers,
        violations,
        timeLeft
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [answers, violations, timeLeft, loading, quiz, mode]);

  // 3. Socket.io integration for real-time monitoring
  useEffect(() => {
    if (!roomCode || mode !== 'exam') return;
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode]);

  // 4. Timer Tick Down
  useEffect(() => {
    if (mode === 'practice') return;
    if (timeLeft <= 0 && !loading && quiz) {
      handleAutoSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, quiz, mode]);

  // 5. Anti-cheat Monitor: tab switch & fullscreen locking
  useEffect(() => {
    if (loading || !quiz || mode !== 'exam' || !settings.antiCheatEnabled) return;

    // Enforce fullscreen on startup
    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.error('Fullscreen blocked');
      }
    };
    requestFullscreen();

    // Tab-switching detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation();
      }
    };

    // Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      // Exit fullscreen when finished
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.error(err));
      }
    };
  }, [loading, quiz, mode]);

  const handleViolation = async () => {
    const count = violationsRef.current + 1;
    setViolations(count);
    violationsRef.current = count;

    // Notify host via Socket
    if (socket && roomCode) {
      socket.emit('cheatAlert', { roomCode, userId: user.id, violationCount: count });
    }

    await window.showAlert(`CẢNH BÁO: ĐỒNG CHÍ ĐÃ VI PHẠM NỘI QUY PHÒNG THI (${count} lần). Tránh chuyển đổi tab hoặc rời toàn màn hình!`, 'Cảnh báo vi phạm');

    // Automatic submission if violation exceeds 3
    if (count >= 3) {
      await window.showAlert('Đồng chí vi phạm quá 3 lần! Hệ thống tự động khóa bài thi.', 'Khóa bài thi');
      handleAutoSubmit();
    }
  };

  const handleSelectAnswer = (ansVal: string) => {
    const updated = [...answers];
    const q = quiz.questions[currentIdx];

    if (q.questionType === 'multiple-choice') {
      // Toggle for multi-choice (or single answer only)
      updated[currentIdx].selectedAnswers = [ansVal];
    } else if (q.questionType === 'true-false') {
      updated[currentIdx].selectedAnswers = [ansVal];
    }
    setAnswers(updated);
  };

  const handleFillInChange = (val: string) => {
    const updated = [...answers];
    updated[currentIdx].selectedAnswers = [val];
    setAnswers(updated);
  };

  const handleAutoSubmit = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    submitExamResults();
  };

  const handleSubmitClick = async () => {
    const confirmSubmit = await window.showConfirm('Đồng chí có chắc chắn muốn nộp bài thi?', 'Xác nhận nộp bài');
    if (!confirmSubmit) return;
    submitExamResults();
  };

  const handleExitPractice = async () => {
    const confirmExit = await window.showConfirm('Đồng chí có chắc chắn muốn thoát ôn luyện?', 'Thoát ôn luyện');
    if (confirmExit) {
      onFinished(null);
    }
  };

  const submitExamResults = async () => {
    setLoadingMessage('Hệ thống đang chấm điểm bài thi của đồng chí...');
    setLoading(true);
    try {
      const response = await axios.post('/api/rooms/submit', {
        roomId,
        quizId,
        answers,
        mode,
        antiCheatViolations: violations
      });

      const { jobId, attempt } = response.data;

      // In case it wasn't queued (e.g. practice mode fallback or direct response)
      if (attempt) {
        localStorage.removeItem(`quiz-attempt-${quizId}`);
        if (socket && roomCode) {
          socket.emit('submitExamFinished', {
            roomCode,
            userId: user.id,
            score: attempt.score,
            totalQuestions: attempt.totalQuestions
          });
        }
        onFinished(attempt);
        return;
      }

      // If queued, poll the status endpoint
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/rooms/submit-status/${jobId}`);
          const { status, attempt: finalAttempt, message: statusMsg } = statusRes.data;

          if (statusMsg) {
            setLoadingMessage(statusMsg);
          }

          if (status === 'completed') {
            clearInterval(pollInterval);
            localStorage.removeItem(`quiz-attempt-${quizId}`);
            
            if (socket && roomCode) {
              socket.emit('submitExamFinished', {
                roomCode,
                userId: user.id,
                score: finalAttempt.score,
                totalQuestions: finalAttempt.totalQuestions
              });
            }

            onFinished(finalAttempt);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            await window.showAlert(statusMsg || 'Nộp bài thi thất bại. Vui lòng liên hệ giám thị.', 'Lỗi nộp bài');
            setLoading(false);
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          const errMsg = pollErr.response?.data?.message || 'Lỗi kiểm tra tiến trình nộp bài thi.';
          await window.showAlert(errMsg, 'Lỗi nộp bài');
          setLoading(false);
        }
      }, 1000);

    } catch (err: any) {
      await window.showAlert(err.response?.data?.message || 'Có lỗi xảy ra khi nộp bài.', 'Lỗi nộp bài');
      setLoading(false);
    }
  };

  // Timer format Helper
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center font-mono">
        <div className="w-10 h-10 border-2 border-vpa-gold border-t-transparent animate-spin mb-4" />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">
          {loadingMessage}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs">
        {error}
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIdx];
  const userSelection = answers[currentIdx]?.selectedAnswers[0] || '';

  return (
    <div className="min-h-[100dvh] bg-vpa-sand dark:bg-vpa-dark text-vpa-olive dark:text-vpa-sand py-8 px-6 transition-colors duration-300 relative">
      
      {/* Top Banner Control Panel */}
      <div className="max-w-4xl mx-auto flex items-center justify-between border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-4 mb-6 shadow-md">
        <div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light text-vpa-gold mr-2">
            {mode === 'practice' ? 'ÔN LUYỆN' : mode.toUpperCase()}
          </span>
          <span className="text-xs font-extrabold uppercase">{quiz.title}</span>
        </div>

        {/* Timer Block */}
        {mode !== 'practice' ? (
          <div className="flex items-center space-x-2 text-vpa-olive dark:text-vpa-gold font-mono text-sm font-extrabold">
            <Hourglass size={18} className="animate-spin" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        ) : (
          <div className="text-[10px] uppercase font-mono px-2 py-0.5 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            Không giới hạn thời gian
          </div>
        )}
      </div>

      {mode === 'exam' && settings.antiCheatEnabled && (
        <div className="max-w-4xl mx-auto p-3 bg-vpa-red/10 border-l-4 border-vpa-red text-[10px] uppercase tracking-wider font-bold mb-6 flex items-center space-x-2">
          <ShieldWarning size={16} />
          <span>Bảo mật chống gian lận đang giám sát. Vi phạm chuyển tab: {violations}/3</span>
        </div>
      )}

      {/* Main content split */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Question Sheet Panel */}
        <div className="lg:col-span-3 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md flex flex-col justify-between min-h-[300px]">
          <div>
            <span className="text-[10px] font-mono text-vpa-gold uppercase font-bold tracking-wider">
              Câu hỏi {currentIdx + 1} / {quiz.questions.length}
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wide mt-2 mb-6">
              {currentQuestion.questionText}
            </h2>

            {/* Answer Options renders */}
            {currentQuestion.questionType === 'multiple-choice' && (
              <div className="space-y-3">
                {currentQuestion.options.map((opt: string, oIdx: number) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isSelected = userSelection === oIdx.toString();
                  const isCorrect = currentQuestion.correctAnswers.includes(oIdx.toString());

                  if (mode === 'practice') {
                    return (
                      <div
                        key={oIdx}
                        className={`w-full text-left p-3 border text-xs flex items-center justify-between transition-colors ${
                          isCorrect 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold shadow-sm' 
                            : 'border-vpa-olive-light/20 opacity-70'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`w-6 h-6 border flex items-center justify-center font-bold text-[10px] ${
                            isCorrect ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-vpa-olive-light/30 text-gray-500'
                          }`}>
                            {letter}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {isCorrect && (
                          <span className="text-[9px] uppercase font-mono px-2.5 py-0.5 bg-emerald-500 text-white dark:text-vpa-dark font-extrabold select-none flex items-center">
                            Đáp án đúng
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectAnswer(oIdx.toString())}
                      className={`w-full text-left p-3 border text-xs flex items-center space-x-3 transition-colors ${
                        isSelected 
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent font-bold' 
                          : 'border-vpa-olive-light/30 hover:border-vpa-gold'
                      }`}
                    >
                      <span className={`w-6 h-6 border flex items-center justify-center font-bold text-[10px] ${
                        isSelected ? 'border-white text-white' : 'border-vpa-olive-light/50 text-gray-500'
                      }`}>
                        {letter}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.questionType === 'true-false' && (
              <div className="flex space-x-6">
                {mode === 'practice' ? (
                  <>
                    <div
                      className={`w-1/2 py-3 border text-xs uppercase font-bold tracking-wider text-center flex flex-col items-center justify-center min-h-[56px] ${
                        currentQuestion.correctAnswers[0] === '0'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'border-vpa-olive-light/20 opacity-70'
                      }`}
                    >
                      <span>Đúng</span>
                      {currentQuestion.correctAnswers[0] === '0' && (
                        <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500 text-white dark:text-vpa-dark font-extrabold mt-1 select-none">
                          Đáp án đúng
                        </span>
                      )}
                    </div>
                    <div
                      className={`w-1/2 py-3 border text-xs uppercase font-bold tracking-wider text-center flex flex-col items-center justify-center min-h-[56px] ${
                        currentQuestion.correctAnswers[0] === '1'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'border-vpa-olive-light/20 opacity-70'
                      }`}
                    >
                      <span>Sai</span>
                      {currentQuestion.correctAnswers[0] === '1' && (
                        <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500 text-white dark:text-vpa-dark font-extrabold mt-1 select-none">
                          Đáp án đúng
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSelectAnswer('0')}
                      className={`w-1/2 py-3 border text-xs uppercase font-bold tracking-wider transition-colors ${
                        userSelection === '0'
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light/30 hover:border-vpa-gold'
                      }`}
                    >
                      Đúng
                    </button>
                    <button
                      onClick={() => handleSelectAnswer('1')}
                      className={`w-1/2 py-3 border text-xs uppercase font-bold tracking-wider transition-colors ${
                        userSelection === '1'
                          ? 'bg-vpa-olive text-white dark:bg-vpa-gold dark:text-vpa-dark border-transparent'
                          : 'border-vpa-olive-light/30 hover:border-vpa-gold'
                      }`}
                    >
                      Sai
                    </button>
                  </>
                )}
              </div>
            )}

            {currentQuestion.questionType === 'fill-in-the-blank' && (
              <div>
                {mode === 'practice' ? (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 font-bold">Đáp án đúng của câu hỏi</label>
                    <input
                      type="text"
                      disabled
                      value={currentQuestion.correctAnswers[0]}
                      className="w-full text-xs p-2.5 bg-emerald-500/5 border border-emerald-500 text-emerald-700 dark:text-emerald-400 font-extrabold focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1">Nhập đáp án của đồng chí</label>
                    <input
                      type="text"
                      value={userSelection}
                      onChange={e => handleFillInChange(e.target.value)}
                      placeholder="Đáp án..."
                      className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light focus:outline-none focus:border-vpa-gold"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Explanation review in Practice Mode */}
            {mode === 'practice' && currentQuestion.explanation && (
              <div className="mt-6 p-4 bg-vpa-olive/5 dark:bg-vpa-gold/5 border-l-2 border-vpa-olive dark:border-vpa-gold text-xs">
                <span className="font-extrabold uppercase text-vpa-olive dark:text-vpa-gold block mb-1">Giải thích đáp án:</span>
                <p className="text-gray-600 dark:text-gray-300 italic">{currentQuestion.explanation}</p>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex justify-between items-center border-t border-vpa-olive-light/20 pt-6 mt-8">
            <button
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-3 py-1.5 border border-vpa-olive-light/50 text-xs font-bold uppercase disabled:opacity-50"
            >
              Câu trước
            </button>
            <button
              onClick={() => setCurrentIdx(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              disabled={currentIdx === quiz.questions.length - 1}
              className="px-3 py-1.5 border border-vpa-olive-light/50 text-xs font-bold uppercase disabled:opacity-50"
            >
              Câu sau
            </button>
          </div>
        </div>

        {/* Right Side: Map Grid Selection Panel */}
        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider border-b border-vpa-olive-light/30 pb-2 mb-4">
              Mạng sa bàn câu hỏi
            </h3>
            <div className="grid grid-cols-5 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {quiz.questions.map((_: any, idx: number) => {
                const hasAnswer = answers[idx]?.selectedAnswers.length > 0 && answers[idx]?.selectedAnswers[0] !== '';
                const isActive = idx === currentIdx;

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-8 border flex items-center justify-center font-mono text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-vpa-gold text-vpa-dark border-transparent scale-105' 
                        : (mode === 'practice' || hasAnswer)
                        ? 'bg-vpa-olive/20 dark:bg-vpa-gold/20 border-vpa-olive dark:border-vpa-gold text-vpa-olive dark:text-vpa-gold-bright'
                        : 'border-vpa-olive-light/30 hover:border-vpa-gold'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'practice' ? (
            <button
              onClick={handleExitPractice}
              className="w-full mt-6 py-2.5 bg-vpa-red hover:bg-vpa-red/80 text-white text-xs uppercase tracking-wider font-extrabold transition-colors"
            >
              Thoát ôn luyện
            </button>
          ) : (
            <button
              onClick={handleSubmitClick}
              className="w-full mt-6 py-2.5 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark text-xs uppercase tracking-wider font-extrabold"
            >
              Nộp bài & Kết thúc
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
export default ExamTaker;
