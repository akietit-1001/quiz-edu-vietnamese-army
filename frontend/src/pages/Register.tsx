import React, { useState } from 'react';
import axios from 'axios';
import { Lock, ShieldWarningIcon, EnvelopeIcon, UserIcon, CalendarIcon, IdentificationCardIcon, BuildingOfficeIcon, Key } from '@phosphor-icons/react';

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

  // OTP Verification state
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');

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
      if (response.data.requiresVerification) {
        setRequiresVerification(true);
        setVerificationMessage(response.data.message);
        setLoading(false);
      } else {
        onRegisterSuccess(response.data.user, response.data.accessToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng ký tài khoản thất bại.');
      setLoading(false);
    }
  };

  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/verify-register', {
        email,
        code: otpCode
      });
      onRegisterSuccess(response.data.user, response.data.accessToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã xác thực không chính xác hoặc đã hết hạn.');
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

        {error && (
          <div className="mb-6 p-3 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs flex items-center space-x-2">
            <ShieldWarningIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {!requiresVerification ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
                ĐĂNG KÝ TÀI KHOẢN QUÂN NHÂN
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-vpa-gold-bright mt-1 font-mono">
                Khai báo thông tin chính xác phục vụ thi cử & ôn luyện
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left side */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="register-email" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Gmail quân nhân
                    </label>
                    <div className="relative">
                      <EnvelopeIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="email"
                        id="register-email"
                        name="email"
                        autoComplete="email"
                        required
                        placeholder="dongchi@gmail.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-password" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="password"
                        id="register-password"
                        name="password"
                        autoComplete="new-password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-fullName" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Họ và tên
                    </label>
                    <div className="relative">
                      <UserIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="text"
                        id="register-fullName"
                        name="fullName"
                        autoComplete="name"
                        required
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-dateOfBirth" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Ngày tháng năm sinh
                    </label>
                    <div className="relative">
                      <CalendarIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="date"
                        id="register-dateOfBirth"
                        name="dateOfBirth"
                        autoComplete="bday"
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
                    <label htmlFor="register-rank" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Cấp bậc quân hàm
                    </label>
                    <div className="relative">
                      <select
                        id="register-rank"
                        name="rank"
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
                    <label htmlFor="register-position" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Chức vụ
                    </label>
                    <div className="relative">
                      <IdentificationCardIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="text"
                        id="register-position"
                        name="position"
                        autoComplete="organization-title"
                        required
                        placeholder="Học viên / Trung đội trưởng"
                        value={position}
                        onChange={e => setPosition(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-unit" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Đơn vị công tác
                    </label>
                    <div className="relative">
                      <BuildingOfficeIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                      <input
                        type="text"
                        id="register-unit"
                        name="unit"
                        required
                        placeholder="c1 - d5 - Học viện Kỹ thuật Quân sự"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-address" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Địa chỉ thường trú
                    </label>
                    <input
                      type="text"
                      id="register-address"
                      name="address"
                      autoComplete="street-address"
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
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
                XÁC THỰC EMAIL ĐĂNG KÝ
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-vpa-gold-bright mt-1 font-mono">
                Học viện Kỹ thuật Quân sự
              </p>
            </div>

            <form onSubmit={handleOTPVerify} className="space-y-6">
              <div className="p-3 bg-vpa-olive/5 border border-vpa-olive-light/30 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed rounded-none">
                {verificationMessage}
              </div>

              <div>
                <label htmlFor="register-otp" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                  Nhập mã xác minh OTP (6 chữ số)
                </label>
                <div className="relative">
                  <Key size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                  <input
                    type="text"
                    id="register-otp"
                    name="otpCode"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[8px] pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand font-mono"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setRequiresVerification(false)}
                  className="w-1/2 py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider transition-colors hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {loading ? 'Đang kiểm tra...' : 'Xác thực OTP'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
export default Register;
