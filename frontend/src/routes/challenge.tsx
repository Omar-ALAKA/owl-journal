// routes/challenge.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentChallenge, fetchCheckpoints, createCheckpoint, fetchViolations } from '../lib/api';
import type { ChallengeData, Checkpoint, Violation } from '../types';
import { Trophy, AlertTriangle, Shield, Plus, X } from 'lucide-react';
import { useState } from 'react';

export function ChallengePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'checkpoints' | 'violations'>('overview');
  const [showCpModal, setShowCpModal] = useState(false);
  const [cpForm, setCpForm] = useState({ checkpoint_type: 'daily', balance: '', equity: '', drawdown: '', notes: '' });

  const { data: challengeData } = useQuery({
    queryKey: ['challenge-current'],
    queryFn: () => fetchCurrentChallenge().catch(() => ({ active: false, challenges: [], count: 0 })),
    refetchInterval: 30000,
  });

  const { data: checkpointsData } = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => fetchCheckpoints().catch(() => ({ checkpoints: [], total: 0 })),
  });

  const { data: violationsData } = useQuery({
    queryKey: ['violations'],
    queryFn: () => fetchViolations().catch(() => ({ violations: [], total_accounts_checked: 0, accounts_with_violations: 0 })),
  });

  const challenges: ChallengeData[] = challengeData?.challenges || [];
  const checkpoints: Checkpoint[] = checkpointsData?.checkpoints || [];
  const violations: Violation[] = violationsData?.violations || [];

  const handleAddCheckpoint = async () => {
    if (challenges.length === 0) return;
    await createCheckpoint({
      account_id: challenges[0].id,
      checkpoint_type: cpForm.checkpoint_type,
      balance: parseFloat(cpForm.balance) || 0,
      equity: parseFloat(cpForm.equity) || 0,
      drawdown: parseFloat(cpForm.drawdown) || 0,
      notes: cpForm.notes,
    });
    qc.invalidateQueries({ queryKey: ['checkpoints'] });
    qc.invalidateQueries({ queryKey: ['challenge-current'] });
    setShowCpModal(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Challenge Tracker</h1>
        {challenges.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowCpModal(true)}><Plus size={16} /> Add Checkpoint</button>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'checkpoints' ? 'active' : ''}`} onClick={() => setTab('checkpoints')}>Checkpoints</button>
        <button className={`tab ${tab === 'violations' ? 'active' : ''}`} onClick={() => setTab('violations')}>Violations</button>
      </div>

      {tab === 'overview' && (
        <>
          {challenges.length === 0 ? (
            <div className="empty-state">
              <Trophy size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p>No active challenge. Create a challenge-type account to start tracking!</p>
            </div>
          ) : challenges.map(c => (
            <div key={c.id}>
              {/* Progress bar */}
              <div className="card" style={{ borderLeft: c.challenge_complete ? '4px solid #34D399' : '4px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.name}
                      {c.challenge_complete && (
                        <span style={{
                          background: '#34D399', color: '#000', fontSize: '10px', fontWeight: 800,
                          padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px',
                        }}>COMPLETED</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{c.broker} · {c.phase}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '20px' }} className={c.net_pnl >= 0 ? 'text-green' : 'text-red'}>
                      {c.net_pnl >= 0 ? '+' : ''}${c.net_pnl.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{c.net_pnl_pct.toFixed(1)}% ROI</div>
                  </div>
                </div>

                {/* Target progress */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span className="text-muted">Progress to target</span>
                    <span className="text-accent">{c.progress_pct.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill accent" style={{ width: `${Math.min(c.progress_pct, 100)}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    <span>${c.starting_balance.toFixed(0)}</span>
                    <span>Target: ${c.target_equity.toFixed(0)}</span>
                  </div>
                </div>

                {/* Drawdown bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span className="text-muted">Drawdown</span>
                    <span className="text-red">{c.max_drawdown_pct.toFixed(1)}% / {c.drawdown_limit_pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill red" style={{ width: `${Math.min((c.max_drawdown_pct / c.drawdown_limit_pct) * 100, 100)}%` }} />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="kpi-grid" style={{ marginTop: '20px' }}>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Win Rate</div>
                    <div className="kpi-value">{c.win_rate.toFixed(1)}%</div>
                    <div className="kpi-sub">{c.wins}W / {c.losses}L</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Total Trades</div>
                    <div className="kpi-value">{c.total_trades}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Avg P&L</div>
                    <div className={`kpi-value ${c.avg_pnl >= 0 ? 'green' : 'red'}`}>${c.avg_pnl.toFixed(2)}</div>
                  </div>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Best / Worst</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      <span className="text-green">+${c.best_trade.toFixed(2)}</span>
                      <span className="text-muted"> / </span>
                      <span className="text-red">${c.worst_trade.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Target</div>
                    <div className={`kpi-value ${c.target_reached ? 'green' : ''}`}>
                      {c.target_reached ? 'Reached' : 'Pending'}
                    </div>
                  </div>
                  <div className="kpi-card" style={{ padding: '14px' }}>
                    <div className="kpi-label">Rules</div>
                    <div className={`kpi-value ${c.rules_respected ? 'green' : 'red'}`}>
                      {c.rules_respected ? 'Respected' : 'Violated'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'checkpoints' && (
        <div>
          {checkpoints.length === 0 ? (
            <div className="empty-state"><p>No checkpoints yet.</p></div>
          ) : (
            <table className="trade-table">
              <thead><tr><th>Date</th><th>Type</th><th>Balance</th><th>Equity</th><th>Drawdown</th><th>Notes</th></tr></thead>
              <tbody>
                {checkpoints.map(cp => (
                  <tr key={cp.id}>
                    <td>{cp.created_at?.split('T')[0] || '-'}</td>
                    <td><span className="badge badge-accent">{cp.checkpoint_type}</span></td>
                    <td>${cp.balance.toFixed(2)}</td>
                    <td>${cp.equity.toFixed(2)}</td>
                    <td className="text-red">${cp.drawdown.toFixed(2)}</td>
                    <td className="text-muted">{cp.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'violations' && (
        <div>
          {violations.length === 0 ? (
            <div className="empty-state"><p>No accounts to check.</p></div>
          ) : violations.map(v => (
            <div key={v.account_id} className="card" style={{ borderLeft: v.violation_count > 0 ? '3px solid var(--color-red)' : '3px solid var(--color-green)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                {v.violation_count > 0 ? <AlertTriangle size={18} color="var(--color-red)" /> : <Shield size={18} color="var(--color-green)" />}
                <span style={{ fontWeight: 700 }}>{v.account_name}</span>
                <span className={`badge ${v.violation_count > 0 ? 'badge-red' : 'badge-green'}`}>
                  {v.violation_count > 0 ? `${v.violation_count} violation(s)` : 'Clean'}
                </span>
              </div>
              {v.violations.map((vi, i) => (
                <div key={i} style={{ fontSize: '13px', color: 'var(--color-red)', padding: '4px 0' }}>
                  ⚠ {vi.type === 'max_drawdown_exceeded' ? `Max DD exceeded: ${vi.value}% (limit: ${vi.limit}%)` : `Daily loss on ${vi.date}: ${vi.daily_loss_pct}% (limit: ${vi.limit}%)`}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showCpModal && (
        <div className="modal-overlay" onClick={() => setShowCpModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Checkpoint</h2>
              <button className="modal-close" onClick={() => setShowCpModal(false)}><X size={20} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={cpForm.checkpoint_type} onChange={e => setCpForm({ ...cpForm, checkpoint_type: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="phase_complete">Phase Complete</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Balance</label>
                <input className="form-input" type="number" value={cpForm.balance} onChange={e => setCpForm({ ...cpForm, balance: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Equity</label>
                <input className="form-input" type="number" value={cpForm.equity} onChange={e => setCpForm({ ...cpForm, equity: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={cpForm.notes} onChange={e => setCpForm({ ...cpForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCpModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddCheckpoint}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
