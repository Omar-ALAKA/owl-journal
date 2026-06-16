// routes/analytics.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSessionAnalysis, fetchSetupAnalysis, fetchRDistribution, fetchDailyStats } from '../lib/api';
import type { SessionStat, SetupStat, RBucket, RSummary, DailyStat } from '../types';
import { DrawdownAnalysis } from '../components/DrawdownAnalysis';
import { HeatmapAnalytics } from '../components/HeatmapAnalytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { Target, Clock, TrendingDown } from 'lucide-react';

export function AnalyticsPage() {
  const [tab, setTab] = useState<'sessions' | 'setups' | 'r-dist' | 'daily' | 'drawdown' | 'heatmap'>('sessions');

  const { data: sessionsData } = useQuery({
    queryKey: ['session-analysis'],
    queryFn: () => fetchSessionAnalysis().catch(() => ({ sessions: [] })),
  });

  const { data: setupsData } = useQuery({
    queryKey: ['setup-analysis'],
    queryFn: () => fetchSetupAnalysis().catch(() => ({ setups: [] })),
  });

  const { data: rDistData } = useQuery({
    queryKey: ['r-distribution'],
    queryFn: () => fetchRDistribution().catch(() => ({ distribution: [], summary: { total: 0, avg_r: 0, median_r: 0, min_r: 0, max_r: 0 } })),
  });

  const { data: dailyData } = useQuery({
    queryKey: ['daily-stats'],
    queryFn: () => fetchDailyStats().catch(() => ({ daily_stats: [] })),
  });

  const sessions: SessionStat[] = sessionsData?.sessions || [];
  const setups: SetupStat[] = setupsData?.setups || [];
  const rBuckets: RBucket[] = rDistData?.distribution || [];
  const rSummary: RSummary = rDistData?.summary || { total: 0, avg_r: 0, median_r: 0, min_r: 0, max_r: 0 };
  const dailyStats: DailyStat[] = dailyData?.daily_stats || [];

  const COLORS = ['#EF4444', '#EF4444', '#F59E0B', '#F59E0B', '#22C55E', '#22C55E', '#22C55E', '#22C55E', '#7C5CFC'];

  const rDistTooltipStyle = { background: '#1C2038', border: '1px solid #3A3F6B', borderRadius: 8, color: '#F1F5F9', fontSize: 12 };

  return (
    <div className="page">
      <div className="page-header"><h1>Analytics</h1></div>

      <div className="tabs">
        <button className={`tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}><Clock size={14} style={{ marginRight: '6px' }} />Sessions</button>
        <button className={`tab ${tab === 'setups' ? 'active' : ''}`} onClick={() => setTab('setups')}><Target size={14} style={{ marginRight: '6px' }} />Setups</button>
        <button className={`tab ${tab === 'r-dist' ? 'active' : ''}`} onClick={() => setTab('r-dist')}><TrendingDown size={14} style={{ marginRight: '6px' }} />R-Distribution</button>
        <button className={`tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>Daily Stats</button>
        <button className={`tab ${tab === 'heatmap' ? 'active' : ''}`} onClick={() => setTab('heatmap')}>Heatmap</button>
        <button className={`tab ${tab === 'drawdown' ? 'active' : ''}`} onClick={() => setTab('drawdown')}><TrendingDown size={14} style={{ marginRight: '6px' }} />Drawdown</button>
      </div>

      {tab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <div className="empty-state"><p>No session data yet.</p></div>
          ) : (
            <>
              <div className="card">
                <div className="card-title">Net P&L by Session</div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sessions.map(s => ({ name: s.session, pnl: +s.net_profit.toFixed(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fill: '#7B8498', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-surface-2)', border: '1px solid var(--color-border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)' }} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {sessions.map((s, i) => <Cell key={i} fill={s.net_profit >= 0 ? '#22C55E' : '#EF4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="trade-table">
                <thead><tr><th>Session</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>PF</th><th>Avg R</th><th>Best R</th></tr></thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.session}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.session}</td>
                      <td>{s.trades}</td>
                      <td>{s.wins}/{s.losses}</td>
                      <td>{s.win_rate}%</td>
                      <td className={s.net_profit >= 0 ? 'text-green' : 'text-red'}>{s.net_profit >= 0 ? '+' : ''}${s.net_profit.toFixed(2)}</td>
                      <td>{s.profit_factor}</td>
                      <td className={s.avg_r >= 0 ? 'text-green' : 'text-red'}>{s.avg_r}R</td>
                      <td className="text-green">{s.best_r}R</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {tab === 'setups' && (
        <>
          {setups.length === 0 ? (
            <div className="empty-state"><p>No setup data yet. Tag your trades with setups!</p></div>
          ) : (
            <>
              <div className="card">
                <div className="card-title">Net P&L by Setup</div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={setups.slice(0, 10).map(s => ({ name: s.setup, pnl: +s.net_profit.toFixed(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fill: '#7B8498', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-surface-2)', border: '1px solid var(--color-border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)' }} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {setups.slice(0, 10).map((s, i) => <Cell key={i} fill={s.net_profit >= 0 ? '#22C55E' : '#EF4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="trade-table">
                <thead><tr><th>Setup</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>PF</th><th>Avg R</th><th>Quality</th></tr></thead>
                <tbody>
                  {setups.map(s => (
                    <tr key={s.setup}>
                      <td style={{ fontWeight: 600 }}>{s.setup}</td>
                      <td>{s.trades}</td>
                      <td>{s.wins}/{s.losses}</td>
                      <td>{s.win_rate}%</td>
                      <td className={s.net_profit >= 0 ? 'text-green' : 'text-red'}>{s.net_profit >= 0 ? '+' : ''}${s.net_profit.toFixed(2)}</td>
                      <td>{s.profit_factor}</td>
                      <td className={s.avg_r >= 0 ? 'text-green' : 'text-red'}>{s.avg_r}R</td>
                      <td>{s.avg_quality ? `${s.avg_quality}/5` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {tab === 'r-dist' && (
        <>
          {rBuckets.length === 0 ? (
            <div className="empty-state"><p>No R-multiple data yet.</p></div>
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">Total Trades</div><div className="kpi-value">{rSummary.total}</div></div>
                <div className="kpi-card"><div className="kpi-label">Avg R</div><div className={`kpi-value ${rSummary.avg_r >= 0 ? 'green' : 'red'}`}>{rSummary.avg_r}R</div></div>
                <div className="kpi-card"><div className="kpi-label">Median R</div><div className={`kpi-value ${rSummary.median_r >= 0 ? 'green' : 'red'}`}>{rSummary.median_r}R</div></div>
                <div className="kpi-card"><div className="kpi-label">Best / Worst</div><div style={{ fontSize: '16px', fontWeight: 600 }}><span className="text-green">{rSummary.max_r}R</span> / <span className="text-red">{rSummary.min_r}R</span></div></div>
              </div>
              <div className="card">
                <div className="card-title">R-Multiple Distribution</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={rBuckets.map(b => ({ name: b.label, count: b.count, profit: +b.profit.toFixed(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fill: '#7B8498', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#7B8498', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-surface-2)', border: '1px solid var(--color-border-strong)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-primary)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                      {rBuckets.map((b, i) => {
                        const fill = b.label.includes('< -3') || b.label.includes('-3') ? '#EF4444'
                          : b.label.includes('-2') || b.label.includes('-1') ? '#F59E0B'
                          : b.label.includes('> 3') ? '#7C5CFC'
                          : '#22C55E';
                        return <Cell key={i} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'daily' && (
        <>
          {dailyStats.length === 0 ? (
            <div className="empty-state"><p>No daily stats yet.</p></div>
          ) : (
            <table className="trade-table">
              <thead><tr><th>Date</th><th>Trades</th><th>W/L</th><th>Win Rate</th><th>Net P&L</th><th>Gross Profit</th><th>Gross Loss</th><th>PF</th><th>Avg R</th></tr></thead>
              <tbody>
                {dailyStats.map((d, i) => {
                  const wrColor = d.win_rate >= 60 ? 'var(--color-profit)' : d.win_rate >= 40 ? 'var(--color-warning)' : 'var(--color-loss)';
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td>{d.date}</td>
                      <td>{d.trades}</td>
                      <td>{d.wins}/{d.losses}</td>
                      <td style={{ color: wrColor, fontWeight: 700 }}>{d.win_rate}%</td>
                      <td style={{ color: d.net_profit >= 0 ? 'var(--color-profit)' : 'var(--color-loss)', fontWeight: 700 }}>{d.net_profit >= 0 ? '+' : ''}${d.net_profit.toFixed(2)}</td>
                      <td className="text-green">${d.gross_profit.toFixed(2)}</td>
                      <td className="text-red">${d.gross_loss.toFixed(2)}</td>
                      <td>{d.profit_factor}</td>
                      <td className={d.avg_r >= 0 ? 'text-green' : 'text-red'}>{d.avg_r}R</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'drawdown' && (
        <DrawdownAnalysis />
      )}

      {tab === 'heatmap' && (
        <HeatmapAnalytics />
      )}
    </div>
  );
}
