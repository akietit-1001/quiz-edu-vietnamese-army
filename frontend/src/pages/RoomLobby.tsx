import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Users, ShieldCheck, ArrowLeftIcon, WarningIcon } from '@phosphor-icons/react';
import axios from 'axios';

interface RoomLobbyProps {
  user: any;
  roomCode: string;
  onLeave: () => void;
  onExamStarted: (roomId: string, quizId: string, settings: any) => void;
  onNavigateToResults: (roomId: string) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  user,
  roomCode,
  onLeave,
  onExamStarted,
  onNavigateToResults
}) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState('waiting');
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [roomSettings, setRoomSettings] = useState<any>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hostDetails, setHostDetails] = useState<any>(null);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [userRoomRole, setUserRoomRole] = useState('examinee');
  const userRoomRoleRef = React.useRef(userRoomRole);

  useEffect(() => {
    userRoomRoleRef.current = userRoomRole;
  }, [userRoomRole]);

  // 1. Fetch Room details by code
  useEffect(() => {
    fetchRoomDetails();
  }, [roomCode]);

  const fetchRoomDetails = async () => {
    try {
      // Get Room details from backend API
      const res = await axios.get(`/api/rooms/code/${roomCode}`);
      const data = res.data;
      setQuizDetails(data.quizId);
      setRoomId(data._id);
      setRoomStatus(data.status);
      setRoomSettings(data.settings);
      setHostDetails(data.hostId);
      setStartTime(data.startTime);
      setUserRoomRole(data.userRoomRole || (data.hostId?._id === user.id ? 'host' : 'examinee'));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi lấy thông tin phòng thi.');
    }
  };

  // 2. Initialize Socket.io Connection
  useEffect(() => {
    if (!roomId) return;

    // Connect to server (point to same host or port 5000 in dev)
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Join room event
    newSocket.emit('joinRoom', {
      roomCode,
      userId: user.id,
      role: user.role
    });

    // Listeners
    newSocket.on('roomData', ({ status, participants: roomParts, startTime: roomStart }) => {
      setRoomStatus(status);
      setParticipants(roomParts);
      if (roomStart) setStartTime(roomStart);
    });

    newSocket.on('examStarted', () => {
      // Only redirect participants to exam taker, host & examiner stay in lobby to monitor
      const currentRole = userRoomRoleRef.current;
      if (currentRole !== 'host' && currentRole !== 'examiner') {
        onExamStarted(roomId, quizDetails._id, roomSettings);
      }
    });

    newSocket.on('cheatNotification', ({ userId, message, violationCount }) => {
      // Update the participant's violation count and alert
      setParticipants(prev => prev.map(p => {
        if (p.userId._id === userId) {
          return {
            ...p,
            violationCount: violationCount,
            cheatingAlert: message
          };
        }
        return p;
      }));

      // Only show popup alert to host or examiner (supervisors)
      const currentRole = userRoomRoleRef.current;
      if (currentRole === 'host' || currentRole === 'examiner') {
        window.showAlert?.(message, 'CẢNH BÁO GIÁM SÁT');
      }
    });

    newSocket.on('userFinished', ({ userId, score, totalQuestions }) => {
      // Update participant's status to finished in local list
      setParticipants(prev => prev.map(p => {
        if (p.userId._id === userId) {
          return {
            ...p,
            status: 'finished',
            score: score,
            totalQuestions: totalQuestions
          };
        }
        return p;
      }));
    });

    newSocket.on('error', (errMsg) => {
      setError(errMsg);
    });

    return () => {
      newSocket.emit('leaveRoom', { roomCode, userId: user.id });
      newSocket.disconnect();
    };
  }, [roomId, hostDetails]);

  // Host starts the exam room
  const handleStartExam = () => {
    if (socket) {
      socket.emit('startExam', { roomCode });
    }
  };

  const isHost = hostDetails && hostDetails._id === user.id;

  const handleEndExam = async (isAuto = false) => {
    try {
      if (!isAuto) {
        const confirmEnd = await window.showConfirm?.(
          'Đồng chí có chắc chắn muốn kết thúc cuộc thi và đóng phòng thi này sớm không? Hành động này sẽ khóa bài thi của tất cả học viên.',
          'KẾT THÚC CUỘC THI'
        );
        if (confirmEnd === false) return;
      }

      await axios.put(`/api/rooms/${roomId}/end`);
      setRoomStatus('finished');
      if (isAuto) {
        await window.showAlert?.('Thời gian làm bài đã hết! Hệ thống đã tự động đóng phòng thi.', 'HẾT GIỜ');
      } else {
        window.showAlert?.('Đã kết thúc cuộc thi và đóng phòng thi thành công!', 'THÔNG BÁO');
      }
      onNavigateToResults(roomId);
    } catch (err) {
      console.error('Lỗi kết thúc phòng thi:', err);
      setError('Lỗi khi đóng phòng thi.');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Countdown timer for active exam
  useEffect(() => {
    if (roomStatus !== 'active' || !startTime || !quizDetails) return;

    const calculateTimeLeft = () => {
      const start = new Date(startTime).getTime();
      const durationMs = (quizDetails.duration || 45) * 60 * 1000;
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
      setTimeLeft(remaining);

      // If time runs out and user is host, automatically end the room
      if (remaining === 0 && isHost) {
        handleEndExam(true);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [roomStatus, startTime, quizDetails, isHost]);

  const examinees = participants.filter(p => p.role !== 'examiner');
  const examiners = participants.filter(p => p.role === 'examiner');

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onLeave}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              HÀNG CHỜ PHÒNG THI: <span className="font-mono text-vpa-gold font-extrabold">{roomCode}</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Đề thi: {quizDetails?.title} | Thời gian: {quizDetails?.duration} phút
            </p>
          </div>
        </div>

        {isHost && roomStatus === 'waiting' && (
          <button
            onClick={handleStartExam}
            disabled={examinees.length === 0}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs font-bold uppercase tracking-wider flex items-center space-x-2 disabled:opacity-50"
          >
            <Play size={16} />
            <span>Khai mạc cuộc thi (Bắt đầu)</span>
          </button>
        )}

        {isHost && roomStatus === 'active' && (
          <button
            onClick={() => handleEndExam(false)}
            className="px-4 py-2 bg-vpa-red hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 rounded-none"
          >
            <WarningIcon size={16} />
            <span>Kết thúc cuộc thi (Đóng phòng)</span>
          </button>
        )}

        {(isHost || userRoomRole === 'examiner') && roomStatus === 'finished' && (
          <button
            onClick={() => onNavigateToResults(roomId)}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs font-bold uppercase tracking-wider"
          >
            Xem kết quả thi
          </button>
        )}
      </div>

      {error ? (
        <div className="p-4 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs flex items-center space-x-2">
          <WarningIcon size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Information & Controls */}
          <div className="space-y-6">
            
            {/* Room Info */}
            <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
              <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-4 pb-2 border-b border-vpa-olive-light/20">
                Thông tin phòng thi
              </h3>
              
              <ul className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
                <li><span className="font-semibold text-gray-500">Chỉ huy phòng:</span>  {hostDetails?.rank} {hostDetails?.fullName} </li>
                <li><span className="font-semibold text-gray-500">Đơn vị host:</span> {hostDetails?.unit}</li>
                <li><span className="font-semibold text-gray-500">Trạng thái:</span> {roomStatus === 'waiting' ? 'Đang chờ thí sinh...' : roomStatus === 'active' ? 'Đang diễn ra thi...' : 'Đã kết thúc thi'}</li>
                {roomStatus === 'active' && timeLeft !== null && (
                  <li className="flex items-center space-x-2 text-vpa-red dark:text-vpa-gold font-bold">
                    <span className="font-semibold text-gray-500">Thời gian còn lại:</span>
                    <span className="font-mono text-sm">{formatTime(timeLeft)}</span>
                  </li>
                )}
                <li><span className="font-semibold text-gray-500">Chống gian lận:</span> {roomSettings.antiCheatEnabled ? 'ĐANG KÍCH HOẠT' : 'TẮT'}</li>
                <li><span className="font-semibold text-gray-500">Xem kết quả ngay:</span> {roomSettings.showResultImmediately ? 'ĐANG KÍCH HOẠT' : 'TẮT'}</li>
              </ul>
            </div>

            {/* Waiting Notice */}
            <div className="border border-vpa-olive-light/50 bg-vpa-olive/5 dark:bg-vpa-gold/5 p-6 rounded-none">
              <p className="text-xs text-vpa-olive dark:text-vpa-gold-bright font-bold uppercase tracking-wider leading-relaxed text-center animate-pulse-slow">
                {roomStatus === 'waiting' 
                  ? 'Đang chờ chỉ huy mở đề thi...' 
                  : roomStatus === 'active'
                  ? 'Cuộc thi đang diễn ra. Chỉ huy phòng đang giám sát trực tuyến...'
                  : 'Cuộc thi đã kết thúc. Chỉ huy phòng đang kết xuất báo cáo kết quả.'}
              </p>
            </div>

          </div>

          {/* Right Panel: Active Participants split into two halves */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Half: Examinees */}
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
                <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-6 pb-2 border-b border-vpa-olive-light/20 flex items-center space-x-2">
                  <Users size={18} className="text-vpa-olive dark:text-vpa-gold-bright" />
                  <span>Danh sách thí sinh ({examinees.length})</span>
                </h3>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {examinees.map(part => (
                    <div
                      key={part.userId._id}
                      className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-vpa-olive/10 dark:bg-vpa-gold/10 border border-vpa-olive-light/30 flex items-center justify-center text-[10px] font-bold text-vpa-olive dark:text-vpa-gold font-mono uppercase rounded-none">
                          {part.userId.fullName.substring(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand">
                            {part.userId.rank ? `${part.userId.rank} ` : ''}{part.userId.fullName}
                          </h4>
                          <p className="text-[9px] text-gray-500 uppercase">
                            {part.userId.position || 'N/A'} | {part.userId.unit}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[8px] font-mono px-2 py-0.5 border ${
                        part.status === 'finished' 
                          ? 'border-green-500 bg-green-500/10 text-green-600'
                          : part.status === 'taking'
                          ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600'
                          : part.status === 'left'
                          ? 'border-red-500 bg-red-500/10 text-red-600 font-bold'
                          : 'border-vpa-olive-light text-gray-500 bg-vpa-olive/5'
                      }`}>
                        {part.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {examinees.length === 0 && (
                    <p className="text-center py-8 text-gray-400 text-xs font-mono">Chưa có thí sinh nào kết nối.</p>
                  )}
                </div>
              </div>

              {/* Right Half: Examiners */}
              <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
                <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-6 pb-2 border-b border-vpa-olive-light/20 flex items-center space-x-2">
                  <ShieldCheck size={18} className="text-vpa-olive dark:text-vpa-gold-bright" />
                  <span>Ban giám khảo ({examiners.length})</span>
                </h3>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {examiners.map(part => (
                    <div
                      key={part.userId._id}
                      className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-3 flex items-center justify-between border-l-2 border-l-vpa-red"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-vpa-red/10 border border-vpa-red/30 flex items-center justify-center text-[10px] font-bold text-vpa-red font-mono uppercase rounded-none">
                          {part.userId.fullName.substring(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase text-vpa-olive dark:text-vpa-sand">
                            {part.userId.rank ? `${part.userId.rank} ` : ''}{part.userId.fullName}
                          </h4>
                          <p className="text-[9px] text-gray-500 uppercase">
                            {part.userId.position || 'N/A'} | {part.userId.unit}
                          </p>
                        </div>
                      </div>

                      <span className="text-[8px] font-mono px-2 py-0.5 border border-green-500 bg-green-500/10 text-green-600">
                        ONLINE
                      </span>
                    </div>
                  ))}
                  {examiners.length === 0 && (
                    <p className="text-center py-8 text-gray-400 text-xs font-mono">Chưa có giám khảo nào kết nối.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RoomLobby;
