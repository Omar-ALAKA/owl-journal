// routes/history.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchHistory } from '../lib/api';
import type { HistoryAccount } from '../types';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

export function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () => fetchHistory().catch(() => ({ accounts: [] })),
  });

  const accounts: HistoryAccount[] = data?.accounts || [];

  return (
    <div className="page">
      <div className="page-header"><h1>Account History</h1></div>

      {isLoading ? <p className="text-muted">Loading...</p> : accounts.length === 0 ? (
        <div className="empty-state"><p>No account history yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {accounts.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Trophy size={16} color="var(--color-accent)" />
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{a.name}</span>
                    <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-red'}`}>{a.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {a.broker || 'No broker'} · {a.account_type} {a.phase ? `· ${a.phase}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '18px' }} className={a.stats.net_pnl >= 0 ? 'text-green' : 'text-red'}>
                    {a.stats.net_pnl >= 0 ? '+' : ''}${a.stats.net_pnl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    ROI: <span className={a.stats.roi_pct >= 0 ? 'text-green' : 'text-red'}>{a.stats.roi_pct}%</span>
                  </div>
                </div>
              </div>
              <div className="kpi-grid" style={{ marginTop: '16px', gap: '8px' }}>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Trades</div>
                  <div style={{ fontWeight: 700 }}>{a.stats.total_trades}</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Win Rate</div>
                  <div style={{ fontWeight: 700 }}>{a.stats.win_rate}%</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Avg R</div>
                  <div style={{ fontWeight: 700 }} className={a.stats.avg_r_multiple >= 0 ? 'text-green' : 'text-red'}>{a.stats.avg_r_multiple}R</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Max DD</div>
                  <div style={{ fontWeight: 700 }} className="text-red">{a.stats.max_drawdown_pct}%</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Best</div>
                  <div style={{ fontWeight: 700 }} className="text-green">+${a.stats.best_trade.toFixed(2)}</div>
                </div>
                <div className="kpi-card" style={{ padding: '10px' }}>
                  <div className="kpi-label">Worst</div>
                  <div style={{ fontWeight: 700 }} className="text-red">${a.stats.worst_trade.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
