import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Play, Users, Warning } from '@phosphor-icons/react';

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
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState('waiting');
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [roomId, setRoomId] = useState('');
  const [roomSettings, setRoomSettings] = useState<any>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hostDetails, setHostDetails] = useState<any>(null);
  const [error, setError] = useState('');

  // 1. Fetch Room details by code
  useEffect(() => {
    fetchRoomDetails();
  }, [roomCode]);

  const fetchRoomDetails = async () => {
    try {
      // Get Room details from backend API
      const res = await fetch(`/api/rooms/code/${roomCode}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setQuizDetails(data.quizId);
        setRoomId(data._id);
        setRoomStatus(data.status);
        setRoomSettings(data.settings);
        setHostDetails(data.hostId);
      } else {
        setError(data.message || 'Lỗi lấy thông tin phòng thi.');
      }
    } catch (err) {
      setError('Lỗi kết nối phòng thi.');
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
    newSocket.on('roomData', ({ status, participants: roomParts }) => {
      setRoomStatus(status);
      setParticipants(roomParts);
    });

    newSocket.on('examStarted', () => {
      // Trigger exam taker callback
      onExamStarted(roomId, quizDetails._id, roomSettings);
    });

    newSocket.on('error', (errMsg) => {
      setError(errMsg);
    });

    return () => {
      newSocket.emit('leaveRoom', { roomCode, userId: user.id });
      newSocket.disconnect();
    };
  }, [roomId]);

  // Host starts the exam room
  const handleStartExam = () => {
    if (socket) {
      socket.emit('startExam', { roomCode });
    }
  };

  const isHost = hostDetails && hostDetails._id === user.id;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onLeave}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
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
            disabled={participants.length === 0}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-xs font-bold uppercase tracking-wider flex items-center space-x-2 disabled:opacity-50"
          >
            <Play size={16} />
            <span>Khai mạc cuộc thi (Bắt đầu)</span>
          </button>
        )}

        {isHost && roomStatus === 'finished' && (
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
          <Warning size={20} />
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
                <li><span className="font-semibold text-gray-500">Chỉ huy phòng:</span> {hostDetails?.fullName} ({hostDetails?.rank})</li>
                <li><span className="font-semibold text-gray-500">Đơn vị host:</span> {hostDetails?.unit}</li>
                <li><span className="font-semibold text-gray-500">Trạng thái:</span> {
                  roomStatus === 'waiting' ? 'Đang chờ thí sinh...' : 
                  roomStatus === 'active' ? 'Đang diễn ra thi...' : 'Đã kết thúc thi'
                }</li>
                <li><span className="font-semibold text-gray-500">Chống gian lận:</span> {roomSettings.antiCheatEnabled ? 'ĐANG KÍCH HOẠT' : 'TẮT'}</li>
                <li><span className="font-semibold text-gray-500">Xem kết quả ngay:</span> {roomSettings.showResultImmediately ? 'ĐANG KÍCH HOẠT' : 'TẮT'}</li>
              </ul>
            </div>

            {/* Waiting Notice */}
            <div className="border border-vpa-olive-light/50 bg-vpa-olive/5 dark:bg-vpa-gold/5 p-6 rounded-none">
              <p className="text-xs text-vpa-olive dark:text-vpa-gold-bright font-bold uppercase tracking-wider leading-relaxed text-center animate-pulse-slow">
                {roomStatus === 'waiting' 
                  ? t('waiting_host') 
                  : 'Cuộc thi đã kết thúc. Chỉ huy phòng đang kết xuất báo cáo kết quả.'}
              </p>
            </div>

          </div>

          {/* Right Panel: Active Participants Grid */}
          <div className="lg:col-span-2 border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-md rounded-none">
            <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-6 pb-2 border-b border-vpa-olive-light/20 flex items-center space-x-2">
              <Users size={18} />
              <span>Quân số có mặt ({participants.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {participants.map(part => (
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
                        {part.userId.fullName}
                      </h4>
                      <p className="text-[9px] text-gray-500 uppercase">
                        {part.userId.rank} | {part.userId.unit}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[8px] font-mono px-2 py-0.5 border ${
                    part.status === 'finished' 
                      ? 'border-green-500 bg-green-500/10 text-green-600'
                      : part.status === 'taking'
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600'
                      : part.status === 'left'
                      ? 'border-red-500 bg-red-500/10 text-red-600'
                      : 'border-vpa-olive-light text-gray-500'
                  }`}>
                    {part.status.toUpperCase()}
                  </span>
                </div>
              ))}
              {participants.length === 0 && (
                <p className="col-span-2 text-center py-12 text-gray-400 text-xs">Chưa có quân nhân nào kết nối vào hàng chờ.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RoomLobby;
