import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel: string; // VD: "đề thi", "câu hỏi", "quân nhân"
  className?: string;
}

// Thanh phân trang dùng chung cho mọi bảng danh sách trong app — tổng số bản
// ghi bên trái, điều khiển trang bên phải. LUÔN hiện (kể cả khi chỉ có 1
// trang hoặc 0 bản ghi) để người dùng luôn thấy rõ tổng số lượng, không phải
// đoán qua đếm số dòng trên màn hình.
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  itemLabel,
  className
}) => {
  // 0 bản ghi thì không có gì để lật trang cả — ẩn hẳn thanh phân trang thay
  // vì hiện "Hiển thị 0 - 0 trong tổng số 0 ..." trống rỗng vô nghĩa.
  if (totalCount === 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  return (
    <div className={`flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-vpa-olive-light/20 text-xs font-mono gap-3 ${className || ''}`}>
      <span className="text-gray-500 text-center sm:text-left">
        Hiển thị {startIndex} - {endIndex} trong tổng số {totalCount} {itemLabel}
      </span>
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
        >
          Trước
        </button>
        {Array.from({ length: safeTotalPages }).map((_, i) => {
          const p = i + 1;
          if (
            safeTotalPages > 6 &&
            p !== 1 &&
            p !== safeTotalPages &&
            Math.abs(p - page) > 1
          ) {
            if (p === 2 && page > 3) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
            if (p === safeTotalPages - 1 && page < safeTotalPages - 2) return <span key={p} className="px-1 text-gray-400 select-none">...</span>;
            return null;
          }
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 flex items-center justify-center border transition-all ${
                page === p
                  ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark font-black shadow-sm'
                  : 'border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(Math.min(page + 1, safeTotalPages))}
          className="px-2.5 py-1 border border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand disabled:opacity-45 disabled:cursor-not-allowed hover:bg-vpa-olive-light/10 font-bold"
        >
          Sau
        </button>
      </div>
    </div>
  );
};

export default Pagination;
