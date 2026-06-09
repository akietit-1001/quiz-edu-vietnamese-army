import React, { useState } from 'react';
import axios from 'axios';
import { ShieldWarning, Key, Envelope, Lock } from '@phosphor-icons/react';

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [message2FA, setMessage2FA] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { email, password });
      
      if (response.data.requires2FA) {
        setRequires2FA(true);
        setMessage2FA(response.data.message);
        setLoading(false);
      } else {
        onLoginSuccess(response.data.user, response.data.accessToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối đến máy chủ.');
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/verify-2fa', { email, code: otpCode });
      onLoginSuccess(response.data.user, response.data.accessToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-vpa-sand dark:bg-vpa-dark p-6 transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Decorative Red Star at top center */}
      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <div className="w-10 h-10 bg-vpa-red dark:bg-vpa-gold flex items-center justify-center clip-star text-white dark:text-vpa-dark font-bold text-lg">
          ★
        </div>
      </div>

      <div className="w-full max-w-md bg-vpa-sand-light dark:bg-vpa-dark-card border border-vpa-olive-light p-8 shadow-2xl relative z-10 rounded-none">
        
        {/* Border corner decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-vpa-gold" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-vpa-gold" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-vpa-gold" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-vpa-gold" />

        <div className="text-center mb-8">
          <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
            {requires2FA ? 'XÁC THỰC 2FA' : 'ĐĂNG NHẬP CỔNG THI'}
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-vpa-gold-bright mt-1 font-mono">
            Học viện Kỹ thuật Quân sự
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-vpa-red/10 border-l-4 border-vpa-red text-vpa-red text-xs flex items-center space-x-2">
            <ShieldWarning size={16} />
            <span>{error}</span>
          </div>
        )}

        {!requires2FA ? (
          /* Normal Credentials Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Gmail công tác
              </label>
              <div className="relative">
                <Envelope size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="ndakiet1001@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark uppercase tracking-wider text-xs font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Đang xác minh quân nhân...' : 'Tiến hành Đăng nhập'}
            </button>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-[10px] uppercase tracking-wider text-vpa-gold hover:underline font-semibold"
              >
                Đăng ký tài khoản quân nhân mới
              </button>
            </div>
          </form>
        ) : (
          /* 2FA OTP Form */
          <form onSubmit={handle2FAVerify} className="space-y-6">
            <div className="p-3 bg-vpa-olive/5 border border-vpa-olive-light/30 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed rounded-none">
              {message2FA}
            </div>

            <div>
              <label htmlFor="login-otp" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                Nhập mã xác minh OTP (6 chữ số)
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                <input
                  type="text"
                  id="login-otp"
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
                onClick={() => setRequires2FA(false)}
                className="w-1/2 py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider transition-colors hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark"
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-1/2 py-2 bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright text-white dark:text-vpa-dark text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {loading ? 'Đang kiểm tra...' : 'Xác nhận OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
export default Login;
