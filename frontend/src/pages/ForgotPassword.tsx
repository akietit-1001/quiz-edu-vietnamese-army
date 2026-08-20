import React, { useState } from 'react';
import axios from 'axios';
import { ShieldWarning, Key, Envelope, Lock, Eye, EyeSlash, CheckCircle } from '@phosphor-icons/react';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setInfo(res.data.message);
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { email, code: otpCode, newPassword });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-vpa-sand dark:bg-vpa-dark p-6 transition-colors duration-300 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-vpa-olive/15 dark:bg-vpa-olive/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-vpa-gold/10 dark:bg-vpa-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <img src="/BQP.png" alt="Bộ Quốc Phòng" className="w-14 h-14 object-contain" />
      </div>

      <div className="w-full max-w-md bg-vpa-sand-light/65 dark:bg-vpa-dark-card/50 backdrop-blur-md border border-vpa-olive-light/20 dark:border-white/10 p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] relative z-10 rounded-lg">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-vpa-gold" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-vpa-gold" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-vpa-gold" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-vpa-gold" />

        <div className="text-center mb-8">
          <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
            {step === 'done' ? 'HOÀN TẤT' : 'QUÊN MẬT KHẨU'}
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright mt-1 font-mono">
            Chỉ áp dụng cho tài khoản Cán bộ (có email)
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs flex items-center space-x-2">
            <ShieldWarning size={16} />
            <span>{error}</span>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="space-y-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Nhập Gmail công tác đã đăng ký, hệ thống sẽ gửi mã OTP để đặt lại mật khẩu.
            </p>
            <div>
              <label htmlFor="fp-email" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Gmail công tác
              </label>
              <div className="relative">
                <Envelope size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type="email"
                  id="fp-email"
                  autoComplete="email"
                  required
                  placeholder="email@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark uppercase tracking-wider text-xs font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Đang gửi yêu cầu...' : 'Gửi mã OTP'}
            </button>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-[10px] uppercase tracking-wider text-vpa-gold hover:underline font-semibold"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {info && (
              <div className="p-3 bg-vpa-olive/5 border border-vpa-olive-light/30 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed rounded-lg">
                {info}
              </div>
            )}

            <div>
              <label htmlFor="fp-otp" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Mã OTP (6 chữ số)
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type="text"
                  id="fp-otp"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-lg tracking-[8px] pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand font-mono rounded-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor="fp-newpw" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="fp-newpw"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full text-sm pl-10 pr-10 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-2.5 text-vpa-olive-light hover:text-vpa-gold focus:outline-none flex items-center justify-center"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="fp-confirmpw" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="fp-confirmpw"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-1/2 py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider transition-colors hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark rounded-lg"
              >
                Gửi lại mã
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle size={48} weight="fill" className="text-vpa-olive dark:text-vpa-gold-bright" />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.
            </p>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="w-full py-2.5 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark uppercase tracking-wider text-xs font-bold transition-all"
            >
              Về trang đăng nhập
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default ForgotPassword;
