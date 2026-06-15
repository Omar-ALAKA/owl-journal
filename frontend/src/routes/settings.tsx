// routes/settings.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rebuildEquity, fetchAccounts } from '../lib/api';
import type { Account } from '../types';
import { Settings, Database, RefreshCw, Check } from 'lucide-react';

export function SettingsPage() {
  const qc = useQueryClient();
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);
  const [rebuildAccountId, setRebuildAccountId] = useState<number>(0);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts: Account[] = accountsData?.accounts || [];

  const handleRebuild = async () => {
    const target = rebuildAccountId === 0 ? 'all accounts' : (accounts.find(a => a.id === rebuildAccountId)?.name || `account ${rebuildAccountId}`);
    if (!confirm(`Rebuild equity curve and daily stats for ${target}?`)) return;
    setRebuilding(true);
    try {
      if (rebuildAccountId === 0) {
        for (const account of accounts) {
          await rebuildEquity(account.id);
        }
      } else {
        await rebuildEquity(rebuildAccountId);
      }
      qc.invalidateQueries({ queryKey: ['equity-curve'] });
      qc.invalidateQueries({ queryKey: ['journal-daily'] });
      setRebuildResult('Equity curve and daily stats rebuilt successfully!');
    } catch {
      setRebuildResult('Rebuild failed. Check console for details.');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1></div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Database size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Data Management</div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Rebuild equity curves and daily statistics from trade data. Useful after manual data changes.
        </p>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Account to Rebuild</label>
          <select
            className="form-select"
            value={rebuildAccountId}
            onChange={e => setRebuildAccountId(Number(e.target.value))}
          >
            <option value={0}>All accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.broker || 'no broker'})</option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={handleRebuild} disabled={rebuilding}>
          <RefreshCw size={16} className={rebuilding ? 'spinner' : ''} /> {rebuilding ? 'Rebuilding...' : 'Rebuild Equity Data'}
        </button>
        {rebuildResult && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: rebuildResult.includes('success') ? 'var(--color-green)' : 'var(--color-red)', fontSize: '13px' }}>
            <Check size={14} /> {rebuildResult}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Settings size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>About</div>
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
          <p><strong style={{ color: 'var(--color-text)' }}>OWL Journal V4</strong> — Universal Trading Journal</p>
          <p>React 18 + TypeScript + Vite + FastAPI + PostgreSQL</p>
          <p style={{ marginTop: '8px' }}>Supports Equity Edge, FTMO, MyFundedFX, FundedNext, and any personal account.</p>
        </div>
      </div>
    </div>
  );
}
