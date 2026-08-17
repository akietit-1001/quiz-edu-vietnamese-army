import React from 'react';
import { X, Printer } from '@phosphor-icons/react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPrint: () => void;
  children: React.ReactNode;
}

// Xem trước layout in ấn (dùng lại đúng nội dung/CSS sẽ được in) trước khi
// thực sự gọi window.print(). Người dùng xác nhận ở đây mới trigger in thật.
export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, onConfirmPrint, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-3 border-b border-vpa-olive-light/30 bg-vpa-sand-light dark:bg-vpa-dark-card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
          Xem trước trước khi xuất PDF
        </h3>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-vpa-olive-light text-xs uppercase tracking-wider text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive hover:text-white dark:hover:bg-vpa-sand dark:hover:text-vpa-dark transition-colors flex items-center space-x-2"
          >
            <X size={14} />
            <span>Đóng</span>
          </button>
          <button
            type="button"
            onClick={onConfirmPrint}
            className="px-4 py-2 bg-vpa-olive dark:bg-vpa-gold text-white dark:text-vpa-dark text-xs font-bold uppercase tracking-wider flex items-center space-x-2 hover:bg-vpa-olive-light dark:hover:bg-vpa-gold-bright transition-colors"
          >
            <Printer size={14} />
            <span>In / Lưu PDF</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
