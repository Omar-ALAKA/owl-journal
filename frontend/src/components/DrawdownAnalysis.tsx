// components/DrawdownAnalysis.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '../lib/api';
import { sf, pct } from '../lib/safe';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, AlertTriangle, Clock, Target, Zap, Shield, Activity } from 'lucide-react';

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
    max_drawdown_pct, max_drawdown_abs, avg_drawdown_pct, current_drawdown_pct,
    nb_drawdown_periods, longest_period_days, drawdown_periods, underwater_curve,
    current_equity, peak_equity, gain_required_pct, gain_required_abs,
    win_rate, avg_win, avg_loss, ev_per_trade, total_trades,
    consec_losses_to_overall_limit, consec_losses_to_daily_limit, remaining_dd_room,
    recovery_probability, blowout_risk, median_recovery_trades, mean_recovery_trades,
  } = data;

  const hasData = underwater_curve.length > 0;
  const hasPeriods = drawdown_periods.length > 0;
  const isPositiveEV = (ev_per_trade || 0) > 0;
  const isHealthyRecovery = (recovery_probability || 0) >= 70;
  const isHighBlowout = (blowout_risk || 0) >= 40;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Drawdown Analysis</h2>

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
          <div className="kpi-sub">${sf(remaining_dd_room)} remaining room</div>
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
            {pct(current_drawdown_pct, 2)}
          </div>
          <div className="kpi-sub">Max: {pct(max_drawdown_pct, 2)} (${sf(max_drawdown_abs)})</div>
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
              <XAxis dataKey="date" tick={{ fill: '#7B8498', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis domain={[0, 'auto']} tick={{ fill: '#7B8498', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#1E2433', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#7B8498' }}
                formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
              />
              <Area type="monotone" dataKey="drawdown_pct" stroke="#F87171" fill="url(#ddGrad)" strokeWidth={2} />
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
                <tr><th>Start</th><th>End</th><th>Depth ($)</th><th>Depth (%)</th><th>Duration (days)</th></tr>
              </thead>
              <tbody>
                {[...drawdown_periods].sort((a, b) => a.depth_pct - b.depth_pct).map((p, i) => (
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
