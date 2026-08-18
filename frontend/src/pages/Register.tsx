import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Lock, ShieldWarningIcon, EnvelopeIcon, UserIcon, IdentificationCardIcon, BuildingOfficeIcon, Key } from '@phosphor-icons/react';
import { DatePicker } from '../components/DatePicker';
import { Select } from '../components/Select';
import { UnitTreeSelect, type UnitNode } from '../components/UnitTreeSelect';

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

// Dự phòng cho đơn vị chưa tự khai báo chức vụ riêng (field `positions`
// rỗng) — xem thêm UserManagement.tsx, nơi admin quản lý danh sách này.
const FALLBACK_POSITIONS = [
  'Chiến sĩ', 'Tiểu đội trưởng', 'Phó Trung đội trưởng', 'Trung đội trưởng',
  'Phó Đại đội trưởng', 'Đại đội trưởng', 'Phó Tiểu đoàn trưởng', 'Tiểu đoàn trưởng',
  'Chính trị viên', 'Chính trị viên phó', 'Y tá', 'Học viên', 'Giảng viên', 'Khác'
];

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const [personnelType, setPersonnelType] = useState<'soldier' | 'officer' | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [rank, setRank] = useState('Binh nhì');
  const [position, setPosition] = useState('Học viên');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<UnitNode[]>([]);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/units/public/tree')
      .then(res => setUnits(res.data))
      .catch(() => setError('Không thể tải danh sách đơn vị. Vui lòng tải lại trang.'));
  }, []);

  // Chức vụ hợp lệ cho đơn vị đang chọn — mỗi đơn vị tự khai báo danh sách
  // chức vụ riêng (xem UserManagement.tsx), đơn vị chưa khai báo thì tạm
  // dùng danh sách dự phòng chung.
  const positionsForSelectedUnit = React.useMemo(() => {
    const unit = units.find(u => u._id === unitId);
    if (!unit) return FALLBACK_POSITIONS;
    return unit.positions && unit.positions.length > 0 ? unit.positions : FALLBACK_POSITIONS;
  }, [units, unitId]);

  // Đây là form tạo mới (không có giá trị đã lưu cần bảo vệ như form sửa ở
  // UserManagement), nên cứ đổi đơn vị là tự chỉnh lại chức vụ luôn, không
  // cần cơ chế bỏ qua lần đầu mount.
  useEffect(() => {
    if (positionsForSelectedUnit.length > 0 && !positionsForSelectedUnit.includes(position)) {
      setPosition(positionsForSelectedUnit[0]);
    }
  }, [positionsForSelectedUnit]);

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
        personnelType,
        email: personnelType === 'soldier' ? undefined : email,
        username: personnelType === 'soldier' ? username : undefined,
        password,
        fullName,
        dateOfBirth,
        rank,
        position,
        unitId,
        address
      });
      if (response.data.requiresVerification) {
        setRequiresVerification(true);
        setVerificationMessage(response.data.message);
        setLoading(false);
      } else {
        // Chiến sĩ: tài khoản được tạo ngay, không cần xác thực OTP qua email
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

      {/* Glow spots for Military Glass depth */}
      <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-vpa-olive/15 dark:bg-vpa-olive/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-vpa-gold/10 dark:bg-vpa-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-vpa-sand-light/65 dark:bg-vpa-dark-card/50 backdrop-blur-md border border-vpa-olive-light/20 dark:border-white/10 p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] relative z-10 rounded-lg">
        
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

        {!requiresVerification && !personnelType ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
                ĐĂNG KÝ TÀI KHOẢN QUÂN NHÂN
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright mt-1 font-mono">
                Đồng chí thuộc đối tượng nào?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPersonnelType('soldier')}
                className="p-6 border border-vpa-olive-light/50 hover:border-vpa-gold hover:bg-vpa-olive-light/5 transition-colors text-left group"
              >
                <UserIcon size={28} className="text-vpa-olive dark:text-vpa-sand group-hover:text-vpa-gold mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-1">Chiến sĩ</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed">Đăng ký bằng tên đăng nhập, không cần Gmail cá nhân.</p>
              </button>
              <button
                type="button"
                onClick={() => setPersonnelType('officer')}
                className="p-6 border border-vpa-olive-light/50 hover:border-vpa-gold hover:bg-vpa-olive-light/5 transition-colors text-left group"
              >
                <IdentificationCardIcon size={28} className="text-vpa-olive dark:text-vpa-sand group-hover:text-vpa-gold mb-3" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand mb-1">Cán bộ</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed">Đăng ký bằng Gmail công tác, xác thực qua mã OTP.</p>
              </button>
            </div>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-[10px] uppercase tracking-wider text-vpa-gold hover:underline font-semibold"
              >
                Đã có tài khoản? Đăng nhập ngay
              </button>
            </div>
          </>
        ) : !requiresVerification ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-xl font-extrabold uppercase tracking-widest text-vpa-olive dark:text-vpa-sand">
                ĐĂNG KÝ TÀI KHOẢN {personnelType === 'soldier' ? 'CHIẾN SĨ' : 'CÁN BỘ'}
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright mt-1 font-mono">
                Khai báo thông tin chính xác phục vụ thi cử & ôn luyện
              </p>
              <button
                type="button"
                onClick={() => setPersonnelType(null)}
                className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-vpa-gold hover:underline font-semibold mt-2"
              >
                ← Chọn lại đối tượng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left side */}
                <div className="space-y-4">
                  {personnelType === 'soldier' ? (
                    <div>
                      <label htmlFor="register-username" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                        Tên đăng nhập
                      </label>
                      <div className="relative">
                        <UserIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light" />
                        <input
                          type="text"
                          id="register-username"
                          name="username"
                          autoComplete="username"
                          required
                          placeholder="vd: nguyenvana01"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                        />
                      </div>
                    </div>
                  ) : (
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
                          className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                        />
                      </div>
                    </div>
                  )}

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
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
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
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-dateOfBirth" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Ngày tháng năm sinh
                    </label>
                    <DatePicker
                      id="register-dateOfBirth"
                      name="dateOfBirth"
                      required
                      value={dateOfBirth}
                      onChange={setDateOfBirth}
                      className="w-full text-sm p-2 pr-9 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand text-left rounded-lg"
                    />
                  </div>
                </div>

                {/* Right side */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="register-rank" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Cấp bậc quân hàm
                    </label>
                    <div className="relative">
                      <Select
                        id="register-rank"
                        value={rank}
                        onChange={setRank}
                        className="w-full text-sm p-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                      >
                        {MILITARY_RANKS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-position" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Chức vụ
                    </label>
                    <div className="relative">
                      <IdentificationCardIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light pointer-events-none z-10" />
                      <Select
                        id="register-position"
                        value={position}
                        onChange={setPosition}
                        className="w-full text-sm pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2"
                      >
                        {positionsForSelectedUnit.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-unit" className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
                      Đơn vị công tác
                    </label>
                    <div className="relative">
                      <BuildingOfficeIcon size={18} className="absolute left-3 top-2.5 text-vpa-olive-light pointer-events-none z-10" />
                      <div className="pl-10">
                        <UnitTreeSelect
                          units={units}
                          value={unitId}
                          onChange={setUnitId}
                          selectClassName="w-full text-sm p-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg flex items-center justify-between gap-2 mb-2 last:mb-0"
                        />
                      </div>
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
                      placeholder="Cao Lãnh, Đồng Tháp"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full text-sm p-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand rounded-lg"
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
              <p className="text-[10px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright mt-1 font-mono">
                Bộ CHQS tỉnh Đồng Tháp
              </p>
            </div>

            <form onSubmit={handleOTPVerify} className="space-y-6">
              <div className="p-3 bg-vpa-olive/5 border border-vpa-olive-light/30 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed rounded-lg">
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
                    className="w-full text-center text-lg tracking-[8px] pl-10 pr-4 py-2 bg-transparent border border-vpa-olive-light/50 focus:border-vpa-gold focus:outline-none text-vpa-olive dark:text-vpa-sand font-mono rounded-lg"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setRequiresVerification(false)}
                  className="w-1/2 py-2 border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand text-xs uppercase tracking-wider transition-colors hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark rounded-lg"
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
