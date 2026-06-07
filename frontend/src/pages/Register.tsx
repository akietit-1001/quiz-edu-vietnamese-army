import React, { useState } from 'react';
import axios from 'axios';
import { ShieldWarning, User, Envelope, Lock, IdentificationCard, BuildingOffice, Calendar } from '@phosphor-icons/react';

interface RegisterProps {
  onRegisterSuccess: (user: any, token: string) => void;
  onNavigateToLogin: () => void;
}

const MILITARY_RANKS = [
  'Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ',
  'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy',
  'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá',
  'Thiếu tướng', 'Trung tướng', 'Thượng tướng', 'Đại tướng'
];

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [rank, setRank] = useState('Binh nhì');
  const [position, setPosition] = useState('Học viên');
  const [unit, setUnit] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/register', {
        email,
        password,
        fullName,
        dateOfBirth,
        rank,
        position,
        unit,
        address
      });
      onRegisterSuccess(response.data.user, response.data.accessToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng ký tài khoản thất bại.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-vpa-sand dark:bg-vpa-dark p-6 transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light p-8 shadow-2xl relative z-10 rounded-none">
        
        {/* Border corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-vpa-gold" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-vpa-gold" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-vpa-gold" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-vpa-gold" />

        <div className="text-center mb-8">
          <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
            ĐĂNG KÝ TÀI KHOẢN QUÂN NHÂN
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-vpa-gold-bright mt-1 font-mono">
            Khai báo thông tin chính xác phục vụ thi cử & ôn luyện
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs flex items-center space-x-2">
            <ShieldWarning size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left side */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Gmail quân nhân
                </label>
                <div className="relative">
                  <Envelope size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="email"
                    required
                    placeholder="dongchi@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Họ và tên
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Ngày tháng năm sinh
                </label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Cấp bậc quân hàm
                </label>
                <div className="relative">
                  <select
                    value={rank}
                    onChange={e => setRank(e.target.value)}
                    className="w-full text-sm p-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand dark:bg-vpa-dark-card"
                  >
                    {MILITARY_RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Chức vụ
                </label>
                <div className="relative">
                  <IdentificationCard size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="text"
                    required
                    placeholder="Học viên / Trung đội trưởng"
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Đơn vị công tác
                </label>
                <div className="relative">
                  <BuildingOffice size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="text"
                    required
                    placeholder="c1 - d5 - Học viện Kỹ thuật Quân sự"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  placeholder="Hà Nội"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full text-sm p-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark uppercase tracking-wider text-xs font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Đang tạo hồ sơ quân nhân...' : 'Đăng ký Tài khoản'}
          </button>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-[10px] uppercase tracking-wider text-vpa-gold hover:underline font-semibold"
            >
              Đã có tài khoản? Đăng nhập ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default Register;
