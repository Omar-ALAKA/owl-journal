// routes/trades.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrades, deleteTrade, fetchAccounts } from '../lib/api';
import type { Trade, Account } from '../types';
import { Trash2, Filter, X } from 'lucide-react';

export function TradesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
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
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}><Trash2 size={12} /></button>
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
    </div>
  );
}
