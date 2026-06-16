// components/HeatmapAnalytics.tsx — Nivo Heatmap jour×heure pour Analytics
import { useQuery } from '@tanstack/react-query';
import { fetchTrades } from '../lib/api';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { useMemo } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h'];

export function HeatmapAnalytics() {
  const { data } = useQuery({
    queryKey: ['trades-heatmap'],
    queryFn: () => fetchTrades({ limit: 5000 }).catch(() => ({ trades: [] })),
  });

  const heatmapData = useMemo(() => {
    const trades = data?.trades || [];
    const grid: Record<string, Record<string, number>> = {};

    // Initialize grid
    DAYS.forEach(day => {
      grid[day] = {};
      HOURS.forEach(h => { grid[day][h] = 0; });
    });

    // Aggregate PnL by day × hour
    trades.forEach((t: any) => {
      if (!t.open_time || t.profit == null) return;
      const d = new Date(t.open_time);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
      if (!DAYS.includes(dayName)) return;
      const hour = `${String(d.getHours()).padStart(2, '0')}h`;
      if (!HOURS.includes(hour)) return;
      grid[dayName][hour] += Number(t.profit) || 0;
    });

    // Convert to Nivo format
    return DAYS.map(day => ({
      id: day,
      data: HOURS.map(h => ({ x: h, y: +(grid[day][h] || 0).toFixed(2) })),
    }));
  }, [data]);

  const hasData = heatmapData.some(d => d.data.some(p => p.y !== 0));

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
      <div className="card-title">Performance Heatmap — Jour × Heure</div>
      <ResponsiveHeatMap
        data={heatmapData}
        margin={{ top: 20, right: 20, bottom: 60, left: 80 }}
        valueFormat=">-.2f"
        colors={{
          type: 'diverging',
          scheme: 'red_yellow_green',
          divergeAt: 0.5,
          minValue: -500,
          maxValue: 500,
        }}
        borderRadius={4}
        labelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
        axisTop={null}
        axisBottom={{ tickSize: 0, tickPadding: 8, legend: 'Heure', legendOffset: 40 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        tooltip={({ cell }: any) => (
          <div style={{
            background: '#141828', border: '1px solid #252840',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F1F5F9',
          }}>
            <strong>{cell.serieId} {cell.data.x}</strong><br />
            P&L: <span style={{ color: cell.data.y >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
              {cell.data.y >= 0 ? '+' : ''}{cell.data.y.toFixed(2)}$
            </span>
          </div>
        )}
      />
    </div>
  );
}
