// routes/settings.tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { rebuildEquity } from '../lib/api';
import { Settings, Database, RefreshCw, Check } from 'lucide-react';

export function SettingsPage() {
  const qc = useQueryClient();
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);

  const handleRebuild = async () => {
    if (!confirm('Rebuild equity curve and daily stats for all accounts?')) return;
    setRebuilding(true);
    try {
      // Rebuild for account 1 as default
      await rebuildEquity(1);
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
