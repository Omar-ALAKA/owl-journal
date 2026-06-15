// routes/index.tsx - Dashboard
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Activity, DollarSign, BarChart3 } from 'lucide-react';

export function DashboardPage() {
  const { data: stats } = useQuery<Stats | null>({
    queryKey: ['stats'],
    queryFn: () => fetchStats().catch(() => null),
  });

  const { data: equityData } = useQuery<{ points: EquityPoint[] }>({
    queryKey: ['equity-curve'],
    queryFn: () => fetchEquityCurve().catch(() => ({ points: [] })),
  });

  const { data: accountsData } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });

  const equityPoints = equityData?.points || [];
  const accounts = accountsData?.accounts || [];

  // Build daily PnL from equity curve for bar chart
  const dailyPnL: { date: string; pnl: number }[] = [];
  for (let i = 1; i < equityPoints.length; i++) {
    const pnl = equityPoints[i].equity - equityPoints[i - 1].equity;
    const date = equityPoints[i].timestamp?.split('T')[0] || '';
    if (dailyPnL.length > 0 && dailyPnL[dailyPnL.length - 1].date === date) {
      dailyPnL[dailyPnL.length - 1].pnl += pnl;
    } else {
      dailyPnL.push({ date, pnl });
    }
  }

  const s: Stats = stats ?? {
    net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
    wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
    avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
    max_consecutive_wins: 0, max_consecutive_losses: 0,
    max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KPICard
          label="Net P&L"
          value={`$${s.net_profit >= 0 ? '+' : ''}${s.net_profit.toFixed(2)}`}
          color={s.net_profit >= 0 ? 'green' : 'red'}
          icon={s.net_profit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        />
        <KPICard
          label="Profit Factor"
          value={s.profit_factor === Infinity ? '∞' : s.profit_factor.toFixed(2)}
          color={s.profit_factor >= 1.5 ? 'green' : s.profit_factor >= 1 ? 'accent' : 'red'}
          icon={<Target size={18} />}
        />
        <KPICard
          label="Win Rate"
          value={`${s.win_rate.toFixed(1)}%`}
          color={s.win_rate >= 50 ? 'green' : 'red'}
          icon={<Activity size={18} />}
          sub={`${s.wins}W / ${s.losses}L / ${s.breakeven}BE`}
        />
        <KPICard
          label="Total Trades"
          value={s.total_trades.toString()}
          icon={<BarChart3 size={18} />}
        />
        <KPICard
          label="Avg R-Multiple"
          value={`${s.avg_r >= 0 ? '+' : ''}${s.avg_r.toFixed(2)}R`}
          color={s.avg_r >= 0 ? 'green' : 'red'}
          icon={<DollarSign size={18} />}
        />
        <KPICard
          label="Max Drawdown"
          value={`-$${s.max_drawdown.toFixed(2)}`}
          color="red"
          sub={`${s.max_drawdown_pct.toFixed(1)}%`}
        />
      </div>

      {/* Equity Curve */}
      {equityPoints.length > 1 && (
        <div className="card">
          <div className="card-title">Equity Curve</div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityPoints.map(p => ({ ...p, equity: +p.equity.toFixed(2) }))}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8A838" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E8A838" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: '#7B8498', fontSize: 11 }}
                tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''}
              />
              <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#7B8498' }}
              />
              <Area type="monotone" dataKey="equity" stroke="#E8A838" fill="url(#eqGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily PnL Bars */}
      {dailyPnL.length > 1 && (
        <div className="card">
          <div className="card-title">Daily P&L</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyPnL.map(d => ({ ...d, pnl: +d.pnl.toFixed(2) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#7B8498', fontSize: 10 }}
                tickFormatter={(v: string) => v?.slice(5) || ''}
              />
              <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#7B8498' }}
              />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {dailyPnL.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#34D399' : '#F87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {s.total_trades === 0 && (
        <div className="empty-state">
          <p>No data yet. Import your first trades to see your dashboard!</p>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color, icon, sub }: {
  label: string; value: string; color?: string; icon?: React.ReactNode; sub?: string;
}) {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div className="kpi-label">{label}</div>
        {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
      </div>
      <div className={`kpi-value ${color || ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
