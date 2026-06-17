// routes/funded.tsx — Funded Account Dashboard
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchFundedAccounts, fetchFundedSummary,
  createPayout, updatePayout, deletePayout,
} from '../lib/api';
import type { FundedAccount, FundedSummary, PayoutRecord } from '../types';
import { Wallet, TrendingUp, Target, Plus, X, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export function FundedPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [editingPayout, setEditingPayout] = useState<PayoutRecord | null>(null);
  const [payoutForm, setPayoutForm] = useState({ amount: '', payout_date: '', status: 'pending', notes: '' });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['funded-accounts'],
    queryFn: () => fetchFundedAccounts().catch(() => ({ accounts: [], count: 0 })),
    refetchInterval: 30000,
  });

  const accounts: FundedAccount[] = listData?.accounts || [];
  const selectedAccount = selectedId ? accounts.find(a => a.id === selectedId) : null;

  const { data: summaryData } = useQuery({
    queryKey: ['funded-summary', selectedId],
    queryFn: () => fetchFundedSummary(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 15000,
  });

  const selected: FundedSummary | FundedAccount | null = (summaryData ?? selectedAccount) || null;
  const summary: FundedSummary | null = summaryData as FundedSummary | null;

  const handleAddPayout = () => {
    setEditingPayout(null);
    setPayoutForm({ amount: '', payout_date: format(new Date(), 'yyyy-MM-dd'), status: 'pending', notes: '' });
    setShowPayoutModal(true);
  };

  const handleEditPayout = (p: PayoutRecord) => {
    setEditingPayout(p);
    setPayoutForm({ amount: String(p.amount), payout_date: p.payout_date, status: p.status, notes: p.notes || '' });
    setShowPayoutModal(true);
  };

  const handleSavePayout = async () => {
    if (!selectedId) return;
    try {
      if (editingPayout) {
        await updatePayout(selectedId, editingPayout.id, {
          account_id: selectedId,
          amount: parseFloat(payoutForm.amount) || 0,
          payout_date: payoutForm.payout_date,
          status: payoutForm.status,
          notes: payoutForm.notes,
        });
      } else {
        await createPayout(selectedId, {
          account_id: selectedId,
          amount: parseFloat(payoutForm.amount) || 0,
          payout_date: payoutForm.payout_date,
          status: payoutForm.status,
          notes: payoutForm.notes,
        });
      }
      qc.invalidateQueries({ queryKey: ['funded-summary', selectedId] });
      qc.invalidateQueries({ queryKey: ['funded-accounts'] });
      setShowPayoutModal(false);
      toast.success(editingPayout ? 'Payout mis à jour' : 'Payout ajouté');
    } catch (e: any) {
      toast.error('Erreur: ' + (e.message || 'Impossible d\'enregistrer le payout'));
    }
  };

  const handleDeletePayout = async (payoutId: number) => {
    if (!selectedId || !confirm('Supprimer ce payout ?')) return;
    try {
      await deletePayout(selectedId, payoutId);
      qc.invalidateQueries({ queryKey: ['funded-summary', selectedId] });
      qc.invalidateQueries({ queryKey: ['funded-accounts'] });
      toast.success('Payout supprimé');
    } catch (e: any) {
      toast.error('Erreur: ' + (e.message || 'Impossible de supprimer'));
    }
  };

  if (listLoading) return <div className="page"><div className="spinner" />Chargement...</div>;

  if (accounts.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><h1>Funded Accounts</h1></div>
        <div className="empty-state">
          <Wallet size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>Aucun compte funded. Créez un compte de type "Funded" dans Accounts pour commencer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Funded Accounts</h1>
        {selectedId && (
          <button className="btn btn-primary" onClick={handleAddPayout}>
            <Plus size={16} /> Nouveau Payout
          </button>
        )}
      </div>

      {/* Account selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {accounts.map(a => (
          <button
            key={a.id}
            className="btn"
            onClick={() => setSelectedId(a.id)}
            style={{
              background: selectedId === a.id ? 'var(--color-accent)' : 'var(--color-surface)',
              color: selectedId === a.id ? '#fff' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {a.name}
            <span style={{ marginLeft: '6px', opacity: 0.7, fontWeight: 400 }}>{a.broker}</span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Equity & PnL */}
          <div className="kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="kpi-card">
              <div className="kpi-label">Starting Balance</div>
              <div className="kpi-value">{selected.starting_balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Current Equity</div>
              <div className={`kpi-value ${selected.current_equity >= selected.starting_balance ? 'green' : 'red'}`}>
                {selected.current_equity.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Net P&L</div>
              <div className={`kpi-value ${selected.net_pnl >= 0 ? 'green' : 'red'}`}>
                {selected.net_pnl >= 0 ? '+' : ''}{selected.net_pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </div>
              <div className="kpi-sub" style={{ fontSize: '11px' }}>{selected.net_pnl_pct}% ROI</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Payouts</div>
              <div className="kpi-value green">
                {(summary?.total_payouts || selected.total_payouts || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Win Rate</div>
              <div className="kpi-value">{selected.win_rate.toFixed(1)}%</div>
              <div className="kpi-sub">{selected.wins}W / {selected.losses}L ({selected.total_trades})</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Max Drawdown</div>
              <div className={`kpi-value ${selected.max_drawdown_pct > (selected.drawdown_limit_pct * 0.8) ? 'red' : ''}`}>
                {selected.max_drawdown_pct.toFixed(1)}%
              </div>
              <div className="kpi-sub">Limit: {selected.drawdown_limit_pct}%</div>
            </div>
          </div>

          {/* Personal Goal */}
          <div className="card" style={{ marginBottom: '20px', borderLeft: selected.personal_target_reached ? '4px solid var(--color-profit)' : '4px solid var(--color-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Target size={18} className="text-accent" />
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Objectif Perso</span>
              {selected.personal_target_reached && (
                <span style={{
                  background: 'var(--color-profit)', color: '#000', fontSize: '10px', fontWeight: 800,
                  padding: '2px 8px', borderRadius: '4px',
                }}>ATTEINT ✓</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span className="text-muted">
                Progression vers {selected.personal_target_pct}% ({selected.personal_target_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})
              </span>
              <span className="text-accent" style={{ fontWeight: 700 }}>
                {selected.personal_progress_pct.toFixed(1)}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill accent"
                style={{ width: `${Math.min(Math.max(selected.personal_progress_pct, 0), 100)}%` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              <span>$0</span>
              <span>{selected.personal_target_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
            </div>
          </div>

          {/* Drawdown bar */}
          <div className="card" style={{ 
            marginBottom: '20px',
            borderLeft: `4px solid ${
              summary?.drawdown_status === 'breached' ? 'var(--color-loss)' :
              summary?.drawdown_status === 'danger' ? 'var(--color-loss)' :
              summary?.drawdown_status === 'warning' ? 'var(--color-warning)' :
              'var(--color-profit)'
            }`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <TrendingUp size={18} className="text-red" />
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Drawdown</span>
              {summary?.drawdown_status === 'safe' && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-profit)22', color: 'var(--color-profit)' }}>
                  ✓ SAFE
                </span>
              )}
              {summary?.drawdown_status === 'warning' && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-warning)22', color: 'var(--color-warning)' }}>
                  ⚠ ATTENTION
                </span>
              )}
              {summary?.drawdown_status === 'danger' && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-loss)22', color: 'var(--color-loss)' }}>
                  🔴 DANGER
                </span>
              )}
              {summary?.drawdown_status === 'breached' && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-loss)', color: '#fff' }}>
                  ✕ BREACHED
                </span>
              )}
            </div>
            {summary && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                Marge restante: <span style={{ fontWeight: 700, color: summary.drawdown_remaining_pct < 2 ? 'var(--color-loss)' : 'var(--color-text-primary)' }}>
                  {summary.drawdown_remaining_pct.toFixed(1)}%
                </span>
                {summary.current_drawdown_pct > 0 && (
                  <span style={{ marginLeft: '12px', color: 'var(--color-text-muted)' }}>
                    DD actuel: <span style={{ fontWeight: 700, color: 'var(--color-loss)' }}>{summary.current_drawdown_pct.toFixed(1)}%</span>
                  </span>
                )}
                {summary.current_drawdown_pct === 0 && (
                  <span style={{ marginLeft: '12px', color: 'var(--color-profit)', fontWeight: 700 }}>
                    ✓ Au peak — aucun drawdown
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span className="text-muted">Drawdown max</span>
              <span className="text-red" style={{ fontWeight: 700 }}>
                {selected.max_drawdown_pct.toFixed(1)}% / {selected.drawdown_limit_pct}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill red"
                style={{ width: `${Math.min((selected.max_drawdown_pct / selected.drawdown_limit_pct) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Payout History */}
          {summary && summary.payouts && summary.payouts.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Wallet size={18} style={{ color: 'var(--color-profit)' }} />
                <span style={{ fontWeight: 700, fontSize: '15px' }}>Historique Payouts</span>
                <span className="badge badge-green" style={{ fontSize: '10px' }}>
                  {summary.payouts.length} payout{summary.payouts.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.payouts.map(p => {
                  const statusColor = p.status === 'paid' ? 'var(--color-profit)' : p.status === 'approved' ? 'var(--color-accent)' : 'var(--color-warning)';
                  return (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'var(--color-bg)', borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }} className="text-green">
                          +${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {format(new Date(p.payout_date), 'dd MMM yyyy')}
                          {p.notes && ` · ${p.notes}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          background: statusColor + '22', color: statusColor, textTransform: 'uppercase',
                        }}>{p.status}</span>
                        <button className="btn btn-sm" style={{ background: 'transparent', padding: '4px' }} onClick={() => handleEditPayout(p)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-sm" style={{ background: 'transparent', padding: '4px', color: 'var(--color-loss)' }} onClick={() => handleDeletePayout(p.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPayout ? 'Modifier Payout' : 'Nouveau Payout'}</h2>
              <button className="modal-close" onClick={() => setShowPayoutModal(false)}><X size={20} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant ($) *</label>
                <input className="form-input" type="number" value={payoutForm.amount} onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })} placeholder="500.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={payoutForm.payout_date} onChange={e => setPayoutForm({ ...payoutForm, payout_date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Statut</label>
              <select className="form-select" value={payoutForm.status} onChange={e => setPayoutForm({ ...payoutForm, status: e.target.value })}>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="paid">Payé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={payoutForm.notes} onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })} placeholder="Payout semaine 3..." />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowPayoutModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSavePayout}>{editingPayout ? 'Modifier' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
