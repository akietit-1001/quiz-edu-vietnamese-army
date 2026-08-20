import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, DoorOpen, ClipboardText, Target } from '@phosphor-icons/react';

interface Stats {
  totalQuizzes: number;
  totalRooms: number;
  totalAttempts: number;
  passRate: number;
  avgScorePercent: number;
}

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 flex items-center space-x-3">
    <div className="w-10 h-10 rounded-lg bg-vpa-olive/10 dark:bg-vpa-gold/10 flex items-center justify-center text-vpa-olive dark:text-vpa-gold-bright shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-lg font-extrabold text-vpa-olive dark:text-vpa-sand leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  </div>
);

// Bảng thống kê tổng quan cho admin/sub-admin/master-admin — dữ liệu đã được
// giới hạn theo chuỗi chỉ huy (managedBy) ở phía backend (GET /api/rooms/stats/overview),
// nên component này không cần tự lọc lại theo role.
export const AdminStatsPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get('/api/rooms/stats/overview')
      .then(res => { if (!cancelled) setStats(res.data); })
      .catch(err => console.error('Lỗi tải thống kê tổng quan:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="border border-vpa-olive-light/20 bg-vpa-sand/30 dark:bg-vpa-dark/10 p-4 h-[68px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatTile icon={<FileText size={20} />} label="Tổng số đề thi" value={stats.totalQuizzes} />
      <StatTile icon={<DoorOpen size={20} />} label="Tổng số phòng thi" value={stats.totalRooms} />
      <StatTile icon={<ClipboardText size={20} />} label="Tổng lượt thi" value={stats.totalAttempts} />
      <StatTile icon={<Target size={20} />} label="Tỷ lệ đạt" value={`${stats.passRate}%`} />
    </div>
  );
};
export default AdminStatsPanel;
