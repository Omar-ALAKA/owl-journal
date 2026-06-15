// components/DrawdownAnalysis.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '../lib/api';
import { sf, pct, rfmt } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, AlertTriangle, Clock, Target, Zap, Shield, Activity, DollarSign, Percent } from 'lucide-react';

type DdUnit = 'pct' | 'abs' | 'r';

interface Props {
  accountId?: number;
  dateFrom?: string;
  dateTo?: string;
}

function toR(absVal: number | null | undefined, avgLoss: number | null | undefined): number | null {
  if (!absVal || !avgLoss || avgLoss === 0) return null;
  return Math.abs(absVal) / avgLoss;
}

export function DrawdownAnalysis({ accountId, dateFrom, dateTo }: Props) {
  const [unit, setUnit] = useState<DdUnit>('pct');

  const { data, isLoading, error } = useQuery({
    queryKey: ['drawdown-analysis', accountId, dateFrom, dateTo],
    queryFn: () => fetchDrawdownAnalysis(accountId, dateFrom, dateTo).catch(() => null),
  });

  if (isLoading) return <div className="card"><p className="text-muted">Loading drawdown analysis...</p></div>;
  if (error || !data) return <div className="card"><p className="text-red">Error loading drawdown analysis</p></div>;

  const {
    max_drawdown_pct, max_drawdown_abs, avg_drawdown_pct, current_drawdown_pct,
    nb_drawdown_periods, longest_period_days, drawdown_periods, underwater_curve,
    current_equity, peak_equity, gain_required_pct, gain_required_abs,
    win_rate, avg_win, avg_loss, ev_per_trade, total_trades,
    consec_losses_to_overall_limit, consec_losses_to_daily_limit, remaining_dd_room,
    recovery_probability, blowout_risk, median_recovery_trades, mean_recovery_trades,
  } = data;

  // Compute R-multiple values
  const max_dd_r = toR(max_drawdown_abs, avg_loss);
  const current_dd_r = toR(Math.abs(current_drawdown_pct) / 100 * peak_equity, avg_loss);
  const remaining_r = toR(remaining_dd_room, avg_loss);

  // Format a drawdown value according to selected unit
  function fmtDd(pctVal: number | null | undefined, absVal: number | null | undefined, rVal: number | null | undefined): string {
    if (unit === 'pct') return pct(pctVal, 2);
    if (unit === 'abs') return `$${sf(Math.abs(absVal))}`;
    if (unit === 'r') return rVal != null ? `${sf(rVal)}R` : '-';
    return '-';
  }

  // Underwater curve: convert to selected unit
  const curveData = underwater_curve.map((p: any) => {
    const ddPct = Math.abs(Number(p.drawdown_pct) || 0);
    const ddAbs = ddPct / 100 * (peak_equity || 0);
    const ddR = toR(ddAbs, avg_loss);
    return {
      date: p.date,
      equity: Number(p.equity) || 0,
      pct: ddPct,
      abs: ddAbs,
      r: ddR ?? 0,
    };
  });

  const yAxisKey = unit === 'pct' ? 'pct' : unit === 'abs' ? 'abs' : 'r';
  const yAxisFormatter = (v: number) =>
    unit === 'pct' ? `${v.toFixed(1)}%` :
    unit === 'abs' ? `$${v.toFixed(0)}` :
    `${v.toFixed(1)}R`;

  const tooltipFormatter = (value: any) => {
    const n = Number(value) || 0;
    const label = unit === 'pct' ? `${n.toFixed(2)}%` :
                  unit === 'abs' ? `$${n.toFixed(2)}` :
                  `${n.toFixed(2)}R`;
    return [label, 'Drawdown'];
  };

  const hasData = curveData.length > 0;
  const hasPeriods = drawdown_periods.length > 0;
  const isPositiveEV = (ev_per_trade || 0) > 0;
  const isHealthyRecovery = (recovery_probability || 0) >= 70;
  const isHighBlowout = (blowout_risk || 0) >= 40;

  // Unit toggle buttons
  const unitOptions: { key: DdUnit; label: string; icon: React.ReactNode }[] = [
    { key: 'pct', label: '%', icon: <Percent size={14} /> },
    { key: 'abs', label: '$', icon: <DollarSign size={14} /> },
    { key: 'r', label: 'R', icon: <Activity size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Header + Unit Toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Drawdown Analysis</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-card-2)', borderRadius: '8px', padding: '3px' }}>
          {unitOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setUnit(opt.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 12px', borderRadius: '6px', border: 'none',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: unit === opt.key ? 'var(--color-accent)' : 'transparent',
                color: unit === opt.key ? '#0F1419' : 'var(--color-text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Key Metrics Row ── */}
      <div className="kpi-grid">
        {/* Probability */}
        <div className="kpi-card">
          <div className="kpi-label"><Target size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Recovery Probability</div>
          <div className={`kpi-value ${isHealthyRecovery ? 'green' : recovery_probability >= 40 ? 'yellow' : 'red'}`}>
            {pct(recovery_probability, 1)}
          </div>
          <div className="kpi-sub">{isHealthyRecovery ? 'Healthy edge' : recovery_probability >= 40 ? 'Moderate' : 'Math is against you'}</div>
        </div>

        {/* Time */}
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Median Recovery Time</div>
          <div className="kpi-value">{median_recovery_trades} trades</div>
          <div className="kpi-sub">Mean: {mean_recovery_trades} trades</div>
        </div>

        {/* Blowout */}
        <div className="kpi-card">
          <div className="kpi-label"><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Blowout Risk</div>
          <div className={`kpi-value ${isHighBlowout ? 'red' : 'green'}`}>
            {pct(blowout_risk, 1)}
          </div>
          <div className="kpi-sub">{isHighBlowout ? 'High risk' : 'Acceptable'}</div>
        </div>

        {/* EV */}
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />EV Per Trade</div>
          <div className={`kpi-value ${isPositiveEV ? 'green' : 'red'}`}>
            ${sf(ev_per_trade)}
          </div>
          <div className="kpi-sub">{isPositiveEV ? 'Positive edge ✓' : 'Negative — fix strategy'}</div>
        </div>
      </div>

      {/* ── Gain Required + Limits ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label"><TrendingDown size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Gain Needed to Recover</div>
          <div className="kpi-value yellow">{pct(gain_required_pct, 1)}</div>
          <div className="kpi-sub">${sf(gain_required_abs)} from current ${sf(current_equity)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label"><Shield size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Losses to Overall Limit</div>
          <div className={`kpi-value ${consec_losses_to_overall_limit <= 3 ? 'red' : consec_losses_to_overall_limit <= 5 ? 'yellow' : 'green'}`}>
            {consec_losses_to_overall_limit} losses
          </div>
          <div className="kpi-sub">
            {unit === 'r' ? `${sf(remaining_r)}R remaining` : `$${sf(remaining_dd_room)} remaining`}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label"><Activity size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Losses to Daily Limit</div>
          <div className={`kpi-value ${consec_losses_to_daily_limit <= 3 ? 'red' : consec_losses_to_daily_limit <= 5 ? 'yellow' : 'green'}`}>
            {consec_losses_to_daily_limit} losses
          </div>
          <div className="kpi-sub">5% daily limit</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label"><Activity size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Current Drawdown</div>
          <div className={`kpi-value ${current_drawdown_pct < -20 ? 'red' : current_drawdown_pct < -10 ? 'yellow' : 'green'}`}>
            {fmtDd(Math.abs(current_drawdown_pct), Math.abs(current_drawdown_pct) / 100 * peak_equity, current_dd_r)}
          </div>
          <div className="kpi-sub">
            Max: {fmtDd(Math.abs(max_drawdown_pct), Math.abs(max_drawdown_abs), max_dd_r)}
          </div>
        </div>
      </div>

      {/* ── Asymmetric Math Table ── */}
      <div className="card">
        <div className="card-title">The Asymmetric Math of Drawdowns</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          You always need to gain more than you lost to get back to breakeven, because you're growing a smaller base.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
          {[5, 10, 20, 30, 40, 50].map(dd => {
            const gain = 1 / (1 - dd / 100) - 1;
            const isCurrent = Math.abs(current_drawdown_pct) >= dd - 2 && Math.abs(current_drawdown_pct) < dd + 3;
            return (
              <div key={dd} style={{
                padding: '10px 12px', borderRadius: '6px', textAlign: 'center',
                background: isCurrent ? 'rgba(232,168,56,0.15)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>{dd}% DD</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: dd >= 30 ? '#F87171' : dd >= 20 ? '#FBBF24' : '#34D399' }}>
                  +{(gain * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>to recover</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Underwater Curve ── */}
      {hasData ? (
        <div className="card">
          <div className="card-title">
            Underwater Curve
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px', textTransform: 'none', letterSpacing: 0 }}>
              ({unit === 'pct' ? '% of peak equity' : unit === 'abs' ? 'USD' : 'R Multiple'})
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={curveData}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#F87171" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#7B8498', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis domain={[0, 'auto']} tick={{ fill: '#7B8498', fontSize: 10 }} tickFormatter={yAxisFormatter} />
              <Tooltip
                contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#7B8498' }}
                formatter={tooltipFormatter}
              />
              <Area type="monotone" dataKey={yAxisKey} stroke="#F87171" fill="url(#ddGrad)" strokeWidth={2} />
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
                  <th>Depth ({unit === 'pct' ? '%' : unit === 'abs' ? '$' : 'R'})</th>
                  <th>Duration (days)</th>
                </tr>
              </thead>
              <tbody>
                {[...drawdown_periods].sort((a: any, b: any) => a.depth_pct - b.depth_pct).map((p: any, i: number) => {
                  const depthR = toR(Math.abs(p.depth_abs), avg_loss);
                  return (
                    <tr key={i}>
                      <td>{p.start || '-'}</td>
                      <td>{p.end || '-'}</td>
                      <td className="text-red">
                        {fmtDd(Math.abs(p.depth_pct), Math.abs(p.depth_abs), depthR)}
                      </td>
                      <td>{p.duration_days}</td>
                    </tr>
                  );
                })}
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
