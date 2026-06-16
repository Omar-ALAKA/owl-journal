// routes/journal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJournalSessions, fetchStreaks, fetchJournalDaily, fetchEquityCurve, fetchChallengeStatus, fetchAccounts } from '../lib/api';
import type { JournalSession, StreakData, JournalDaily, EquityPoint, ChallengeStatus, Account } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { sf, pnl, pct, rfmt, cur } from '../lib/safe';
import { TrendingUp, TrendingDown, Flame, Snowflake, CheckCircle, XCircle } from 'lucide-react';

export function JournalPage() {
  const [tab, setTab] = useState<'equity' | 'sessions' | 'streaks' | 'daily' | 'challenge'>('equity');

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

  const { data: accountsData } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });

  const activeAccount = (accountsData?.accounts || []).find(a => a.status === 'active' && a.account_type === 'challenge')
    || (accountsData?.accounts || []).find(a => a.status === 'active');

  const { data: challengeStatus } = useQuery<ChallengeStatus>({
    queryKey: ['challenge-status', activeAccount?.id],
    queryFn: () => fetchChallengeStatus(activeAccount!.id),
    enabled: !!activeAccount?.id,
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
        <button className={`tab ${tab === 'challenge' ? 'active' : ''}`} onClick={() => setTab('challenge')}>Challenge Status</button>
      </div>

      {tab === 'equity' && (
        equityPoints.length > 1 ? (
          <div className="card">
            <div className="card-title">Equity Curve</div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={equityPoints.map(p => ({ ...p, equity: Number(p.equity) || 0 }))}>
                <defs>
                  <linearGradient id="eqGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="timestamp" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickFormatter={(v: string) => v?.split('T')[0]?.slice(5) || ''} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-surface-2)', border: '1px solid var(--color-border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)' }} />
                <Area type="monotone" dataKey="equity" stroke="#7C5CFC" fill="url(#eqGrad2)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--color-accent)' }}>📊</div>
            <h3 style={{ marginBottom: 8, color: 'var(--color-text-primary)' }}>Aucune donnée pour cette période</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>Importez des trades pour voir vos stats</p>
            <a href="/import" className="btn btn-primary">→ Importer</a>
          </div>
        )
      )}

      {tab === 'sessions' && (
        sessions.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--color-accent)' }}>📊</div>
            <h3 style={{ marginBottom: 8, color: 'var(--color-text-primary)' }}>Aucune donnée pour cette période</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>Importez des trades pour voir vos stats</p>
            <a href="/import" className="btn btn-primary">→ Importer</a>
          </div>
        ) : (
          <table className="trade-table">
            <thead><tr><th>Session</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>Avg P&L</th><th>Avg R</th><th>Best</th><th>Worst</th><th>Comm + Swap</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.session}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.session}</td>
                  <td>{s.total_trades}</td>
                  <td>{s.wins}/{s.losses}</td>
                  <td>{pct(s.win_rate)}</td>
                  <td className={s.net_profit >= 0 ? 'text-green' : 'text-red'}>{pnl(s.net_profit)}</td>
                  <td>{cur(s.avg_pnl)}</td>
                  <td className={s.avg_r_multiple >= 0 ? 'text-green' : 'text-red'}>{rfmt(s.avg_r_multiple)}</td>
                  <td className="text-green">{cur(s.best_trade)}</td>
                  <td className="text-red">{cur(s.worst_trade)}</td>
                  <td className="text-muted">{cur((s.total_commission ?? 0) + (s.total_swap ?? 0))}</td>
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
        daily.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--color-accent)' }}>📊</div>
            <h3 style={{ marginBottom: 8, color: 'var(--color-text-primary)' }}>Aucune donnée pour cette période</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>Importez des trades pour voir vos stats</p>
            <a href="/import" className="btn btn-primary">→ Importer</a>
          </div>
        ) : (
          <table className="trade-table">
            <thead><tr><th>Date</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>Gross P</th><th>Gross L</th><th>PF</th></tr></thead>
            <tbody>
              {daily.map((d, i) => (
                <tr key={i}>
                  <td>{d.trade_date}</td>
                  <td>{d.total_trades}</td>
                  <td>{d.wins}/{d.losses}</td>
                  <td>{d.win_rate}%</td>
                  <td className={d.net_pnl >= 0 ? 'text-green' : 'text-red'}>{pnl(d.net_pnl)}</td>
                  <td className="text-green">{cur(d.gross_profit)}</td>
                  <td className="text-red">{cur(d.gross_loss)}</td>
                  <td>{d.profit_factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'challenge' && (
        !activeAccount ? (
          <div className="empty-state"><p>No active challenge account found.</p></div>
        ) : !challengeStatus ? (
          <div className="empty-state"><p>Loading challenge status...</p></div>
        ) : (
          <>
            <div className="kpi-grid" style={{ marginBottom: '16px' }}>
              <div className="kpi-card">
                <div className="kpi-label">Status</div>
                <div className="kpi-value">
                  <span className={`badge ${challengeStatus.challenge_complete ? 'badge-green' : 'badge-orange'}`}>
                    {challengeStatus.challenge_complete ? 'VALIDATED' : 'IN PROGRESS'}
                  </span>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Target Reached</div>
                <div className="kpi-value">
                  {challengeStatus.target_reached ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-green)' }}>
                      <CheckCircle size={18} /> Yes
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-red)' }}>
                      <XCircle size={18} /> No
                    </span>
                  )}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Rules Respected</div>
                <div className="kpi-value">
                  {challengeStatus.rules_respected ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-green)' }}>
                      <CheckCircle size={18} /> Yes
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-red)' }}>
                      <XCircle size={18} /> No
                    </span>
                  )}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Trading Days</div>
                <div className="kpi-value">
                  {challengeStatus.trading_days}/{challengeStatus.min_trading_days || '∞'}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Progress</div>
                <div className="kpi-value">
                  {sf(challengeStatus.progress_pct)}% / {sf((challengeStatus.net_pnl / (challengeStatus.target_amount || 1)) * 100, 0)}%
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Max Drawdown</div>
                <div className="kpi-value">
                  {sf(challengeStatus.max_drawdown_pct)}% / {challengeStatus.drawdown_limit_pct}%
                </div>
              </div>
            </div>

            {challengeStatus.violations && challengeStatus.violations.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ color: 'var(--color-red)' }}>Violations ({challengeStatus.violations.length})</div>
                <table className="trade-table">
                  <thead><tr><th>Type</th><th>Value</th><th>Limit</th><th>Severity</th><th>Date</th></tr></thead>
                  <tbody>
                    {challengeStatus.violations.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{v.type.replace(/_/g, ' ')}</td>
                        <td className="text-red">{sf(v.value)}</td>
                        <td>{v.limit}</td>
                        <td><span className={`badge ${v.severity === 'critical' ? 'badge-red' : 'badge-orange'}`}>{v.severity}</span></td>
                        <td className="text-muted">{v.date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
