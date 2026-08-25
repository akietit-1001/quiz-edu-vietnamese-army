import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, MagnifyingGlass, Users, UserPlus, Trash, MorphIcon, EyeData, SignInData } from '../icons';
import { Select } from '../components/Select';
import { Pagination } from '../components/Pagination';
import { Tooltip } from '../components/Tooltip';
import { InviteToRoomModal } from '../components/InviteToRoomModal';

interface RoomManagementProps {
  user: any;
  onNavigateBack: () => void;
  onJoinRoom: (roomCode: string) => void;
  onViewResults: (roomId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'ĐANG CHỜ THI',
  active: 'ĐANG THI',
  finished: 'ĐÃ KẾT THÚC'
};

export const RoomManagement: React.FC<RoomManagementProps> = ({ user, onNavigateBack, onJoinRoom, onViewResults }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'waiting' | 'active' | 'finished'>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/rooms');
      setRooms(response.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách phòng thi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const filteredRooms = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rooms.filter(room => {
      const matchStatus = !statusFilter || room.status === statusFilter;
      const matchTerm = term === ''
        || room.roomCode?.toLowerCase().includes(term)
        || (room.quizId?.title || '').toLowerCase().includes(term);
      return matchStatus && matchTerm;
    });
  }, [rooms, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredRooms.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const displayedRooms = filteredRooms.slice(startIndex, startIndex + pageSize);

  const handleOpenInvite = (roomCode: string) => {
    setInviteRoomCode(roomCode);
    setShowInviteModal(true);
  };

  const handleDeleteRoom = async (room: any) => {
    const confirmDelete = await window.showConfirm?.(
      `Đồng chí có chắc chắn muốn xóa phòng thi ${room.roomCode} không? Mọi lời mời liên quan cũng sẽ bị xóa bỏ.`,
      'XÓA PHÒNG THI'
    );
    if (confirmDelete === false) return;

    try {
      await axios.delete(`/api/rooms/${room._id}`);
      setRooms(prev => prev.filter(r => r._id !== room._id));
    } catch (err: any) {
      await window.showAlert?.(err.response?.data?.message || 'Lỗi khi xóa phòng thi.', 'Lỗi xóa phòng thi');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Navigation */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand flex items-center space-x-2">
              <Users size={20} className="text-vpa-olive dark:text-vpa-gold-bright" />
              <span>Quản lý phòng thi</span>
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Toàn bộ phòng thi đã tạo — đang chờ thi, đang thi và đã kết thúc
            </p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card mb-6 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4 md:items-center">
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder="Tìm theo mã phòng hoặc tên đề thi..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs p-2.5 pl-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
            />
            <MagnifyingGlass size={16} className="absolute left-3 top-3 text-gray-400" />
          </div>

          <Select
            value={statusFilter}
            onChange={v => setStatusFilter(v as typeof statusFilter)}
            className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="waiting">Đang chờ thi</option>
            <option value="active">Đang thi</option>
            <option value="finished">Đã kết thúc</option>
          </Select>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                <th className="py-3 px-4 whitespace-nowrap">Mã phòng</th>
                <th className="py-3 px-4">Đề thi</th>
                <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-4 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-4 whitespace-nowrap">Quân số tham gia</th>
                <th className="py-3 px-4 whitespace-nowrap">Ngày tạo</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 font-mono text-xs">
                    Đang tải danh sách phòng thi...
                  </td>
                </tr>
              )}

              {!loading && displayedRooms.map(room => (
                <tr
                  key={room._id}
                  className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5 dark:hover:bg-vpa-gold/5 transition-colors align-top"
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs font-mono font-bold tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold dark:text-vpa-dark px-2 py-0.5">
                      {room.roomCode}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <Tooltip content={room.quizId?.title || 'Đề thi trắc nghiệm'} className="block">
                      <span className="text-vpa-olive dark:text-vpa-sand font-semibold truncate block">
                        {room.quizId?.title || 'Đề thi trắc nghiệm'}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`text-[8px] font-mono px-2 py-0.5 border ${
                      room.status === 'active'
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-600'
                        : room.status === 'finished'
                        ? 'border-red-500 bg-red-500/10 text-red-600 font-bold'
                        : 'border-vpa-olive-light text-gray-500 bg-vpa-olive/5'
                    }`}>
                      {STATUS_LABEL[room.status] || room.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono">
                    {room.quizId?.duration || 45} phút
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono">
                    {room.participants?.filter((p: any) => p.status !== 'left').length || 0}
                    {room.settings?.maxParticipants ? ` / ${room.settings.maxParticipants}` : ''}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono">
                    {room.createdAt ? new Date(room.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      {room.status !== 'finished' && (
                        <button
                          onClick={() => handleOpenInvite(room.roomCode)}
                          className="px-3 py-1.5 border border-vpa-olive-light/60 hover:border-vpa-gold text-vpa-olive dark:text-vpa-sand text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center space-x-1 whitespace-nowrap"
                        >
                          <UserPlus size={12} />
                          <span>Mời</span>
                        </button>
                      )}
                      <button
                        onClick={() => room.status === 'finished' ? onViewResults(room._id) : onJoinRoom(room.roomCode)}
                        className="px-3 py-1.5 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-[10px] uppercase font-bold tracking-wider hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors flex items-center space-x-1 whitespace-nowrap"
                      >
                        <MorphIcon icon={room.status === 'finished' ? EyeData : SignInData} size={12} />
                        <span>{room.status === 'finished' ? 'Kết quả' : 'Vào phòng'}</span>
                      </button>
                      {room.status === 'waiting' && (
                        <button
                          onClick={() => handleDeleteRoom(room)}
                          className="p-1.5 border border-vpa-red/30 hover:bg-vpa-red text-vpa-red hover:text-white rounded-lg transition-colors flex items-center justify-center"
                          title="Xóa phòng thi"
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && displayedRooms.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 font-mono text-xs">
                    {rooms.length === 0 ? 'Chưa khởi tạo phòng thi nào' : 'Không tìm thấy phòng thi phù hợp'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={filteredRooms.length}
            pageSize={pageSize}
            onPageChange={setPage}
            itemLabel="phòng thi"
          />
        </div>
      </div>

      <InviteToRoomModal
        isOpen={showInviteModal}
        roomCode={inviteRoomCode}
        user={user}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
};

export default RoomManagement;
