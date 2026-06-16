// routes/accounts.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAccounts, createAccount, updateAccount, deleteAccount } from '../lib/api';
import type { Account } from '../types';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

export function AccountsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts = data?.accounts || [];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: '', broker: '', broker_acct: '', account_type: 'challenge' as 'challenge' | 'funded' | 'personal',
    phase: '', status: 'active', starting_balance: '', target_profit_pct: '10',
    max_drawdown_pct: '7', daily_loss_pct: '5', min_trading_days: '0', personal_target_pct: '5', notes: '',
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', broker: '', broker_acct: '', account_type: 'challenge', phase: '', status: 'active', starting_balance: '', target_profit_pct: '10', max_drawdown_pct: '7', daily_loss_pct: '5', min_trading_days: '0', personal_target_pct: '5', notes: '' });
    setShowModal(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      name: a.name, broker: a.broker || '', broker_acct: a.broker_acct || '',
      account_type: a.account_type, phase: a.phase || '', status: a.status,
      starting_balance: String(a.starting_balance), target_profit_pct: String(a.target_profit_pct),
      max_drawdown_pct: String(a.max_drawdown_pct), daily_loss_pct: String(a.daily_loss_pct),
      min_trading_days: String(a.min_trading_days ?? 0), personal_target_pct: String((a as any).personal_target_pct ?? 5), notes: a.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = { ...form, starting_balance: parseFloat(form.starting_balance) || 0, target_profit_pct: parseFloat(form.target_profit_pct) || 10, max_drawdown_pct: parseFloat(form.max_drawdown_pct) || 7, daily_loss_pct: parseFloat(form.daily_loss_pct) || 5, min_trading_days: parseInt(form.min_trading_days) || 0, personal_target_pct: parseFloat(form.personal_target_pct) || 5 };
    try {
      if (editing) {
        await updateAccount(editing.id, payload);
      } else {
        await createAccount(payload);
      }
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowModal(false);
      toast.success(editing ? 'Compte mis à jour' : 'Compte créé');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur: ' + msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this account and all its trades?')) return;
    try {
      await deleteAccount(id);
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Compte supprimé');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur: ' + msg);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Accounts</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Account</button>
      </div>

      {isLoading ? <p className="text-muted">Loading...</p> : accounts.length === 0 ? (
        <div className="empty-state"><p>No accounts yet. Create your first account!</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {accounts.map(a => {
            const badgeColor = a.account_type === 'funded' ? '#E8A838' : a.account_type === 'challenge' ? '#7C5CFC' : '#22C55E';
            const balance = a.current_balance ?? 0;
            const starting = a.starting_balance ?? 0;
            const hasTrades = balance !== 0 || starting !== 0;
            const progressPct = starting > 0 ? Math.min(100, (balance / starting) * 100) : 0;
            return (
              <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{a.name}</span>
                    <span className="badge" style={{ background: badgeColor + '22', color: badgeColor, fontSize: '10px', padding: '1px 8px' }}>{a.account_type}</span>
                    <span className={a.status === 'active' ? 'text-green' : 'text-muted'} style={{ fontSize: '12px' }}>{a.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {a.broker || 'No broker'} {a.phase ? `· ${a.phase}` : ''}
                  </div>
                  {hasTrades ? (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>${balance.toFixed(2)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>from ${starting.toFixed(2)}</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: balance >= starting ? 'var(--color-profit)' : 'var(--color-loss)', borderRadius: '2px', transition: 'width .3s' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>Aucun trade importé</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
                  <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--color-text-secondary)', padding: '4px 8px' }} onClick={() => openEdit(a)}><Edit2 size={14} /></button>
                  <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--color-loss)', padding: '4px 8px', opacity: 0.5 }} onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Account' : 'New Account'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. FTMO Challenge" />
              </div>
              <div className="form-group">
                <label className="form-label">Broker</label>
                <input className="form-input" value={form.broker} onChange={e => setForm({ ...form, broker: e.target.value })} placeholder="e.g. FTMO" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value as 'challenge' | 'funded' | 'personal' })}>
                  <option value="challenge">Challenge</option>
                  <option value="funded">Funded</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phase</label>
                <input className="form-input" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} placeholder="e.g. Phase 1" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Starting Balance</label>
                <input className="form-input" type="number" value={form.starting_balance} onChange={e => setForm({ ...form, starting_balance: e.target.value })} placeholder="10000" />
              </div>
              <div className="form-group">
                <label className="form-label">Target Profit %</label>
                <input className="form-input" type="number" value={form.target_profit_pct} onChange={e => setForm({ ...form, target_profit_pct: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Max Drawdown %</label>
                <input className="form-input" type="number" value={form.max_drawdown_pct} onChange={e => setForm({ ...form, max_drawdown_pct: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Daily Loss %</label>
                <input className="form-input" type="number" value={form.daily_loss_pct} onChange={e => setForm({ ...form, daily_loss_pct: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Minimum Trading Days (0 = no minimum)</label>
                <input className="form-input" type="number" min="0" value={form.min_trading_days} onChange={e => setForm({ ...form, min_trading_days: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Personal Target % (funded)</label>
                <input className="form-input" type="number" step="0.5" value={form.personal_target_pct} onChange={e => setForm({ ...form, personal_target_pct: e.target.value })} placeholder="5" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
