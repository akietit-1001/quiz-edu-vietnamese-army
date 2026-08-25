import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { UserPlus, X } from '../icons';
import { useSubviewBack } from '../hooks/useSubviewBack';
import { Select } from './Select';

interface InviteToRoomModalProps {
  isOpen: boolean;
  roomCode: string;
  user: any;
  onClose: () => void;
  onInvited?: () => void;
}

export const InviteToRoomModal: React.FC<InviteToRoomModalProps> = ({ isOpen, roomCode, user, onClose, onInvited }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<'examinee' | 'examiner'>('examinee');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setInviteEmail('');
    setInviteEmails([]);
    setInviteRole('examinee');
    setInviteError('');
    setInviteSuccess('');

    if (user?.role === 'admin' || user?.role === 'master-admin' || user?.role === 'sub-admin') {
      axios.get('/api/users')
        .then(response => setManagedUsers(response.data))
        .catch(err => console.error('Lỗi lấy danh sách quân nhân quản lý:', err));
    }
  }, [isOpen]);

  useSubviewBack(isOpen, onClose);

  const handleAddEmail = (emailToAdd: string) => {
    const email = emailToAdd.trim().toLowerCase();
    if (!email) return;
    if (inviteEmails.includes(email)) {
      setInviteError('Quân nhân này đã có trong danh sách chuẩn bị mời.');
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
        roomCode,
        recipientEmails: finalEmails,
        role: inviteRole
      });
      setInviteSuccess(response.data.message || 'Đã gửi lời mời thành công!');
      setInviteEmail('');
      setInviteEmails([]);
      onInvited?.();
      setTimeout(() => {
        onClose();
        setInviteSuccess('');
      }, 2000);
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Không thể gửi lời mời.');
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredUsers = React.useMemo(() => {
    // Cán bộ mời qua email, chiến sĩ (không có email) mời qua mã số quân
    // nhân/tên đăng nhập — cần ít nhất một trong hai để có định danh mời.
    const invitable = managedUsers.filter(u => u.email || u.username);
    return inviteEmail.trim() === ''
      ? invitable
      : invitable.filter(u =>
          u.fullName.toLowerCase().includes(inviteEmail.toLowerCase()) ||
          (u.email && u.email.toLowerCase().includes(inviteEmail.toLowerCase())) ||
          (u.username && u.username.toLowerCase().includes(inviteEmail.toLowerCase())) ||
          (u.rank && u.rank.toLowerCase().includes(inviteEmail.toLowerCase()))
        );
  }, [inviteEmail, managedUsers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X size={18} />
        </button>

        <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
          <UserPlus size={18} className="text-vpa-olive dark:text-vpa-sand" />
          <h3 className="text-sm font-bold uppercase text-vpa-olive dark:text-vpa-sand">
            Mời quân nhân tham gia phòng {roomCode}
          </h3>
        </div>

        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="relative">
            <label className="block text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-mono">
              Quân nhân nhận lời mời (Nhập mã số/email hoặc chọn từ danh sách)
            </label>
            <div className="flex space-x-2">
              <div className="flex-1 flex relative">
                <input
                  type="text"
                  placeholder="Tìm theo tên, cấp bậc, mã số quân nhân hoặc email..."
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                  className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg"
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
              <div className="absolute z-[100] left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light shadow-2xl font-mono text-xs rounded-lg">
                {filteredUsers.map(u => (
                  <div
                    key={u._id}
                    onMouseDown={() => {
                      handleAddEmail(u.email || u.username);
                      setShowSuggestions(false);
                    }}
                    className="p-2.5 cursor-pointer hover:bg-vpa-olive/10 dark:hover:bg-vpa-gold/15 text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light/10 last:border-none flex flex-col justify-start items-start"
                  >
                    <div className="w-full flex justify-between items-center">
                      <span className="font-bold text-xs">{u.rank ? `${u.rank} ` : ''}{u.fullName}</span>
                      <span className="text-[9px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light bg-vpa-olive/5 text-gray-500">
                        {u.unit?.name || 'Đơn vị N/A'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      Chức vụ: <span className="font-semibold text-vpa-olive dark:text-vpa-sand">{u.position || 'N/A'}</span>
                    </div>
                    <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                      {u.email ? `Email: ${u.email}` : `Mã số quân nhân: ${u.username}`}
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
                    const userObj = managedUsers.find(u => u.email === email || u.username === email);
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
            <Select
              value={inviteRole}
              onChange={v => setInviteRole(v as 'examinee' | 'examiner')}
              className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold rounded-lg flex items-center justify-between gap-2"
            >
              <option value="examinee">Thí sinh (Tham gia làm bài thi)</option>
              <option value="examiner">Giám khảo/Giám thị (Giám sát phòng thi)</option>
            </Select>
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
              onClick={onClose}
              className="w-1/2 py-2 border border-vpa-olive-light text-xs uppercase text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors rounded-lg"
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
  );
};

export default InviteToRoomModal;
