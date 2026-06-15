// routes/index.tsx — Dashboard
import { useQuery } from '@tanstack/react-query';
import { fetchStats, fetchEquityCurve, fetchAccounts } from '../lib/api';
import type { Stats, EquityPoint, Account } from '../types';
import { sf, pnl, pct, cur } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Activity, DollarSign, BarChart3, Zap, Clock } from 'lucide-react';

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

  const dailyPnL: { date: string; pnl: number }[] = [];
  for (let i = 1; i < equityPoints.length; i++) {
    const val = equityPoints[i].equity - equityPoints[i - 1].equity;
    const date = equityPoints[i].timestamp?.split('T')[0] || '';
    if (dailyPnL.length > 0 && dailyPnL[dailyPnL.length - 1].date === date) {
      dailyPnL[dailyPnL.length - 1].pnl += val;
    } else {
      dailyPnL.push({ date, pnl: val });
    }
  }

  const s: Stats = stats ?? {
    net_profit: 0, gross_profit: 0, gross_loss: 0, total_trades: 0,
    wins: 0, losses: 0, breakeven: 0, win_rate: 0, profit_factor: 0,
    avg_win: 0, avg_loss: 0, avg_r: 0, best_r: 0, worst_r: 0,
    max_consecutive_wins: 0, max_consecutive_losses: 0,
    max_drawdown: 0, max_drawdown_pct: 0, expectancy: 0, current_equity: 0,
  };

  const pf = s.profit_factor === Infinity ? '∞' : sf(s.profit_factor);

  return (
    <div className="page animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>{accounts.length} account{accounts.length !== 1 ? 's' : ''} · {s.total_trades} trades</p>
        </div>
      </div>

      {/* ── KPI Bento Grid ── */}
      <div className="kpi-grid stagger">
        <div className={`kpi-card ${s.net_profit >= 0 ? 'glow-pos' : 'glow-neg'}`}>
          <div className="kpi-label"><DollarSign size={13} /> Net P&L</div>
          <div className={`kpi-value ${s.net_profit >= 0 ? 'pos' : 'neg'}`}>{pnl(s.net_profit)}</div>
          <div className="kpi-sub">{pnl(s.gross_profit)} gross profit · {pnl(s.gross_loss)} gross loss</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Target size={13} /> Profit Factor</div>
          <div className={`kpi-value ${s.profit_factor >= 1.5 ? 'pos' : s.profit_factor >= 1 ? 'warn' : 'neg'}`}>{pf}</div>
          <div className="kpi-sub">Avg R: {s.avg_r >= 0 ? '+' : ''}{sf(s.avg_r)}R</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Activity size={13} /> Win Rate</div>
          <div className={`kpi-value ${s.win_rate >= 50 ? 'pos' : 'neg'}`}>{pct(s.win_rate)}</div>
          <div className="kpi-sub">{s.wins}W / {s.losses}L / {s.breakeven}BE</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><BarChart3 size={13} /> Total Trades</div>
          <div className="kpi-value">{s.total_trades}</div>
          <div className="kpi-sub">Best: +{sf(s.best_r)}R · Worst: {sf(s.worst_r)}R</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={13} /> Expectancy</div>
          <div className={`kpi-value ${s.expectancy >= 0 ? 'pos' : 'neg'}`}>${sf(s.expectancy)}</div>
          <div className="kpi-sub">Avg Win: ${sf(s.avg_win)} · Avg Loss: ${sf(s.avg_loss)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={13} /> Streaks</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>
            <span className="text-pos">{s.max_consecutive_wins}</span>
            <span className="text-mute"> / </span>
            <span className="text-neg">{s.max_consecutive_losses}</span>
          </div>
          <div className="kpi-sub">Max win streak · Max loss streak</div>
        </div>
      </div>

      {/* ── Equity Curve ── */}
      {equityPoints.length > 1 && (
        <div className="card animate-fadeInScale" style={{ animationDelay: '200ms' }}>
          <div className="card-title">Equity Curve</div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={equityPoints.map(p => ({ ...p, equity: Number(p.equity) || 0 }))}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8A838" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#E8A838" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="timestamp" tick={{ fill: '#6B7488', fontSize: 11 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
              <YAxis tick={{ fill: '#6B7488', fontSize: 11 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: '#141820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: '#6B7488', fontSize: 12 }}
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equity']}
              />
              <Area type="monotone" dataKey="equity" stroke="#E8A838" fill="url(#eqGrad)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Daily PnL Bars ── */}
      {dailyPnL.length > 1 && (
        <div className="card animate-fadeInScale" style={{ animationDelay: '350ms' }}>
          <div className="card-title">Daily P&L</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyPnL.map(d => ({ ...d, pnl: Number(d.pnl) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="date" tick={{ fill: '#6B7488', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis tick={{ fill: '#6B7488', fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: '#141820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                labelStyle={{ color: '#6B7488' }}
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dailyPnL.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? '#34D399' : '#F87171'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {s.total_trades === 0 && (
        <div className="empty-state animate-fadeIn">
          <p>No data yet. Import your first trades to see your dashboard!</p>
        </div>
      )}
    </div>
  );
}
