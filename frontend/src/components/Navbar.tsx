import React, { useState } from 'react';
import { Sun, Moon, SignOut, UserCircle, PencilSimple, Lock } from '@phosphor-icons/react';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onOpenEditProfile: () => void;
  onOpenChangePassword: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  onLogout, 
  darkMode, 
  setDarkMode,
  onOpenEditProfile,
  onOpenChangePassword
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full h-20 border-b border-vpa-olive-light/50 bg-vpa-sand-light/95 dark:bg-vpa-dark/95 backdrop-blur-md transition-colors px-6 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center space-x-4">
        <img src="/BQP.png" alt="Bộ Quốc Phòng" className="w-11 h-11 object-contain" />
        <div className="hidden sm:block">
          <span className="font-brand text-lg font-bold tracking-widest text-vpa-olive dark:text-vpa-sand block leading-tight">BỘ QUỐC PHÒNG</span>
          <span className="text-[13px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright block font-mono">Cổng thi trực tuyến</span>
        </div>
      </div>

      {/* Right Side Options */}
      <div className="flex items-center space-x-5">
        {/* User Card with Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-3 border-r border-vpa-olive-light/30 pr-5 text-left focus:outline-none hover:opacity-80 transition-opacity cursor-pointer"
            >
              <UserCircle size={38} className="text-vpa-olive dark:text-vpa-gold-bright" />
              <div className="text-left hidden md:block">
                <p className="text-sm font-bold text-vpa-olive dark:text-vpa-sand leading-tight">
                  {user.rank ? `${user.rank} ` : ''}{user.fullName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                  {user.position} | {user.unit?.name}
                </p>
              </div>
              <span className="text-[11px] uppercase font-mono px-2.5 py-1 border border-vpa-olive-light bg-vpa-sand dark:bg-vpa-olive-light/30 text-vpa-olive dark:text-vpa-gold">
                {user.role}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-4 mt-2 w-48 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-2xl z-50 font-mono text-xs animate-scale-up">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onOpenEditProfile();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light/10 flex items-center space-x-2 cursor-pointer"
                >
                  <PencilSimple size={14} />
                  <span>Sửa hồ sơ</span>
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onOpenChangePassword();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light/10 flex items-center space-x-2 cursor-pointer"
                >
                  <Lock size={14} />
                  <span>Đổi mật khẩu</span>
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-vpa-red/10 text-vpa-red flex items-center space-x-2 cursor-pointer"
                >
                  <SignOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2.5 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors"
          title={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </nav>
  );
};
export default Navbar;
