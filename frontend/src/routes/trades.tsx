// routes/trades.tsx
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrades, deleteTrade, fetchAccounts, updateTrade } from '../lib/api';
import type { Trade, Account } from '../types';
import { Trash2, Filter, X, Edit2 } from 'lucide-react';
import { sf, pnl as fmtPnl, rfmt as fmtR } from '../lib/safe';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
const fmt = sf;

// Custom Select component (shadcn-style without the dependency)
function CustomSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '8px 12px', background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border)', borderRadius: 8,
          color: 'var(--color-text-primary)', fontSize: 13, textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span>{selected?.label || placeholder || 'Select...'}</span>
        <span style={{ opacity: 0.5 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                width: '100%', padding: '8px 12px', background: o.value === value ? 'var(--color-accent-soft)' : 'transparent',
                color: o.value === value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TradesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editForm, setEditForm] = useState<Partial<Trade>>({});
  const limit = 50;

  const { data } = useQuery({
    queryKey: ['trades', page, filters],
    queryFn: () => fetchTrades({ limit, offset: page * limit, ...filters }).catch(() => ({ trades: [], total: 0 })),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });

  const trades: Trade[] = data?.trades || [];
  const total = data?.total || 0;
  const accounts: Account[] = accountsData?.accounts || [];
  const totalPages = Math.ceil(total / limit);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this trade?')) return;
    try {
      await deleteTrade(id);
      qc.invalidateQueries({ queryKey: ['trades'] });
      toast.success('Trade supprimé');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur: ' + msg);
    }
  };

  const openEdit = (t: Trade) => {
    setEditingTrade(t);
    setEditForm({
      symbol: t.symbol,
      direction: t.direction,
      volume: t.volume,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      sl_price: t.sl_price,
      tp_price: t.tp_price,
      commission: t.commission,
      swap: t.swap,
      profit: t.profit,
      rr_target: t.rr_target,
      rr_actual: t.rr_actual,
      r_multiple: t.r_multiple,
      session: t.session,
      setup: t.setup,
      notes: t.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTrade) return;
    try {
      await updateTrade(editingTrade.id, editForm);
      qc.invalidateQueries({ queryKey: ['trades'] });
      setEditingTrade(null);
      toast.success('Trade mis à jour');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error('Erreur: ' + msg);
    }
  };

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Trades <span className="text-muted" style={{ fontSize: '14px', fontWeight: 400 }}>({total})</span></h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /> Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ minWidth: '140px' }}>
              <label className="form-label">Account</label>
              <select className="form-select" value={filters.account_id || ''} onChange={e => setFilters({ ...filters, account_id: e.target.value })}>
                <option value="">All</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '120px' }}>
              <label className="form-label">Session</label>
              <select className="form-select" value={filters.session || ''} onChange={e => setFilters({ ...filters, session: e.target.value })}>
                <option value="">All</option>
                <option value="Asia">Asia</option>
                <option value="London">London</option>
                <option value="New York">New York</option>
                <option value="Late NY">Late NY</option>
              </select>
            </div>
            <div style={{ minWidth: '120px' }}>
              <label className="form-label">Direction</label>
              <select className="form-select" value={filters.direction || ''} onChange={e => setFilters({ ...filters, direction: e.target.value })}>
                <option value="">All</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div style={{ minWidth: '140px' }}>
              <label className="form-label">Setup</label>
              <input className="form-input" value={filters.setup || ''} onChange={e => setFilters({ ...filters, setup: e.target.value })} placeholder="Filter..." />
            </div>
            {activeFilters.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setFilters({})}><X size={14} /> Clear</button>
            )}
          </div>
        </div>
      )}

      {trades.length === 0 ? (
        <div className="empty-state"><p>No trades found. Import your first CSV/XLSX file!</p></div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>Dir</th>
                  <th>Volume</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>P&L</th>
                  <th>RR Target</th>
                  <th>RR Actual</th>
                  <th>Session</th>
                  <th>Setup</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.open_time ? format(parseISO(t.open_time), 'dd MMM yyyy, HH:mm') : '-'}</td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td>
                      <span style={{
                        fontWeight: 700, fontSize: '11px', padding: '2px 6px', borderRadius: '3px',
                        background: t.direction === 'long' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                        color: t.direction === 'long' ? '#34D399' : '#F87171',
                      }}>
                        {t.direction === 'long' ? 'LONG' : t.direction === 'short' ? 'SHORT' : '-'}
                      </span>
                    </td>
                    <td>{fmt(t.volume, 2)}</td>
                    <td className="col-price">{sf(t.entry_price, 2)}</td>
                    <td className="col-price">{sf(t.exit_price, 2)}</td>
                    <td className="col-price">{sf(t.sl_price, 2)}</td>
                    <td className="col-price">{sf(t.tp_price, 2)}</td>
                    <td className={t.profit >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                      {fmtPnl(t.profit)}
                    </td>
                    <td className="text-muted">{fmtR(t.rr_target)}</td>
                    <td className={(t.rr_actual || 0) >= 0 ? 'text-green' : 'text-red'}>{fmtR(t.rr_actual)}</td>
                    <td>{t.session ? <span className="badge badge-blue">{t.session}</span> : '-'}</td>
                    <td className="text-muted">{t.setup || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}><Edit2 size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Edit Trade Modal */}
      {editingTrade && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(4px)' }} onClick={() => setEditingTrade(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Edit Trade #{editingTrade.id}</h2>
              <button className="modal-close" onClick={() => setEditingTrade(null)}><X size={20} /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Symbol</label>
                <input className="form-input" value={editForm.symbol || ''} onChange={e => setEditForm({ ...editForm, symbol: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Direction</label>
                <CustomSelect value={editForm.direction || 'long'} onChange={v => setEditForm({ ...editForm, direction: v as 'long' | 'short' })}
                  options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Volume</label>
                <input className="form-input" type="number" step="0.01" value={editForm.volume ?? ''} onChange={e => setEditForm({ ...editForm, volume: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Entry Price</label>
                <input className="form-input" type="number" step="0.0001" value={editForm.entry_price ?? ''} onChange={e => setEditForm({ ...editForm, entry_price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Exit Price</label>
                <input className="form-input" type="number" step="0.0001" value={editForm.exit_price ?? ''} onChange={e => setEditForm({ ...editForm, exit_price: parseFloat(e.target.value) || undefined })} />
              </div>
              <div className="form-group">
                <label className="form-label">SL Price</label>
                <input className="form-input" type="number" step="0.0001" value={editForm.sl_price ?? ''} onChange={e => setEditForm({ ...editForm, sl_price: parseFloat(e.target.value) || undefined })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">TP Price</label>
                <input className="form-input" type="number" step="0.0001" value={editForm.tp_price ?? ''} onChange={e => setEditForm({ ...editForm, tp_price: parseFloat(e.target.value) || undefined })} />
              </div>
              <div className="form-group">
                <label className="form-label">Profit</label>
                <input className="form-input" type="number" step="0.01" value={editForm.profit ?? ''} onChange={e => setEditForm({ ...editForm, profit: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">RR Target</label>
                <input className="form-input" type="number" step="0.1" value={editForm.rr_target ?? ''} onChange={e => setEditForm({ ...editForm, rr_target: parseFloat(e.target.value) || undefined })} />
              </div>
              <div className="form-group">
                <label className="form-label">RR Actual</label>
                <input className="form-input" type="number" step="0.1" value={editForm.rr_actual ?? ''} onChange={e => setEditForm({ ...editForm, rr_actual: parseFloat(e.target.value) || undefined })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">R Multiple</label>
                <input className="form-input" type="number" step="0.1" value={editForm.r_multiple ?? ''} onChange={e => setEditForm({ ...editForm, r_multiple: parseFloat(e.target.value) || undefined })} />
              </div>
              <div className="form-group">
                <label className="form-label">Commission</label>
                <input className="form-input" type="number" step="0.01" value={editForm.commission ?? ''} onChange={e => setEditForm({ ...editForm, commission: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Swap</label>
                <input className="form-input" type="number" step="0.01" value={editForm.swap ?? ''} onChange={e => setEditForm({ ...editForm, swap: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Session</label>
                <CustomSelect value={editForm.session || ''} onChange={v => setEditForm({ ...editForm, session: v })}
                  options={[
                    { value: '', label: '-' },
                    { value: 'Asia', label: 'Asia' },
                    { value: 'London', label: 'London' },
                    { value: 'New York', label: 'New York' },
                    { value: 'London/NY', label: 'London/NY' },
                    { value: 'Other', label: 'Other' },
                  ]} placeholder="-" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Setup</label>
                <input className="form-input" value={editForm.setup || ''} onChange={e => setEditForm({ ...editForm, setup: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" style={{ minHeight: 80, fontSize: 13 }} value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn" style={{ background: 'transparent', color: 'var(--color-loss)', border: '1px solid var(--color-loss)' }} onClick={() => { handleDelete(editingTrade.id); setEditingTrade(null); }}><Trash2 size={14} /> Delete</button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingTrade(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveEdit} style={{ transition: 'transform .15s' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
