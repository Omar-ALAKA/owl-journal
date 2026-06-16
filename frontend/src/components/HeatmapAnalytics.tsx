// components/HeatmapAnalytics.tsx — Heatmap jour×heure sans Nivo (CSS pur)
import { useQuery } from '@tanstack/react-query';
import { fetchTrades } from '../lib/api';
import { useMemo, useState } from 'react';
import { sf } from '../lib/safe';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 8).padStart(2, '0')}h`);

function pnlColor(value: number): string {
  if (value > 500) return '#22C55E';
  if (value > 100) return '#4ADE80';
  if (value > 0) return '#86EFAC';
  if (value === 0) return 'var(--color-bg-surface-2)';
  if (value > -100) return '#FCA5A5';
  if (value > -500) return '#EF4444';
  return '#DC2626';
}

export function HeatmapAnalytics() {
  const [metric, setMetric] = useState<'pnl' | 'count'>('pnl');

  const { data } = useQuery({
    queryKey: ['trades-heatmap'],
    queryFn: () => fetchTrades({ limit: 5000 }).catch(() => ({ trades: [] })),
  });

  const { grid, maxPnl, maxCount } = useMemo(() => {
    const trades = (data?.trades || []) as any[];
    const g: Record<string, Record<string, { pnl: number; count: number }>> = {};
    DAYS.forEach(day => { g[day] = {}; HOURS.forEach(h => { g[day][h] = { pnl: 0, count: 0 }; }); });

    let mp = 0, mc = 0;
    trades.forEach((t: any) => {
      if (!t.open_time || t.profit == null) return;
      const d = new Date(t.open_time);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
      if (!DAYS.includes(dayName)) return;
      const hour = `${String(d.getHours()).padStart(2, '0')}h`;
      if (!HOURS.includes(hour)) return;
      g[dayName][hour].pnl += Number(t.profit) || 0;
      g[dayName][hour].count += 1;
      mp = Math.max(mp, Math.abs(g[dayName][hour].pnl));
      mc = Math.max(mc, g[dayName][hour].count);
    });
    return { grid: g, maxPnl: mp, maxCount: mc };
  }, [data]);

  const hasData = DAYS.some(d => HOURS.some(h => grid[d][h].count > 0));

  if (!hasData) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 48, marginBottom: 12, color: 'var(--color-accent)' }}>🗓️</div>
        <h3 style={{ marginBottom: 8, color: 'var(--color-text-primary)' }}>Pas encore de données</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>Importez des trades pour voir la heatmap jour×heure</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>Performance Heatmap — Jour × Heure</span>
        <div className="toggle-group">
          <button className={`toggle-btn ${metric === 'pnl' ? 'active' : ''}`} onClick={() => setMetric('pnl')}>P&L</button>
          <button className={`toggle-btn ${metric === 'count' ? 'active' : ''}`} onClick={() => setMetric('count')}>Trades</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${HOURS.length}, 44px)`, gap: 2, minWidth: 700 }}>
          {/* Header */}
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 8px', fontWeight: 600 }}>Day</div>
          {HOURS.map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>{h}</div>
          ))}
          {/* Rows */}
          {DAYS.map(day => (
            <>
              <div key={day} style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>{day.slice(0, 3)}</div>
              {HOURS.map(hour => {
                const cell = grid[day][hour];
                const val = metric === 'pnl' ? cell.pnl : cell.count;
                const color = metric === 'pnl' ? pnlColor(cell.pnl) : `rgba(124,92,252,${Math.min(1, cell.count / (maxCount || 1))})`;
                const intensity = metric === 'pnl' ? Math.min(1, Math.abs(cell.pnl) / (maxPnl || 1)) : Math.min(1, cell.count / (maxCount || 1));
                return (
                  <div
                    key={`${day}-${hour}`}
                    title={`${day} ${hour}: ${metric === 'pnl' ? sf(cell.pnl) : cell.count}`}
                    style={{
                      width: 44, height: 44, borderRadius: 6,
                      background: cell.count === 0 ? 'var(--color-bg-surface-2)' : color,
                      opacity: cell.count === 0 ? 0.5 : 0.7 + intensity * 0.3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: intensity > 0.5 ? '#fff' : 'var(--color-text-primary)',
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.zIndex = '2'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.zIndex = ''; }}
                  >
                    {cell.count > 0 && metric === 'count' ? cell.count : ''}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
