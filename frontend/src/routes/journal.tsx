// routes/journal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJournalSessions, fetchStreaks, fetchJournalDaily, fetchEquityCurve } from '../lib/api';
import type { JournalSession, StreakData, JournalDaily, EquityPoint } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Flame, Snowflake } from 'lucide-react';

export function JournalPage() {
  const [tab, setTab] = useState<'equity' | 'sessions' | 'streaks' | 'daily'>('equity');

  const { data: sessionsData } = useQuery({
    queryKey: ['journal-sessions'],
    queryFn: () => fetchJournalSessions().catch(() => ({ sessions: [] })),
  });

  const { data: streaksData } = useQuery<StreakData>({
    queryKey: ['streaks'],
    queryFn: () => fetchStreaks().catch(() => ({ current_streak: { type: null, count: 0 }, max_win_streak: 0, max_loss_streak: 0, avg_win_streak: 0, avg_loss_streak: 0, total_streaks: 0, streaks: [] })),
  });

  const { data: dailyData } = useQuery({
    queryKey: ['journal-daily'],
    queryFn: () => fetchJournalDaily().catch(() => ({ daily: [] })),
  });

  const { data: equityData } = useQuery({
    queryKey: ['equity-curve'],
    queryFn: () => fetchEquityCurve().catch(() => ({ points: [] })),
  });

  const sessions: JournalSession[] = sessionsData?.sessions || [];
  const streaks: StreakData = streaksData || { current_streak: { type: null, count: 0 }, max_win_streak: 0, max_loss_streak: 0, avg_win_streak: 0, avg_loss_streak: 0, total_streaks: 0, streaks: [] };
  const daily: JournalDaily[] = dailyData?.daily || [];
  const equityPoints: EquityPoint[] = equityData?.points || [];

  return (
    <div className="page">
      <div className="page-header"><h1>Journal</h1></div>

      <div className="tabs">
        <button className={`tab ${tab === 'equity' ? 'active' : ''}`} onClick={() => setTab('equity')}>Equity Curve</button>
        <button className={`tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>Sessions</button>
        <button className={`tab ${tab === 'streaks' ? 'active' : ''}`} onClick={() => setTab('streaks')}>Streaks</button>
        <button className={`tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>Daily</button>
      </div>

      {tab === 'equity' && (
        equityPoints.length > 1 ? (
          <div className="card">
            <div className="card-title">Equity Curve</div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={equityPoints.map(p => ({ ...p, equity: +p.equity.toFixed(2) }))}>
                <defs>
                  <linearGradient id="eqGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8A838" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E8A838" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="timestamp" tick={{ fill: '#7B8498', fontSize: 11 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
                <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="equity" stroke="#E8A838" fill="url(#eqGrad2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="empty-state"><p>No equity data yet.</p></div>
      )}

      {tab === 'sessions' && (
        sessions.length === 0 ? <div className="empty-state"><p>No session data yet.</p></div> : (
          <table className="trade-table">
            <thead><tr><th>Session</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>Avg P&L</th><th>Avg R</th><th>Best</th><th>Worst</th><th>Comm + Swap</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.session}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.session}</td>
                  <td>{s.total_trades}</td>
                  <td>{s.wins}/{s.losses}</td>
                  <td>{s.win_rate}%</td>
                  <td className={s.net_profit >= 0 ? 'text-green' : 'text-red'}>{s.net_profit >= 0 ? '+' : ''}${s.net_profit.toFixed(2)}</td>
                  <td>${s.avg_pnl.toFixed(2)}</td>
                  <td className={s.avg_r_multiple >= 0 ? 'text-green' : 'text-red'}>{s.avg_r_multiple}R</td>
                  <td className="text-green">${s.best_trade.toFixed(2)}</td>
                  <td className="text-red">${s.worst_trade.toFixed(2)}</td>
                  <td className="text-muted">${(s.total_commission + s.total_swap).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'streaks' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Current Streak</div>
              <div className="kpi-value">
                {streaks.current_streak.type === 'win' ? <Flame size={20} color="var(--color-green)" /> : streaks.current_streak.type === 'loss' ? <Snowflake size={20} color="var(--color-red)" /> : null}
                {' '}{streaks.current_streak.count} {streaks.current_streak.type || 'N/A'}
              </div>
            </div>
            <div className="kpi-card"><div className="kpi-label">Best Win Streak</div><div className="kpi-value green">{streaks.max_win_streak}</div></div>
            <div className="kpi-card"><div className="kpi-label">Best Loss Streak</div><div className="kpi-value red">{streaks.max_loss_streak}</div></div>
            <div className="kpi-card"><div className="kpi-label">Avg Win / Loss Streak</div><div style={{ fontSize: '16px', fontWeight: 600 }}><span className="text-green">{streaks.avg_win_streak}</span> / <span className="text-red">{streaks.avg_loss_streak}</span></div></div>
          </div>
          {streaks.streaks.length > 0 && (
            <div className="card">
              <div className="card-title">Recent Streaks</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {streaks.streaks.map((s, i) => (
                  <div key={i} style={{
                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    background: s.type === 'win' ? 'var(--color-green-bg)' : 'var(--color-red-bg)',
                    color: s.type === 'win' ? 'var(--color-green)' : 'var(--color-red)',
                  }}>
                    {s.type === 'win' ? 'W' : 'L'}{s.count}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'daily' && (
        daily.length === 0 ? <div className="empty-state"><p>No daily stats yet.</p></div> : (
          <table className="trade-table">
            <thead><tr><th>Date</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>Gross P</th><th>Gross L</th><th>PF</th></tr></thead>
            <tbody>
              {daily.map((d, i) => (
                <tr key={i}>
                  <td>{d.trade_date}</td>
                  <td>{d.total_trades}</td>
                  <td>{d.wins}/{d.losses}</td>
                  <td>{d.win_rate}%</td>
                  <td className={d.net_pnl >= 0 ? 'text-green' : 'text-red'}>{d.net_pnl >= 0 ? '+' : ''}${d.net_pnl.toFixed(2)}</td>
                  <td className="text-green">${d.gross_profit.toFixed(2)}</td>
                  <td className="text-red">${d.gross_loss.toFixed(2)}</td>
                  <td>{d.profit_factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
