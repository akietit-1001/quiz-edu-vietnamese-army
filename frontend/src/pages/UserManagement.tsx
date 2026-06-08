import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Trash, PencilSimple, UserPlus, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';

interface UserManagementProps {
  user: any;
  onNavigateBack: () => void;
}

const RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá', 'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'];
const POSITIONS = ['Chiến sĩ', 'Tiểu đội trưởng', 'Trung đội phó', 'Trung đội trưởng', 'Đại đội phó', 'Đại đội trưởng', 'Tiểu đoàn phó', 'Tiểu đoàn trưởng', 'Chính trị viên', 'Học viên', 'Giảng viên', 'Khác'];

export const UserManagement: React.FC<UserManagementProps> = ({ user, onNavigateBack }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering/Searching
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [rank, setRank] = useState('Binh nhì');
  const [position, setPosition] = useState('Chiến sĩ');
  const [unit, setUnit] = useState(user?.unit || '');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('user');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, rankFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users');
      setUsers(res.data);
      setLoading(false);
    } catch (err: any) {
      setError('Không thể tải danh sách quân nhân.');
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setSelectedUserId(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setDateOfBirth('');
    setRank('Binh nhì');
    setPosition('Chiến sĩ');
    setUnit(user?.role === 'master-admin' ? '' : user?.unit || '');
    setAddress('');
    setRole('user');
    setError('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (targetUser: any) => {
    setIsEditing(true);
    setSelectedUserId(targetUser._id);
    setEmail(targetUser.email);
    setPassword(''); // Don't show password
    setFullName(targetUser.fullName);
    setDateOfBirth(targetUser.dateOfBirth ? new Date(targetUser.dateOfBirth).toISOString().split('T')[0] : '');
    setRank(targetUser.rank || 'Binh nhì');
    setPosition(targetUser.position || 'Chiến sĩ');
    setUnit(targetUser.unit || '');
    setAddress(targetUser.address || '');
    setRole(targetUser.role || 'user');
    setError('');
    setSuccessMsg('');
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const payload: any = {
      fullName,
      dateOfBirth,
      rank,
      position,
      unit,
      address,
      role
    };

    if (!isEditing) {
      payload.email = email;
      payload.password = password;
      if (!email || !password || !fullName || !unit) {
        setError('Vui lòng điền đầy đủ các thông tin bắt buộc (Email, Mật khẩu, Họ tên, Đơn vị)');
        return;
      }
    } else {
      if (!fullName || !unit) {
        setError('Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, Đơn vị)');
        return;
      }
    }

    if (user?.role !== 'master-admin' && !unit.toLowerCase().includes(user?.unit.toLowerCase())) {
      setError(`Đơn vị của quân nhân phải thuộc quyền quản lý của đồng chí (phải chứa "${user?.unit}")`);
      return;
    }

    try {
      if (isEditing && selectedUserId) {
        await axios.put(`/api/users/${selectedUserId}`, payload);
        setSuccessMsg('Cập nhật thông tin quân nhân thành công!');
      } else {
        await axios.post('/api/users', payload);
        setSuccessMsg('Thêm quân nhân mới vào đơn vị thành công!');
      }

      setTimeout(() => {
        setShowFormModal(false);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đã xảy ra lỗi khi lưu thông tin.');
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    const confirmDelete = await window.showConfirm(`Đồng chí có chắc chắn muốn xóa tài khoản của quân nhân ${name} khỏi hệ thống?`, 'Xác nhận xóa tài khoản');
    if (!confirmDelete) {
      return;
    }

    try {
      await axios.delete(`/api/users/${targetId}`);
      setSuccessMsg('Đã xóa quân nhân thành công.');
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xóa quân nhân.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = 
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.position || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.unit || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchRank = rankFilter ? u.rank === rankFilter : true;

    return matchSearch && matchRank;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const displayedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  // Role hierarchy restrictions
  const getAvailableRoles = () => {
    if (user?.role === 'master-admin') {
      return [
        { value: 'user', label: 'Quân nhân (User)' },
        { value: 'sub-admin', label: 'Chỉ huy trung đội/đại đội (Sub-Admin)' },
        { value: 'admin', label: 'Quản trị viên đơn vị (Admin)' }
      ];
    }
    if (user?.role === 'admin') {
      return [
        { value: 'user', label: 'Quân nhân (User)' },
        { value: 'sub-admin', label: 'Chỉ huy trung đội/đại đội (Sub-Admin)' }
      ];
    }
    return [
      { value: 'user', label: 'Quân nhân (User)' }
    ];
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-vpa-olive-light/30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onNavigateBack}
            className="p-2 border border-vpa-olive-light/30 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
              Quản lý Quân nhân Đơn vị
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              Đơn vị: {user?.role === 'master-admin' ? 'TẤT CẢ ĐƠN VỊ' : user?.unit} | Cấp chỉ huy: {user?.fullName}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
        >
          <UserPlus size={16} />
          <span>Thêm Quân nhân</span>
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-600 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-vpa-red/10 border border-vpa-red/30 text-vpa-red text-xs font-bold uppercase tracking-wider">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo họ tên, email, chức vụ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2.5 pl-9 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
          />
          <MagnifyingGlass size={16} className="absolute left-3 top-3 text-gray-400" />
        </div>

        <div>
          <select
            value={rankFilter}
            onChange={e => setRankFilter(e.target.value)}
            className="w-full text-xs p-2.5 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
          >
            <option value="" className="dark:bg-vpa-dark">Tất cả cấp bậc</option>
            {RANKS.map(rk => (
              <option key={rk} value={rk} className="dark:bg-vpa-dark">{rk}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end text-[10px] text-gray-500 uppercase tracking-widest font-mono">
          Số lượng quân nhân: {filteredUsers.length} / {users.length}
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono uppercase tracking-widest text-vpa-olive dark:text-vpa-sand animate-pulse-slow">
          Đang tải danh sách quân nhân...
        </div>
      ) : (
        <div className="border border-vpa-olive-light/50 bg-vpa-sand-light dark:bg-vpa-dark-card shadow-md rounded-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-vpa-olive-light/30 text-gray-500 font-mono uppercase text-[10px]">
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Cấp bậc</th>
                  <th className="py-3 px-4">Chức vụ</th>
                  <th className="py-3 px-4">Đơn vị</th>
                  <th className="py-3 px-4">Email / Tài khoản</th>
                  <th className="py-3 px-4">Quyền hạn</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map(u => (
                  <tr key={u._id} className="border-b border-vpa-olive-light/10 hover:bg-vpa-olive-light/5">
                    <td className="py-3 px-4 font-bold text-vpa-olive dark:text-vpa-sand uppercase">{u.fullName}</td>
                    <td className="py-3 px-4">{u.rank || 'Chưa cập nhật'}</td>
                    <td className="py-3 px-4">{u.position || 'Chưa cập nhật'}</td>
                    <td className="py-3 px-4 uppercase font-bold text-vpa-olive/75 dark:text-vpa-sand/75">{u.unit}</td>
                    <td className="py-3 px-4 font-mono">{u.email}</td>
                    <td className="py-3 px-4">
                      {u.role === 'master-admin' && <span className="bg-red-600/10 text-red-600 border border-red-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Master-Admin</span>}
                      {u.role === 'admin' && <span className="bg-vpa-gold/10 text-vpa-gold border border-vpa-gold/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Admin</span>}
                      {u.role === 'sub-admin' && <span className="bg-blue-600/10 text-blue-600 border border-blue-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">Sub-Admin</span>}
                      {u.role === 'user' && <span className="bg-green-600/10 text-green-600 border border-green-600/35 px-2 py-0.5 font-bold font-mono text-[9px] uppercase">User</span>}
                    </td>
                    <td className="py-3 px-4 text-right flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(u)}
                        className="p-1.5 border border-vpa-olive-light/50 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-gold dark:hover:text-vpa-dark transition-colors"
                      >
                        <PencilSimple size={14} />
                      </button>
                      
                      {/* Can only delete if user is below commander's level */}
                      {((user?.role === 'master-admin' && u.role !== 'master-admin') ||
                        (user?.role === 'admin' && u.role !== 'admin' && u.role !== 'master-admin') ||
                        (user?.role === 'sub-admin' && u.role === 'user')) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u._id, u.fullName)}
                          className="p-1.5 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">Không tìm thấy quân nhân nào khớp bộ lọc.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3 p-4 bg-vpa-sand-light dark:bg-vpa-dark-card border-t border-vpa-olive-light/10">
              <span className="text-gray-500 text-center sm:text-left">
                Hiển thị {startIndex + 1} - {Math.min(startIndex + pageSize, filteredUsers.length)} trong tổng số {filteredUsers.length} quân nhân
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  if (
                    totalPages > 6 &&
                    p !== 1 &&
                    p !== totalPages &&
                    Math.abs(p - page) > 1
                  ) {
                    if (p === 2 && page > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                    if (p === totalPages - 1 && page < totalPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 flex items-center justify-center border transition-all ${
                        page === p
                          ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark font-black shadow-sm'
                          : 'border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Header decoration */}
            <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
              <div className="w-3 h-3 bg-vpa-gold-bright rounded-none" />
              <h3 className="text-sm font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand">
                {isEditing ? 'Cập nhật thông tin quân nhân' : 'Thêm quân nhân mới vào đơn vị'}
              </h3>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Email / Tài khoản đăng nhập (Bắt buộc)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isEditing}
                  required
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold disabled:opacity-50 font-mono"
                />
              </div>

              {!isEditing && (
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Mật khẩu khởi tạo (Bắt buộc)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Họ và tên quân nhân (Bắt buộc)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Cấp bậc</label>
                  <select
                    value={rank}
                    onChange={e => setRank(e.target.value)}
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
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  >
                    {POSITIONS.map(ps => (
                      <option key={ps} value={ps} className="dark:bg-vpa-dark">{ps}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Đơn vị (Khóa theo Đơn vị Chỉ huy)</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    disabled={user?.role !== 'master-admin' && user?.role !== 'admin' && user?.role !== 'sub-admin'}
                    required
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold disabled:opacity-75 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quyền truy cập hệ thống</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  >
                    {getAvailableRoles().map(rl => (
                      <option key={rl.value} value={rl.value} className="dark:bg-vpa-dark">{rl.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-semibold text-gray-500 mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold"
                  />
                </div>
              </div>

              {error && (
                <p className="text-vpa-red text-[10px] font-bold uppercase tracking-wider bg-vpa-red/10 p-2 border border-vpa-red/20">{error}</p>
              )}

              <div className="flex justify-end space-x-3 border-t border-vpa-olive-light/20 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-none"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs uppercase tracking-wider text-white bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors rounded-none font-bold"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
