// routes/index.tsx — Dashboard Premium
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import { sf, pnl, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { DollarSign, Target, Activity, BarChart3, Zap, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export function DashboardPage() {
  const { data: stats } = useQuery<Stats | null>({
    queryKey: ['stats'], queryFn: () => fetchStats().catch(() => null),
  });
  const { data: eq } = useQuery<{ points: EquityPoint[] }>({
    queryKey: ['equity-curve'], queryFn: () => fetchEquityCurve().catch(() => ({ points: [] })),
  });
  const { data: accts } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'], queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });

  const pts = eq?.points || [];
  const accounts = accts?.accounts || [];

  const dailyPnL: { date: string; pnl: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const v = pts[i].equity - pts[i - 1].equity;
    const d = pts[i].timestamp?.split('T')[0] || '';
    if (dailyPnL.length && dailyPnL[dailyPnL.length - 1].date === d) {
      dailyPnL[dailyPnL.length - 1].pnl += v;
    } else { dailyPnL.push({ date: d, pnl: v }); }
  }

  const s: Stats = stats ?? {
    net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
    wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
    avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
    max_consecutive_wins: 0, max_consecutive_losses: 0,
    max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
  };

  const isPos = s.net_profit >= 0;
  const pf = s.profit_factor === Infinity ? '∞' : sf(s.profit_factor);

  return (
    <div className="anim-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {s.total_trades} trades</p>
        </div>
      </div>

      {/* ── KPI Bento ── */}
      <div className="kpi-grid stagger">
        <div className={`kpi-card ${isPos ? 'kpi-glow-pos' : 'kpi-glow-neg'}`}>
          <div className="kpi-label"><DollarSign size={12} /> Net P&L</div>
          <div className={`kpi-value ${isPos ? 'pos' : 'neg'}`}>{pnl(s.net_profit)}</div>
          <div className="kpi-sub">{pnl(s.gross_profit)} profit · {pnl(s.gross_loss)} loss</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Target size={12} /> Profit Factor</div>
          <div className={`kpi-value ${s.profit_factor >= 1.5 ? 'pos' : s.profit_factor >= 1 ? 'warn' : 'neg'}`}>{pf}</div>
          <div className="kpi-sub">Avg R: {s.avg_r >= 0 ? '+' : ''}{sf(s.avg_r)}R</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Activity size={12} /> Win Rate</div>
          <div className={`kpi-value ${s.win_rate >= 50 ? 'pos' : 'neg'}`}>{pct(s.win_rate)}</div>
          <div className="kpi-sub">{s.wins}W / {s.losses}L / {s.breakeven}BE</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><BarChart3 size={12} /> Trades</div>
          <div className="kpi-value">{s.total_trades}</div>
          <div className="kpi-sub">Best +{sf(s.best_r)}R · Worst {sf(s.worst_r)}R</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={12} /> Expectancy</div>
          <div className={`kpi-value ${s.expectancy >= 0 ? 'pos' : 'neg'}`}>${sf(s.expectancy)}</div>
          <div className="kpi-sub">Win ${sf(s.avg_win)} · Loss ${sf(s.avg_loss)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={12} /> Streaks</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>
            <span className="t-pos">{s.max_consecutive_wins}</span>
            <span className="t-mute"> / </span>
            <span className="t-neg">{s.max_consecutive_losses}</span>
          </div>
          <div className="kpi-sub">Max win streak · Max loss streak</div>
        </div>
      </div>

      {/* ── Equity Curve ── */}
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
                contentStyle={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: '#5A6478', fontSize: 12 }}
                formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Equity']}
              />
              <Area type="monotone" dataKey="equity" stroke="#8B5CF6" fill="url(#eqG)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Daily PnL ── */}
      {dailyPnL.length > 1 && (
        <div className="card anim-fadeUp" style={{ animationDelay: '350ms' }}>
          <div className="card-title">Daily P&L</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyPnL.map(d => ({ ...d, pnl: Number(d.pnl) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
              <XAxis dataKey="date" tick={{ fill: '#5A6478', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis tick={{ fill: '#5A6478', fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px' }}
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
  );
}
