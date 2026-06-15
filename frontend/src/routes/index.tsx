// routes/index.tsx — Dashboard Premium avec 3D
import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import { sf, pnl, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { DollarSign, Target, Activity, BarChart3, Zap, Clock } from 'lucide-react';
import { Scene3D } from '../components/Scene3D';

const EMPTY_STATS: Stats = {
  net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
  wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
  avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
  max_consecutive_wins: 0, max_consecutive_losses: 0,
  max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
};

function useDashboardData() {
  const statsQ = useQuery({ queryKey: ['stats'], queryFn: () => fetchStats().catch(() => null), staleTime: 15000 });
  const eqQ = useQuery({ queryKey: ['equity-curve'], queryFn: () => fetchEquityCurve().catch(() => ({ points: [] })), staleTime: 15000 });
  const acctsQ = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })), staleTime: 30000 });

  return {
    stats: statsQ.data ?? EMPTY_STATS,
    points: eqQ.data?.points ?? [],
    accounts: acctsQ.data?.accounts ?? [],
    isLoading: statsQ.isLoading || eqQ.isLoading,
  };
}

function KPICard({ label, value, sub, icon, variant }: {
  label: string; value: string; sub: string; icon: React.ReactNode; variant?: 'pos' | 'neg' | 'acc' | 'warn';
}) {
  return (
    <div className={`kpi-card ${variant === 'pos' ? 'kpi-glow-pos' : variant === 'neg' ? 'kpi-glow-neg' : variant === 'acc' ? 'kpi-glow-acc' : ''}`}>
      <div className="kpi-label">{icon} {label}</div>
      <div className={`kpi-value ${variant || ''}`}>{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

export function DashboardPage() {
  const { stats: s, points: pts, accounts, isLoading } = useDashboardData();

  const dailyPnL = useMemo(() => {
    const result: { date: string; pnl: number }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const v = pts[i].equity - pts[i - 1].equity;
      const d = pts[i].timestamp?.split('T')[0] || '';
      if (result.length && result[result.length - 1].date === d) {
        result[result.length - 1].pnl += v;
      } else { result.push({ date: d, pnl: v }); }
    }
    return result;
  }, [pts]);

  const isPos = s.net_profit >= 0;
  const pf = s.profit_factor === Infinity ? '∞' : sf(s.profit_factor);

  if (isLoading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 32 }} />
        <div className="kpi-grid">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page anim-fadeUp" style={{ position: 'relative' }}>
      {/* 3D Background */}
      <Suspense fallback={null}>
        <Scene3D />
      </Suspense>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {s.total_trades} trades</p>
          </div>
        </div>

        {/* KPI Bento */}
        <div className="kpi-grid stagger">
          <KPICard
            icon={<DollarSign size={12} />}
            label="Net P&L"
            value={pnl(s.net_profit)}
            sub={`${pnl(s.gross_profit)} profit · ${pnl(s.gross_loss)} loss`}
            variant={isPos ? 'pos' : 'neg'}
          />
          <KPICard
            icon={<Target size={12} />}
            label="Profit Factor"
            value={pf}
            sub={`Avg R: ${s.avg_r >= 0 ? '+' : ''}${sf(s.avg_r)}R`}
            variant={s.profit_factor >= 1.5 ? 'pos' : s.profit_factor >= 1 ? 'warn' : 'neg'}
          />
          <KPICard
            icon={<Activity size={12} />}
            label="Win Rate"
            value={pct(s.win_rate)}
            sub={`${s.wins}W / ${s.losses}L / ${s.breakeven}BE`}
            variant={s.win_rate >= 50 ? 'pos' : 'neg'}
          />
          <KPICard
            icon={<BarChart3 size={12} />}
            label="Trades"
            value={String(s.total_trades)}
            sub={`Best +${sf(s.best_r)}R · Worst ${sf(s.worst_r)}R`}
          />
          <KPICard
            icon={<Zap size={12} />}
            label="Expectancy"
            value={`$${sf(s.expectancy)}`}
            sub={`Win $${sf(s.avg_win)} · Loss $${sf(s.avg_loss)}`}
            variant={s.expectancy >= 0 ? 'pos' : 'neg'}
          />
          <KPICard
            icon={<Clock size={12} />}
            label="Streaks"
            value={<><span className="t-pos">{s.max_consecutive_wins}</span><span className="t-mute"> / </span><span className="t-neg">{s.max_consecutive_losses}</span></>}
            sub="Max win streak · Max loss streak"
          />
        </div>

        {/* Equity Curve */}
        {pts.length > 1 && (
          <div className="card anim-fadeUp" style={{ animationDelay: '200ms' }}>
            <div className="card-title">Equity Curve</div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={pts.map(p => ({ ...p, equity: Number(p.equity) || 0 }))}>
                <defs>
                  <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                <XAxis dataKey="timestamp" tick={{ fill: '#5A6478', fontSize: 11 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
                <YAxis tick={{ fill: '#5A6478', fontSize: 11 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
                  labelStyle={{ color: '#5A6478', fontSize: 12 }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Equity']}
                />
                <Area type="monotone" dataKey="equity" stroke="#8B5CF6" fill="url(#eqG)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily PnL */}
        {dailyPnL.length > 1 && (
          <div className="card anim-fadeUp" style={{ animationDelay: '350ms' }}>
            <div className="card-title">Daily P&L</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyPnL.map(d => ({ ...d, pnl: Number(d.pnl) || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                <XAxis dataKey="date" tick={{ fill: '#5A6478', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
                <YAxis tick={{ fill: '#5A6478', fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}
                  labelStyle={{ color: '#5A6478' }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'P&L']}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dailyPnL.map((e, i) => (
                    <Cell key={i} fill={e.pnl >= 0 ? '#34D399' : '#F87171'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {s.total_trades === 0 && (
          <div className="empty-state anim-fadeUp">
            <p>No data yet. Import your first trades to see your dashboard!</p>
          </div>
        )}
      </div>
    </div>
  );
}
