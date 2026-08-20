import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Robot, Coins, Warning, ChartBar } from '@phosphor-icons/react';

interface DayPoint { date: string; calls: number; tokens: number; cost: number }
interface UserPoint { userId: string; fullName: string; rank?: string; calls: number; tokens: number; cost: number }
interface Summary {
  rangeDays: number;
  totalCalls: number;
  totalAttempts: number;
  totalTokens: number;
  totalCost: number;
  failedCalls: number;
  byDay: DayPoint[];
  byUser: UserPoint[];
  pricingNote: string;
}

// Quy đổi tham khảo, không phải tỷ giá thời gian thực — chỉ giúp cán bộ hình
// dung nhanh, số USD trong bảng mới là số chính xác theo đơn giá cấu hình.
const VND_PER_USD = 25000;

const formatUsd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`;
const formatVnd = (v: number) => `${Math.round(v * VND_PER_USD).toLocaleString('vi-VN')} đ`;

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({ icon, label, value, sub }) => (
  <div className="border border-vpa-olive-light/30 bg-vpa-sand/50 dark:bg-vpa-dark/20 p-4 rounded flex items-center space-x-3">
    <div className="w-10 h-10 rounded-lg bg-vpa-olive/10 dark:bg-vpa-gold/10 flex items-center justify-center text-vpa-olive dark:text-vpa-gold-bright shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-lg font-extrabold text-vpa-olive dark:text-vpa-sand leading-tight truncate">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// Bảng chi phí sinh đề bằng AI cho master-admin — chỉ đọc dữ liệu, không có
// vòng lặp gọi lại AI nào ở đây nên an toàn để tải bất cứ lúc nào.
export const AiCostPanel: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get('/api/ai-usage/summary', { params: { days } })
      .then(res => { if (!cancelled) setSummary(res.data); })
      .catch(err => console.error('Lỗi tải thống kê chi phí AI:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const maxDailyCost = summary ? Math.max(...summary.byDay.map(d => d.cost), 0.0001) : 1;

  return (
    <div className="border border-vpa-olive-light/30 bg-vpa-sand-light dark:bg-vpa-dark-card rounded-lg shadow-md p-5 mb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Robot size={18} className="text-vpa-olive dark:text-vpa-gold-bright" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-vpa-olive dark:text-vpa-sand">
            Chi phí sinh đề bằng AI
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 border rounded transition-colors ${
                days === d
                  ? 'bg-vpa-olive text-white border-transparent dark:bg-vpa-gold dark:text-vpa-dark font-bold'
                  : 'border-vpa-olive-light/30 text-vpa-olive dark:text-vpa-sand hover:bg-vpa-olive-light/10'
              }`}
            >
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border border-vpa-olive-light/20 bg-vpa-sand/30 dark:bg-vpa-dark/10 p-4 h-[68px] rounded animate-pulse" />
          ))}
        </div>
      ) : !summary || summary.totalCalls === 0 ? (
        <div className="py-8 text-center text-[11px] text-gray-400">Chưa có lượt sinh đề bằng AI nào trong khoảng thời gian này.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <Tile
              icon={<ChartBar size={20} />}
              label="Tổng lượt gọi AI"
              value={summary.totalCalls.toString()}
              sub={summary.failedCalls > 0 ? `${summary.failedCalls} lượt lỗi` : undefined}
            />
            <Tile icon={<Robot size={20} />} label="Tổng token đã dùng" value={summary.totalTokens.toLocaleString('vi-VN')} />
            <Tile
              icon={<Coins size={20} />}
              label="Chi phí ước tính"
              value={formatUsd(summary.totalCost)}
              sub={formatVnd(summary.totalCost) + ' (quy đổi tham khảo)'}
            />
            <Tile
              icon={<Warning size={20} />}
              label="TB chi phí / lượt"
              value={formatUsd(summary.totalCalls > 0 ? summary.totalCost / summary.totalCalls : 0)}
            />
          </div>

          {summary.byDay.length > 0 && (
            <div className="mb-5">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-2 font-mono">Xu hướng chi phí theo ngày</p>
              <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                {summary.byDay.map(d => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${formatUsd(d.cost)} · ${d.calls} lượt · ${d.tokens.toLocaleString('vi-VN')} token`}
                    className="flex-1 min-w-[6px] bg-vpa-olive dark:bg-vpa-gold rounded-t hover:opacity-80 transition-opacity cursor-default"
                    style={{ height: `${Math.max((d.cost / maxDailyCost) * 100, 4)}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {summary.byUser.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-500 mb-2 font-mono">Top cán bộ dùng AI nhiều nhất</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] uppercase text-gray-400 border-b border-vpa-olive-light/20">
                      <th className="py-1.5 pr-2 font-semibold">Cán bộ</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Lượt gọi</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Token</th>
                      <th className="py-1.5 pl-2 font-semibold text-right">Chi phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byUser.map(u => (
                      <tr key={u.userId} className="border-b border-vpa-olive-light/10">
                        <td className="py-1.5 pr-2 font-bold text-vpa-olive dark:text-vpa-sand">
                          {u.rank ? `${u.rank} ` : ''}{u.fullName}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{u.calls}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{u.tokens.toLocaleString('vi-VN')}</td>
                        <td className="py-1.5 pl-2 text-right font-mono font-bold">{formatUsd(u.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[9px] text-gray-400 mt-4 pt-3 border-t border-vpa-olive-light/10 leading-relaxed">{summary.pricingNote}</p>
        </>
      )}
    </div>
  );
};
export default AiCostPanel;
