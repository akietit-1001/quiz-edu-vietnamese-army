import React, { useState } from 'react';
import { MorphIcon, SunData, MoonData, SignOut, UserCircle, PencilSimple, Lock, ClockCounterClockwise } from '../icons';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onOpenEditProfile: () => void;
  onOpenChangePassword: () => void;
  onNavigateHome: () => void;
  onNavigateToHistory: () => void;
  onNavigateToOmrGrading?: () => void;
  onNavigateToOmrMgmt?: () => void;
  notifications: any[];
  unreadCount: number;
  onNotificationClick: (notif: any) => void;
  onMarkAllNotificationsRead: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  darkMode,
  setDarkMode,
  onOpenEditProfile,
  onOpenChangePassword,
  onNavigateHome,
  onNavigateToHistory,
  onNavigateToOmrGrading,
  onNavigateToOmrMgmt,
  notifications,
  unreadCount,
  onNotificationClick,
  onMarkAllNotificationsRead
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const isOfficerOrAdmin = user && (user.role === 'admin' || user.role === 'master-admin' || user.role === 'sub-admin');

  return (
    <nav className="sticky top-0 z-40 w-full h-20 border-b border-vpa-olive-light/50 bg-vpa-sand-light/95 dark:bg-vpa-dark/95 backdrop-blur-md transition-colors px-6 flex items-center justify-between">
      {/* Brand Logo — bấm để về trang chủ */}
      <button
        type="button"
        onClick={onNavigateHome}
        className="flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
      >
        <img src="/BQP.png" alt="Bộ Quốc Phòng" className="w-11 h-11 object-contain" />
        <div className="hidden sm:block text-left">
          <span className="font-brand text-lg font-bold tracking-widest text-vpa-olive dark:text-vpa-sand block leading-tight">BỘ QUỐC PHÒNG</span>
          <span className="text-[13px] uppercase tracking-wider text-vpa-gold dark:text-vpa-gold-bright block font-mono">Cổng thi trực tuyến</span>
        </div>
      </button>

      {/* Right Side Options */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Nút truy cập nhanh Quản lý Phiếu OMR Offline cho Cán bộ Quản trị */}
        {isOfficerOrAdmin && (onNavigateToOmrMgmt || onNavigateToOmrGrading) && (
          <button
            onClick={() => {
              if (onNavigateToOmrMgmt) onNavigateToOmrMgmt();
              else if (onNavigateToOmrGrading) onNavigateToOmrGrading();
            }}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-vpa-gold/15 dark:bg-vpa-gold/20 border border-vpa-gold/40 hover:bg-vpa-gold/30 rounded text-xs font-bold text-vpa-olive dark:text-vpa-gold transition-all"
            title="Quản lý Phiếu kiểm tra OMR Offline"
          >
            <span className="w-2 h-2 rounded-full bg-vpa-gold animate-ping" />
            <span>Phiếu OMR (Offline)</span>
          </button>
        )}

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
              <div className="absolute right-4 mt-2 w-56 border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-2xl z-50 font-mono text-xs animate-scale-up rounded-lg overflow-hidden">
                {isOfficerOrAdmin && onNavigateToOmrMgmt && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onNavigateToOmrMgmt();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-vpa-gold/15 text-vpa-olive dark:text-vpa-gold font-bold border-b border-vpa-olive-light/10 flex items-center space-x-2 cursor-pointer"
                  >
                    <span>📋 Quản lý Phiếu OMR Offline</span>
                  </button>
                )}
                {isOfficerOrAdmin && onNavigateToOmrGrading && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onNavigateToOmrGrading();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-vpa-gold/15 text-vpa-olive dark:text-vpa-gold font-bold border-b border-vpa-olive-light/10 flex items-center space-x-2 cursor-pointer"
                  >
                    <span>📷 Bàn Chấm OMR Chung</span>
                  </button>
                )}
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
                    onNavigateToHistory();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-vpa-olive-light/10 text-vpa-olive dark:text-vpa-sand border-b border-vpa-olive-light/10 flex items-center space-x-2 cursor-pointer"
                >
                  <ClockCounterClockwise size={14} />
                  <span>Lịch sử làm bài</span>
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

        {/* Icon chuông thông báo — chỉ Cán bộ mới cần */}
        {user?.personnelType === 'officer' && (
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onNotificationClick={onNotificationClick}
            onMarkAllRead={onMarkAllNotificationsRead}
          />
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2.5 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors"
          title={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          <MorphIcon icon={darkMode ? SunData : MoonData} size={20} spring="snappy" />
        </button>
      </div>
    </nav>
  );
};
export default Navbar;

