// components/DrawdownAnalysis.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '../lib/api';
import { sf, pct, rfmt } from '../lib/safe';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, AlertTriangle, Clock, Target, Zap, Shield, Activity, DollarSign, Percent } from 'lucide-react';

type DdUnit = 'pct' | 'abs' | 'r';

interface Props { accountId?: number; dateFrom?: string; dateTo?: string; }

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

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (error || !data) return <div className="card"><p className="text-neg">Error loading drawdown analysis</p></div>;

  const {
    max_drawdown_pct, max_drawdown_abs, current_drawdown_pct,
    nb_drawdown_periods, drawdown_periods, underwater_curve,
    current_equity, peak_equity, gain_required_pct, gain_required_abs,
    avg_win, avg_loss, ev_per_trade, total_trades,
    consec_losses_to_overall_limit, consec_losses_to_daily_limit, remaining_dd_room,
    recovery_probability, blowout_risk, median_recovery_trades, mean_recovery_trades,
  } = data;

  const max_dd_r = toR(max_drawdown_abs, avg_loss);
  const current_dd_r = toR(Math.abs(current_drawdown_pct) / 100 * peak_equity, avg_loss);
  const remaining_r = toR(remaining_dd_room, avg_loss);

  function fmtDd(pctVal: number | null | undefined, absVal: number | null | undefined, rVal: number | null | undefined): string {
    if (unit === 'pct') return pct(pctVal, 2);
    if (unit === 'abs') return `$${sf(Math.abs(absVal))}`;
    if (unit === 'r') return rVal != null ? `${sf(rVal)}R` : '-';
    return '-';
  }

  const curveData = underwater_curve.map((p: any) => {
    const ddPct = Math.abs(Number(p.drawdown_pct) || 0);
    const ddAbs = ddPct / 100 * (peak_equity || 0);
    return { date: p.date, equity: Number(p.equity) || 0, pct: ddPct, abs: ddAbs, r: toR(ddAbs, avg_loss) ?? 0 };
  });

  const yKey = unit === 'pct' ? 'pct' : unit === 'abs' ? 'abs' : 'r';
  const yFmt = (v: number) => unit === 'pct' ? `${v.toFixed(1)}%` : unit === 'abs' ? `$${v.toFixed(0)}` : `${v.toFixed(1)}R`;
  const tipFmt = (value: any) => {
    const n = Number(value) || 0;
    return [unit === 'pct' ? `${n.toFixed(2)}%` : unit === 'abs' ? `$${n.toFixed(2)}` : `${n.toFixed(2)}R`, 'Drawdown'];
  };

  const hasData = curveData.length > 0;
  const hasPeriods = drawdown_periods.length > 0;
  const isPosEV = (ev_per_trade || 0) > 0;
  const isHealthyRec = (recovery_probability || 0) >= 70;
  const isHighBlow = (blowout_risk || 0) >= 40;

  const unitOpts: { key: DdUnit; label: string; icon: React.ReactNode }[] = [
    { key: 'pct', label: '%', icon: <Percent size={13} /> },
    { key: 'abs', label: '$', icon: <DollarSign size={13} /> },
    { key: 'r', label: 'R', icon: <Activity size={13} /> },
  ];

  return (
    <div className="animate-fadeIn">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--color-text-hi)' }}>Drawdown Analysis</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-mute)', marginTop: '4px' }}>Risk metrics & recovery simulation</p>
        </div>
        <div className="toggle-group">
          {unitOpts.map(o => (
            <button key={o.key} className={`toggle-btn ${unit === o.key ? 'active' : ''}`} onClick={() => setUnit(o.key)}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row 1 ── */}
      <div className="kpi-grid stagger">
        <div className={`kpi-card ${isHealthyRec ? 'glow-pos' : 'glow-warn'}`}>
          <div className="kpi-label"><Target size={13} /> Recovery Probability</div>
          <div className={`kpi-value ${isHealthyRec ? 'pos' : recovery_probability >= 40 ? 'warn' : 'neg'}`}>{pct(recovery_probability, 1)}</div>
          <div className="kpi-sub">{isHealthyRec ? 'Healthy edge' : recovery_probability >= 40 ? 'Moderate' : 'Math is against you'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Clock size={13} /> Median Recovery</div>
          <div className="kpi-value" style={{ fontSize: '24px' }}>{median_recovery_trades} <span style={{ fontSize: '14px', color: 'var(--color-text-mute)' }}>trades</span></div>
          <div className="kpi-sub">Mean: {mean_recovery_trades} trades</div>
        </div>
        <div className={`kpi-card ${isHighBlow ? 'glow-neg' : ''}`}>
          <div className="kpi-label"><AlertTriangle size={13} /> Blowout Risk</div>
          <div className={`kpi-value ${isHighBlow ? 'neg' : 'pos'}`}>{pct(blowout_risk, 1)}</div>
          <div className="kpi-sub">{isHighBlow ? 'High risk' : 'Acceptable'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Zap size={13} /> EV / Trade</div>
          <div className={`kpi-value ${isPosEV ? 'pos' : 'neg'}`}>${sf(ev_per_trade)}</div>
          <div className="kpi-sub">{isPosEV ? 'Positive edge ✓' : 'Negative — fix strategy'}</div>
        </div>
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="kpi-grid stagger">
        <div className="kpi-card">
          <div className="kpi-label"><TrendingDown size={13} /> Gain to Recover</div>
          <div className="kpi-value warn">{pct(gain_required_pct, 1)}</div>
          <div className="kpi-sub">${sf(gain_required_abs)} from ${sf(current_equity)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Shield size={13} /> Losses to Limit</div>
          <div className={`kpi-value ${consec_losses_to_overall_limit <= 3 ? 'neg' : consec_losses_to_overall_limit <= 5 ? 'warn' : 'pos'}`}>
            {consec_losses_to_overall_limit} <span style={{ fontSize: '14px', color: 'var(--color-text-mute)' }}>losses</span>
          </div>
          <div className="kpi-sub">{unit === 'r' ? `${sf(remaining_r)}R` : `$${sf(remaining_dd_room)}`} remaining</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Activity size={13} /> Daily Limit</div>
          <div className={`kpi-value ${consec_losses_to_daily_limit <= 3 ? 'neg' : consec_losses_to_daily_limit <= 5 ? 'warn' : 'pos'}`}>
            {consec_losses_to_daily_limit} <span style={{ fontSize: '14px', color: 'var(--color-text-mute)' }}>losses</span>
          </div>
          <div className="kpi-sub">5% daily limit</div>
        </div>
        <div className={`kpi-card ${Math.abs(current_drawdown_pct) > 5 ? 'glow-neg' : ''}`}>
          <div className="kpi-label"><Activity size={13} /> Current Drawdown</div>
          <div className={`kpi-value ${Math.abs(current_drawdown_pct) > 5 ? 'neg' : Math.abs(current_drawdown_pct) > 2.5 ? 'warn' : 'pos'}`}>
            {fmtDd(Math.abs(current_drawdown_pct), Math.abs(current_drawdown_pct) / 100 * peak_equity, current_dd_r)}
          </div>
          <div className="kpi-sub">Max: {fmtDd(Math.abs(max_drawdown_pct), Math.abs(max_drawdown_abs), max_dd_r)}</div>
        </div>
      </div>

      {/* ── Asymmetric Math ── */}
      <div className="card animate-fadeInScale" style={{ animationDelay: '200ms' }}>
        <div className="card-title">The Asymmetric Math</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-mute)', marginBottom: '16px', lineHeight: 1.6 }}>
          You always need to gain more than you lost to recover, because you're growing a smaller base.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
          {[5, 10, 20, 30, 40, 50].map(dd => {
            const gain = 1 / (1 - dd / 100) - 1;
            const isCurrent = Math.abs(current_drawdown_pct) >= dd - 2 && Math.abs(current_drawdown_pct) < dd + 3;
            return (
              <div key={dd} style={{
                padding: '14px 12px', borderRadius: 'var(--radius)', textAlign: 'center',
                background: isCurrent ? 'var(--color-acc-bg)' : 'var(--color-bg-card-2)',
                border: isCurrent ? '1px solid var(--color-acc-border)' : '1px solid var(--color-border)',
                transition: 'all .2s ease',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-mute)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{dd}% DD</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: dd >= 30 ? 'var(--color-neg)' : dd >= 20 ? 'var(--color-warn)' : 'var(--color-pos)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  +{(gain * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', marginTop: '4px' }}>to recover</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Underwater Curve ── */}
      {hasData ? (
        <div className="card animate-fadeInScale" style={{ animationDelay: '300ms' }}>
          <div className="card-title">
            Underwater Curve
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-mute)', textTransform: 'none', letterSpacing: 0 }}>
              {unit === 'pct' ? '% of peak' : unit === 'abs' ? 'USD' : 'R Multiple'}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curveData}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F87171" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="date" tick={{ fill: '#6B7488', fontSize: 10 }} tickFormatter={(v: string) => v?.slice(5) || ''} />
              <YAxis domain={[0, 'auto']} tick={{ fill: '#6B7488', fontSize: 10 }} tickFormatter={yFmt} />
              <Tooltip
                contentStyle={{ background: '#141820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: '#6B7488' }}
                formatter={tipFmt}
              />
              <Area type="monotone" dataKey={yKey} stroke="#F87171" fill="url(#ddGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card"><p className="text-mute">No underwater curve data yet.</p></div>
      )}

      {/* ── Periods Table ── */}
      {hasPeriods ? (
        <div className="card animate-fadeInScale" style={{ animationDelay: '400ms' }}>
          <div className="card-title">Drawdown Periods ({nb_drawdown_periods})</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>End</th>
                  <th>Depth ({unit === 'pct' ? '%' : unit === 'abs' ? '$' : 'R'})</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...drawdown_periods].sort((a: any, b: any) => a.depth_pct - b.depth_pct).map((p: any, i: number) => (
                  <tr key={i}>
                    <td>{p.start || '-'}</td>
                    <td>{p.end || '-'}</td>
                    <td className="text-neg" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {fmtDd(Math.abs(p.depth_pct), Math.abs(p.depth_abs), toR(Math.abs(p.depth_abs), avg_loss))}
                    </td>
                    <td className="text-mute">{p.duration_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><p className="text-mute">No drawdown periods detected.</p></div>
      )}
    </div>
  );
}
