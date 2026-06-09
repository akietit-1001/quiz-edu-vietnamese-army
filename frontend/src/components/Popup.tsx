import React from 'react';

interface PopupProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const Popup: React.FC<PopupProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  danger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md border border-vpa-olive-light bg-vpa-sand-light dark:bg-vpa-dark-card p-6 shadow-2xl rounded-none">
        {/* Header decoration */}
        <div className="flex items-center space-x-2 border-b border-vpa-olive-light pb-3 mb-4">
          <div className="w-3 h-3 bg-vpa-gold-bright rounded-none" />
          <h3 className="text-lg font-bold tracking-wide uppercase text-vpa-olive dark:text-vpa-sand">
            {title}
          </h3>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors"
          >
            {cancelText || "Hủy bỏ"}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs uppercase tracking-wider text-white transition-colors ${
              danger 
                ? 'bg-vpa-red hover:bg-red-700' 
                : 'bg-vpa-olive dark:bg-vpa-gold hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright'
            }`}
          >
            {confirmText || "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Popup;
