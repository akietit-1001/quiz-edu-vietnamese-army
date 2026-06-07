import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Translate, SignOut, UserCircle } from '@phosphor-icons/react';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, darkMode, setDarkMode }) => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'vi' ? 'en' : 'vi';
    i18n.changeLanguage(nextLang);
  };

  return (
    <nav className="sticky top-0 z-40 w-full h-16 border-b border-vpa-olive-light/50 bg-vpa-sand-light/95 dark:bg-vpa-dark/95 backdrop-blur-md transition-colors px-6 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-vpa-olive dark:bg-vpa-gold flex items-center justify-center font-mono font-bold text-white dark:text-vpa-dark">
          Q
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold tracking-widest text-vpa-olive dark:text-vpa-sand block">QUIZ-EDU</span>
          <span className="text-[9px] uppercase tracking-wider text-vpa-gold-bright block -mt-1 font-mono">Military Edition</span>
        </div>
      </div>

      {/* Right Side Options */}
      <div className="flex items-center space-x-4">
        {/* User Card */}
        {user && (
          <div className="flex items-center space-x-3 border-r border-vpa-olive-light/30 pr-4">
            <UserCircle size={32} className="text-vpa-olive dark:text-vpa-gold-bright" />
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-vpa-olive dark:text-vpa-sand leading-tight">
                {user.fullName}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                {user.rank} | {user.position} | {user.unit}
              </p>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-vpa-olive-light bg-vpa-sand dark:bg-vpa-olive-light/30 text-vpa-olive dark:text-vpa-gold">
              {user.role}
            </span>
          </div>
        )}

        {/* Translation Toggle */}
        <button
          onClick={toggleLanguage}
          className="p-2 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors"
          title="Đổi ngôn ngữ / Switch Language"
        >
          <Translate size={18} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors"
          title={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Logout */}
        {user && (
          <button
            onClick={onLogout}
            className="p-2 border border-vpa-red/30 text-vpa-red hover:bg-vpa-red hover:text-white transition-colors"
            title={t('logout')}
          >
            <SignOut size={18} />
          </button>
        )}
      </div>
    </nav>
  );
};
export default Navbar;
