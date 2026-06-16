// routes/index.tsx — Dashboard v5b (no countup)
import { Suspense, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import { sf, pnl, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { DollarSign, Target, Activity, TrendingDown, Zap } from 'lucide-react';

const EMPTY_STATS: Stats = {
  net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
  wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
  avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
  max_consecutive_wins: 0, max_consecutive_losses: 0,
  max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
};

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function useDashboardData() {
  const s = useQuery({ queryKey: ['stats'], queryFn: () => fetchStats().catch(() => null), staleTime: 15000 });
  const e = useQuery({ queryKey: ['equity-curve'], queryFn: () => fetchEquityCurve().catch(() => ({ points: [] as EquityPoint[] })), staleTime: 15000 });
  const a = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts().catch(() => ({ accounts: [] as Account[] })), staleTime: 30000 });
  return { stats: s.data ?? EMPTY_STATS, points: e.data?.points ?? [] as EquityPoint[], accounts: a.data?.accounts ?? [] as Account[], loading: s.isLoading || e.isLoading };
}

function KpiCard({ icon, label, value, sub, variant }: {
  icon: React.ReactNode; label: string; value: string; sub: string; variant?: 'profit' | 'loss' | 'accent';
}) {
  return (
    <motion.div
      className="stat-card"
      variants={cardVariants}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="stat-label">{icon} {label}</div>
      <div className={`stat-value ${variant || ''}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </motion.div>
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

  const pf = s.profit_factor === Infinity ? '∞' : sf(s.profit_factor);

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ height: 36, width: 200, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-breadcrumb">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {s.total_trades} trades</p>
        </div>
      </div>

      <motion.div className="kpi-grid stagger" variants={sectionVariants} initial="hidden" animate="visible">
        <KpiCard icon={<DollarSign size={11} />} label="Net P&L" value={pnl(s.net_profit)}
          sub={`${pnl(s.gross_profit)} profit · ${pnl(s.gross_loss)} loss`} variant={s.net_profit >= 0 ? 'profit' : 'loss'} />
        <KpiCard icon={<Target size={11} />} label="Profit Factor" value={pf}
          sub={`Avg R: ${s.avg_r >= 0 ? '+' : ''}${sf(s.avg_r)}R`} variant={s.profit_factor >= 1 ? 'profit' : 'loss'} />
        <KpiCard icon={<Activity size={11} />} label="Win Rate" value={pct(s.win_rate)}
          sub={`${s.wins}W / ${s.losses}L / ${s.breakeven}BE`} variant={s.win_rate >= 50 ? 'profit' : 'loss'} />
        <KpiCard icon={<Zap size={11} />} label="Expectancy" value={`$${sf(s.expectancy)}`}
          sub={`Win $${sf(s.avg_win)} · Loss $${sf(s.avg_loss)}`} variant={s.expectancy >= 0 ? 'profit' : 'loss'} />
      </motion.div>

      {pts.length > 1 && (
        <motion.div className="card anim-fadeUp" style={{ animationDelay: '200ms' }}>
          <div className="card-title">Equity Curve</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={pts.map(p => ({ ...p, equity: Number(p.equity) || 0 }))}>
              <defs>
                <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} labelStyle={{ fill: 'var(--color-text-muted)' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Equity']} />
              <Area type="monotone" dataKey="equity" stroke="#7C5CFC" fill="url(#eqG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {dailyPnL.length > 1 && (
        <motion.div className="card anim-fadeUp" style={{ animationDelay: '300ms' }}>
          <div className="card-title">Daily P&L</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyPnL.map(d => ({ ...d, pnl: Number(d.pnl) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} labelStyle={{ fill: 'var(--color-text-muted)' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dailyPnL.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {s.total_trades === 0 && <div className="empty-state anim-fadeUp"><p>No data yet. Import your first trades!</p></div>}
    </div>
  );
}
