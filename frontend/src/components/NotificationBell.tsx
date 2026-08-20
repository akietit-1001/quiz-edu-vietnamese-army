import React, { useState, useRef, useEffect } from 'react';
import { Bell, Envelope, ShieldWarning, CheckCircle, SignOut, BellSlash, ShareNetwork } from '../icons';

interface NotificationBellProps {
  notifications: any[];
  unreadCount: number;
  onNotificationClick: (notif: any) => void;
  onMarkAllRead: () => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  invitation: <Envelope size={16} />,
  cheat_alert: <ShieldWarning size={16} />,
  exam_submitted: <CheckCircle size={16} />,
  kicked: <SignOut size={16} />,
  quiz_shared: <ShareNetwork size={16} />
};

const TYPE_TONE: Record<string, string> = {
  invitation: 'text-vpa-olive dark:text-vpa-gold-bright',
  cheat_alert: 'text-vpa-red',
  exam_submitted: 'text-green-600 dark:text-green-500',
  kicked: 'text-vpa-red',
  quiz_shared: 'text-vpa-olive dark:text-vpa-gold-bright'
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onNotificationClick,
  onMarkAllRead
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2.5 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10 transition-colors"
        title="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vpa-red text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card shadow-2xl z-50 font-mono text-xs animate-scale-up rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-vpa-olive-light/20 bg-vpa-olive/5 dark:bg-vpa-gold/5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-vpa-olive dark:text-vpa-sand">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[9px] uppercase tracking-wider text-vpa-gold hover:underline font-semibold"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <BellSlash size={26} className="mb-2 opacity-50" />
                <span className="text-[11px]">Chưa có thông báo nào</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => {
                    setOpen(false);
                    onNotificationClick(notif);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-vpa-olive-light/10 flex items-start space-x-2.5 hover:bg-vpa-olive-light/10 transition-colors cursor-pointer ${
                    !notif.isRead ? 'bg-vpa-gold/5 dark:bg-vpa-gold/10' : ''
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${TYPE_TONE[notif.type] || 'text-vpa-olive'}`}>
                    {TYPE_ICON[notif.type] || <Bell size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] leading-snug ${!notif.isRead ? 'font-bold text-vpa-olive dark:text-vpa-sand' : 'text-gray-500'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[9px] text-gray-400 mt-1">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleString('vi-VN') : ''}
                    </p>
                  </div>
                  {!notif.isRead && <span className="w-2 h-2 rounded-full bg-vpa-gold mt-1 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationBell;
