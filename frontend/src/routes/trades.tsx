// routes/trades.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrades, deleteTrade, fetchAccounts, updateTrade } from '../lib/api';
import type { Trade, Account } from '../types';
import { Trash2, Filter, X, Edit2 } from 'lucide-react';

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
    await deleteTrade(id);
    qc.invalidateQueries({ queryKey: ['trades'] });
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
      session: t.session,
      setup: t.setup,
      notes: t.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTrade) return;
    await updateTrade(editingTrade.id, editForm);
    qc.invalidateQueries({ queryKey: ['trades'] });
    setEditingTrade(null);
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
                <option value="london">London</option>
                <option value="newyork">New York</option>
                <option value="asia">Asia</option>
                <option value="overlap">Overlap</option>
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
                  <th>P&L</th>
                  <th>R</th>
                  <th>Session</th>
                  <th>Setup</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.open_time?.split('T')[0]}</td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td className={t.direction === 'long' ? 'text-green' : 'text-red'}>
                      {t.direction === 'long' ? '▲' : '▼'}
                    </td>
                    <td>{t.volume}</td>
                    <td>{t.entry_price}</td>
                    <td>{t.exit_price || '-'}</td>
                    <td className={t.profit >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                      {t.profit >= 0 ? '+' : ''}${typeof t.profit === 'number' ? t.profit.toFixed(2) : t.profit}
                    </td>
                    <td className={(t.r_multiple || 0) >= 0 ? 'text-green' : 'text-red'}>
                      {t.r_multiple ? `${t.r_multiple}R` : '-'}
                    </td>
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

          {/* Pagination */}
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
        <div className="modal-overlay" onClick={() => setEditingTrade(null)}>
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
                <select className="form-select" value={editForm.direction || 'long'} onChange={e => setEditForm({ ...editForm, direction: e.target.value as 'long' | 'short' })}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
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
                <label className="form-label">Commission</label>
                <input className="form-input" type="number" step="0.01" value={editForm.commission ?? ''} onChange={e => setEditForm({ ...editForm, commission: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Swap</label>
                <input className="form-input" type="number" step="0.01" value={editForm.swap ?? ''} onChange={e => setEditForm({ ...editForm, swap: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session</label>
                <select className="form-select" value={editForm.session || ''} onChange={e => setEditForm({ ...editForm, session: e.target.value })}>
                  <option value="">-</option>
                  <option value="london">London</option>
                  <option value="newyork">New York</option>
                  <option value="asia">Asia</option>
                  <option value="overlap">Overlap</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Setup</label>
                <input className="form-input" value={editForm.setup || ''} onChange={e => setEditForm({ ...editForm, setup: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '20px' }}>
              <button className="btn btn-danger" onClick={() => { handleDelete(editingTrade.id); setEditingTrade(null); }}><Trash2 size={14} /> Delete</button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingTrade(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
