// routes/index.tsx — Dashboard v3
import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import { sf, pnl, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { DollarSign, Target, Activity, BarChart3, Zap, Clock } from 'lucide-react';

const EMPTY_STATS: Stats = {
  net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
  wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
  avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
  max_consecutive_wins: 0, max_consecutive_losses: 0,
  max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
};

function useDashboardData() {
  const s = useQuery({ queryKey: ['stats'], queryFn: () => fetchStats().catch(() => null), staleTime: 15000 });
  const e = useQuery({ queryKey: ['equity-curve'], queryFn: () => fetchEquityCurve().catch(() => ({ points: [] as EquityPoint[] })), staleTime: 15000 });
  const a = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts().catch(() => ({ accounts: [] as Account[] })), staleTime: 30000 });
  return { stats: s.data ?? EMPTY_STATS, points: e.data?.points ?? [] as EquityPoint[], accounts: a.data?.accounts ?? [] as Account[], loading: s.isLoading || e.isLoading };
}

function RadarChartComp({ stats }: { stats: Stats }) {
  const data = [
    { label: 'Win Rate', value: Math.min(stats.win_rate, 100) },
    { label: 'PF', value: Math.min(stats.profit_factor * 20, 100) },
    { label: 'Avg R', value: Math.min(Math.max(stats.avg_r * 10, 0), 100) },
    { label: 'Expectancy', value: stats.expectancy > 0 ? Math.min(stats.expectancy / 2, 100) : 0 },
    { label: 'Recovery', value: 100 - Math.min(Math.abs(stats.max_drawdown_pct) * 5, 100) },
    { label: 'Consistency', value: stats.max_consecutive_losses > 0 ? Math.max(100 - stats.max_consecutive_losses * 10, 10) : 50 },
  ];

  return (
    <RadarChart cx={150} cy={150} outerRadius={100} data={data} width={300} height={300}>
      <PolarGrid stroke="#2A2D3E" />
      <PolarAngleAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
      <Radar dataKey="value" stroke="#7C5CFC" fill="#7C5CFC" fillOpacity={0.2} strokeWidth={2} />
      <Tooltip
        contentStyle={{ background: '#1A1D2E', border: '1px solid #2A2D3E', borderRadius: 8, fontSize: 12 }}
        labelStyle={{ color: '#F1F5F9' }}
      />
    </RadarChart>
  );
}

export function DashboardPage() {
  const { stats: s, points: pts, accounts, loading } = useDashboardData();

  const dailyPnL = useMemo(() => {
    const r: { date: string; pnl: number }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const v = pts[i].equity - pts[i - 1].equity;
      const d = pts[i].timestamp?.split('T')[0] || '';
      if (r.length && r[r.length - 1].date === d) r[r.length - 1].pnl += v;
      else r.push({ date: d, pnl: v });
    }
    return r;
  }, [pts]);

  const isPos = s.net_profit >= 0;
  const pf = s.profit_factor === Infinity ? '∞' : sf(s.profit_factor);

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ height: 36, width: 200, marginBottom: 24 }} />
      <div className="kpi-grid">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}</div>
    </div>
  );

  return (
    <div className="page anim-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {s.total_trades} trades</p>
        </div>
      </div>

      {/* Radar + KPI row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Radar */}
        <div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <RadarChartComp stats={s} />
        </div>

        {/* KPIs summary */}
        <div className="kpi-grid" style={{ margin: 0 }}>
          <div className="card" style={{ margin: 0, background: isPos ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderColor: isPos ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
            <div className="kpi-label"><DollarSign size={11} /> Net P&L</div>
            <div className={`kpi-value ${isPos ? 'profit' : 'loss'}`}>{pnl(s.net_profit)}</div>
            <div className="kpi-sub">{pnl(s.gross_profit)} profit · {pnl(s.gross_loss)} loss</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi-label"><Target size={11} /> Profit Factor</div>
            <div className={`kpi-value ${s.profit_factor >= 1.5 ? 'profit' : s.profit_factor >= 1 ? 'loss' : 'loss'}`}>{pf}</div>
            <div className="kpi-sub">Avg R: {s.avg_r >= 0 ? '+' : ''}{sf(s.avg_r)}R</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi-label"><Activity size={11} /> Win Rate</div>
            <div className={`kpi-value ${s.win_rate >= 50 ? 'profit' : 'loss'}`}>{pct(s.win_rate)}</div>
            <div className="kpi-sub">{s.wins}W / {s.losses}L / {s.breakeven}BE</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi-label"><Zap size={11} /> Expectancy</div>
            <div className={`kpi-value ${s.expectancy >= 0 ? 'profit' : 'loss'}`}>${sf(s.expectancy)}</div>
            <div className="kpi-sub">Win ${sf(s.avg_win)} · Loss ${sf(s.avg_loss)}</div>
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      {pts.length > 1 && (
        <div className="card anim-fadeUp" style={{ animationDelay: '150ms' }}>
          <div className="card-title">Equity Curve</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={pts.map(p => ({ ...p, equity: Number(p.equity) || 0 }))}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" />
              <XAxis dataKey="timestamp" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip contentStyle={{ background: '#1A1D2E', border: '1px solid #2A2D3E', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Equity']} />
              <Area type="monotone" dataKey="equity" stroke="#7C5CFC" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily PnL */}
      {dailyPnL.length > 1 && (
        <div className="card anim-fadeUp" style={{ animationDelay: '250ms' }}>
          <div className="card-title">Daily P&L</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyPnL.map(d => ({ ...d, pnl: Number(d.pnl) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3E" />
              <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip contentStyle={{ background: '#1A1D2E', border: '1px solid #2A2D3E', borderRadius: 8 }} labelStyle={{ color: '#94A3B8' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dailyPnL.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#22C55E' : '#EF4444'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {s.total_trades === 0 && <div className="empty-state anim-fadeUp"><p>No data yet. Import your first trades!</p></div>}
    </div>
  );
}
