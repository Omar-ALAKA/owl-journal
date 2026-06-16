// components/DrawdownAnalysis.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '../lib/api';
import { sf, pct, rfmt } from '../lib/safe';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, AlertTriangle, Clock, Target, Zap, Shield, Activity, DollarSign, Percent } from 'lucide-react';

type DdUnit = 'pct' | 'abs' | 'r';
interface Props { accountId?: number; dateFrom?: string; dateTo?: string; }

function toR(v: number | null | undefined, avg: number | null | undefined): number | null {
  if (!v || !avg || avg === 0) return null;
  return Math.abs(v) / avg;
}

export function DrawdownAnalysis({ accountId, dateFrom, dateTo }: Props) {
  const [unit, setUnit] = useState<DdUnit>('pct');

  const { data, isLoading, error } = useQuery({
    queryKey: ['drawdown-analysis', accountId, dateFrom, dateTo],
    queryFn: () => fetchDrawdownAnalysis(accountId, dateFrom, dateTo).catch(() => null),
  });

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (error || !data) return <div className="card"><p className="t-neg">Error loading drawdown analysis</p></div>;

  const {
    max_drawdown_pct, max_drawdown_abs, current_drawdown_pct,
    nb_drawdown_periods, drawdown_periods, underwater_curve,
    current_equity, peak_equity, gain_required_pct, gain_required_abs,
    avg_loss, ev_per_trade,
    consec_losses_to_overall_limit, consec_losses_to_daily_limit, remaining_dd_room,
    recovery_probability, blowout_risk, median_recovery_trades, mean_recovery_trades,
  } = data;

  const maxR = toR(max_drawdown_abs, avg_loss);
  const curR = toR(Math.abs(current_drawdown_pct) / 100 * peak_equity, avg_loss);
  const remR = toR(remaining_dd_room, avg_loss);

  function fmt(p: number | null | undefined, a: number | null | undefined, r: number | null | undefined): string {
    if (unit === 'pct') return pct(p, 2);
    if (unit === 'abs') return `$${sf(Math.abs(a ?? 0))}`;
    if (unit === 'r') return r != null ? `${sf(r)}R` : '-';
    return '-';
  }

  const curve = underwater_curve.map((p: any) => {
    const pctv = Math.abs(Number(p.drawdown_pct) || 0);
    const absv = pctv / 100 * (peak_equity || 0);
    return { date: p.date, equity: Number(p.equity) || 0, pct: pctv, abs: absv, r: toR(absv, avg_loss) ?? 0 };
  });

  const yK = unit === 'pct' ? 'pct' : unit === 'abs' ? 'abs' : 'r';
  const yFmt = (v: number) => unit === 'pct' ? `${v.toFixed(1)}%` : unit === 'abs' ? `$${v.toFixed(0)}` : `${v.toFixed(1)}R`;
  const tipFmt = (v: any) => {
    const n = Number(v) || 0;
    return [unit === 'pct' ? `${n.toFixed(2)}%` : unit === 'abs' ? `$${n.toFixed(2)}` : `${n.toFixed(2)}R`, 'Drawdown'];
  };

  const hasCurve = curve.length > 0;
  const hasPeriods = drawdown_periods.length > 0;
  const posEV = (ev_per_trade || 0) > 0;
  const healthyRec = (recovery_probability || 0) >= 70;
  const highBlow = (blowout_risk || 0) >= 40;

  const units: { key: DdUnit; label: string; icon: React.ReactNode }[] = [
    { key: 'pct', label: '%', icon: <Percent size={12} /> },
    { key: 'abs', label: '$', icon: <DollarSign size={12} /> },
    { key: 'r', label: 'R', icon: <Activity size={12} /> },
  ];

  return (
    <div className="anim-fadeUp">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--color-text-hi)' }}>Drawdown Analysis</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-mute)', marginTop: '4px' }}>Risk metrics & recovery simulation</p>
        </div>
        <div className="toggle-group">
          {units.map(u => (
            <button key={u.key} className={`toggle-btn ${unit === u.key ? 'active' : ''}`} onClick={() => setUnit(u.key)}>
              {u.icon} {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="kpi-grid stagger">
        <div className={`kpi-card ${healthyRec ? 'kpi-glow-pos' : 'kpi-glow-acc'}`}>
          <div className="kpi-label"><Target size={12} /> Recovery Probability</div>
          <div className={`kpi-value ${healthyRec ? 'pos' : recovery_probability >= 40 ? 'warn' : 'neg'}`}>{pct(recovery_probability, 1)}</div>
          <div className="kpi-sub">{healthyRec ? 'Healthy edge' : recovery_probability >= 40 ? 'Moderate' : 'Math against you'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={12} /> Median Recovery</div>
          <div className="kpi-value" style={{ fontSize: '22px' }}>{median_recovery_trades} <span style={{ fontSize: '13px', color: 'var(--color-text-mute)' }}>trades</span></div>
          <div className="kpi-sub">Mean: {mean_recovery_trades} trades</div>
        </div>
        <div className={`kpi-card ${highBlow ? 'kpi-glow-neg' : ''}`}>
          <div className="kpi-label"><AlertTriangle size={12} /> Blowout Risk</div>
          <div className={`kpi-value ${highBlow ? 'neg' : 'pos'}`}>{pct(blowout_risk, 1)}</div>
          <div className="kpi-sub">{highBlow ? '⚠ High risk' : 'Acceptable'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={12} /> EV / Trade</div>
          <div className={`kpi-value ${posEV ? 'pos' : 'neg'}`}>${sf(ev_per_trade)}</div>
          <div className="kpi-sub">{posEV ? '✓ Positive edge' : '✗ Fix strategy'}</div>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="kpi-grid stagger">
        <div className="kpi-card">
          <div className="kpi-label"><TrendingDown size={12} /> Gain to Recover</div>
          <div className="kpi-value warn">{pct(gain_required_pct, 1)}</div>
          <div className="kpi-sub">${sf(gain_required_abs)} from ${sf(current_equity)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Shield size={12} /> Losses to Limit</div>
          <div className={`kpi-value ${consec_losses_to_overall_limit <= 3 ? 'neg' : consec_losses_to_overall_limit <= 5 ? 'warn' : 'pos'}`}>
            {consec_losses_to_overall_limit} <span style={{ fontSize: '13px', color: 'var(--color-text-mute)' }}>losses</span>
          </div>
          <div className="kpi-sub">{unit === 'r' ? `${sf(remR)}R` : `$${sf(remaining_dd_room)}`} remaining</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Activity size={12} /> Daily Limit</div>
          <div className={`kpi-value ${consec_losses_to_daily_limit <= 3 ? 'neg' : consec_losses_to_daily_limit <= 5 ? 'warn' : 'pos'}`}>
            {consec_losses_to_daily_limit} <span style={{ fontSize: '13px', color: 'var(--color-text-mute)' }}>losses</span>
          </div>
          <div className="kpi-sub">5% daily limit</div>
        </div>
        <div className={`kpi-card ${Math.abs(current_drawdown_pct) > 5 ? 'kpi-glow-neg' : ''}`}>
          <div className="kpi-label"><Activity size={12} /> Current Drawdown</div>
          <div className={`kpi-value ${Math.abs(current_drawdown_pct) > 5 ? 'neg' : Math.abs(current_drawdown_pct) > 2.5 ? 'warn' : 'pos'}`}>
            {fmt(Math.abs(current_drawdown_pct), Math.abs(current_drawdown_pct) / 100 * peak_equity, curR)}
          </div>
          <div className="kpi-sub">Max: {fmt(Math.abs(max_drawdown_pct), Math.abs(max_drawdown_abs), maxR)}</div>
        </div>
      </div>

      {/* Asymmetric Math */}
      <div className="card anim-fadeUp" style={{ animationDelay: '250ms' }}>
        <div className="card-title">The Asymmetric Math of Losses</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-mute)', marginBottom: '18px', lineHeight: 1.6 }}>
          When you lose, you need to gain more to recover — because you're working from a smaller base.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
          {[5, 10, 20, 30, 40, 50].map(dd => {
            const gain = 1 / (1 - dd / 100) - 1;
            const on = Math.abs(current_drawdown_pct) >= dd - 2 && Math.abs(current_drawdown_pct) < dd + 3;
            return (
              <div key={dd} style={{
                padding: '16px 12px', borderRadius: 'var(--r)', textAlign: 'center',
                background: on ? 'var(--color-acc-bg)' : 'var(--color-bg-surface)',
                border: on ? '1px solid var(--color-acc-border)' : '1px solid var(--color-border)',
                transition: 'all .2s ease',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{dd}% DD</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: dd >= 30 ? 'var(--color-neg)' : dd >= 20 ? 'var(--color-warn)' : 'var(--color-pos)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  +{(gain * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '4px' }}>to recover</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Underwater Curve */}
      {hasCurve ? (
        <div className="card anim-fadeUp" style={{ animationDelay: '350ms' }}>
          <div className="card-title">
            Underwater Curve
            <span style={{ fontSize: '11px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--color-text-mute)' }}>
              {unit === 'pct' ? '% of peak' : unit === 'abs' ? 'USD' : 'R Multiple'}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curve}>
              <defs>
                <linearGradient id="ddG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F87171" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
              <XAxis dataKey="date" tick={{ fill: '#5A6478', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis domain={[0, 'auto']} tick={{ fill: '#5A6478', fontSize: 10 }} tickFormatter={yFmt} />
              <Tooltip contentStyle={{ background: '#131720', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }} labelStyle={{ color: '#5A6478' }} formatter={tipFmt} />
              <Area type="monotone" dataKey={yK} stroke="#F87171" fill="url(#ddG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card"><p className="t-mute">No underwater curve data yet.</p></div>
      )}

      {/* Periods Table */}
      {hasPeriods ? (
        <div className="card anim-fadeUp" style={{ animationDelay: '450ms' }}>
          <div className="card-title">Drawdown Periods ({nb_drawdown_periods})</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Start</th><th>End</th><th>Depth ({unit === 'pct' ? '%' : unit === 'abs' ? '$' : 'R'})</th><th>Duration</th></tr></thead>
              <tbody>
                {[...drawdown_periods].sort((a: any, b: any) => a.depth_pct - b.depth_pct).map((p: any, i: number) => (
                  <tr key={i}>
                    <td>{p.start || '-'}</td>
                    <td>{p.end || '-'}</td>
                    <td className="t-neg" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {fmt(Math.abs(p.depth_pct), Math.abs(p.depth_abs), toR(Math.abs(p.depth_abs), avg_loss))}
                    </td>
                    <td className="t-mute">{p.duration_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><p className="t-mute">No drawdown periods detected.</p></div>
      )}
    </div>
  );
}
