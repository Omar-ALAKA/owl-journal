// routes/index.tsx - Dashboard
import { get } from '../lib/api';
import type { Stats } from '../types';
import { useQuery } from '@tanstack/react-query';

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => get<Stats>('/stats').catch(() => null),
  });

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {stats ? (
        <div className="kpi-grid">
          <KPICard label="Net P&L" value={`$${stats.net_profit.toFixed(2)}`} color={stats.net_profit >= 0 ? 'green' : 'red'} />
          <KPICard label="Profit Factor" value={stats.profit_factor.toFixed(2)} />
          <KPICard label="Win Rate" value={`${stats.win_rate.toFixed(1)}%`} />
          <KPICard label="Trades" value={stats.total_trades.toString()} />
        </div>
      ) : (
        <p>No data yet. Import your first trades!</p>
      )}
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color || ''}`}>{value}</div>
    </div>
  );
}
