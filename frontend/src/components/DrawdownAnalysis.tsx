// components/DrawdownAnalysis.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '../lib/api';
import { sf, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, AlertTriangle, Clock, BarChart3 } from 'lucide-react';

interface Props {
  accountId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function DrawdownAnalysis({ accountId, dateFrom, dateTo }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['drawdown-analysis', accountId, dateFrom, dateTo],
    queryFn: () => fetchDrawdownAnalysis(accountId, dateFrom, dateTo).catch(() => null),
  });

  if (isLoading) return <div className="card"><p className="text-muted">Loading drawdown analysis...</p></div>;
  if (error || !data) return <div className="card"><p className="text-red">Error loading drawdown analysis</p></div>;

  const {
    max_drawdown_pct,
    max_drawdown_abs,
    avg_drawdown_pct,
    current_drawdown_pct,
    nb_drawdown_periods,
    longest_period_days,
    drawdown_periods,
    underwater_curve,
  } = data;

  const hasData = underwater_curve.length > 0;
  const hasPeriods = drawdown_periods.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Drawdown Analysis</h2>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Max Drawdown</div>
          <div className={`kpi-value ${max_drawdown_pct < 0 ? 'red' : ''}`}>
            {pct(max_drawdown_pct)}
          </div>
          <div className="kpi-sub">${sf(max_drawdown_abs)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Drawdown</div>
          <div className={`kpi-value ${avg_drawdown_pct < 0 ? 'red' : ''}`}>
            {pct(avg_drawdown_pct)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Current Drawdown</div>
          <div className={`kpi-value ${current_drawdown_pct < 0 ? 'red' : 'green'}`}>
            {pct(current_drawdown_pct)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Periods / Longest</div>
          <div className="kpi-value">{nb_drawdown_periods}</div>
          <div className="kpi-sub">{longest_period_days} days longest</div>
        </div>
      </div>

      {/* ── Underwater Curve ── */}
      {hasData ? (
        <div className="card">
          <div className="card-title">Underwater Curve</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={underwater_curve.map(p => ({
              ...p,
              drawdown_pct: Number(p.drawdown_pct) || 0,
            }))}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#F87171" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#7B8498', fontSize: 10 }}
                tickFormatter={(v: string) => v?.slice(5) || ''}
              />
              <YAxis
                domain={[0, 'auto']}
                tick={{ fill: '#7B8498', fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#7B8498' }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
              />
              <Area
                type="monotone"
                dataKey="drawdown_pct"
                stroke="#F87171"
                fill="url(#ddGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card"><p className="text-muted">No underwater curve data yet.</p></div>
      )}

      {/* ── Drawdown Periods Table ── */}
      {hasPeriods ? (
        <div className="card">
          <div className="card-title">Drawdown Periods ({nb_drawdown_periods})</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>End</th>
                  <th>Depth ($)</th>
                  <th>Depth (%)</th>
                  <th>Duration (days)</th>
                </tr>
              </thead>
              <tbody>
                {[...drawdown_periods]
                  .sort((a, b) => a.depth_pct - b.depth_pct)
                  .map((p, i) => (
                    <tr key={i}>
                      <td>{p.start || '-'}</td>
                      <td>{p.end || '-'}</td>
                      <td className="text-red">{sf(p.depth_abs)}</td>
                      <td className="text-red">{pct(p.depth_pct)}</td>
                      <td>{p.duration_days}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><p className="text-muted">No drawdown periods detected.</p></div>
      )}
    </div>
  );
}
