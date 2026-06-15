// routes/settings.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rebuildEquity, fetchAccounts, updateAccount } from '../lib/api';
import type { Account } from '../types';
import { Settings, Database, RefreshCw, Check, Clock } from 'lucide-react';

const DEFAULT_SESSIONS = [
  { name: 'Asia', start: 0, end: 9 },
  { name: 'London', start: 9, end: 12 },
  { name: 'London/NY', start: 12, end: 16 },
  { name: 'New York', start: 16, end: 21 },
];

export function SettingsPage() {
  const qc = useQueryClient();
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);
  const [rebuildAccountId, setRebuildAccountId] = useState<number>(0);
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [sessionsSaved, setSessionsSaved] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts: Account[] = accountsData?.accounts || [];

  const activeAccount = accounts.find(a => a.status === 'active');

  // Load session config from active account
  const [loadedAccountId, setLoadedAccountId] = useState<number | null>(null);
  if (activeAccount && activeAccount.id !== loadedAccountId) {
    setLoadedAccountId(activeAccount.id);
    try {
      const saved = activeAccount.session_hours ? JSON.parse(activeAccount.session_hours) : null;
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        const merged = DEFAULT_SESSIONS.map(def => {
          const savedEntry = saved[def.name];
          if (savedEntry && typeof savedEntry === 'object') {
            return { name: def.name, start: savedEntry.start ?? def.start, end: savedEntry.end ?? def.end };
          }
          return def;
        });
        setSessions(merged);
      } else {
        setSessions(DEFAULT_SESSIONS);
      }
    } catch {
      setSessions(DEFAULT_SESSIONS);
    }
  }

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

  const handleSaveSessions = async () => {
    if (!activeAccount) return;
    const sessionConfig: Record<string, { start: number; end: number }> = {};
    for (const s of sessions) {
      sessionConfig[s.name] = { start: s.start, end: s.end };
    }
    try {
      await updateAccount(activeAccount.id, { session_hours: JSON.stringify(sessionConfig) });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setSessionsSaved(true);
      setTimeout(() => setSessionsSaved(false), 3000);
    } catch {
      setSessionsSaved(false);
    }
  };

  const updateSession = (idx: number, field: 'start' | 'end', value: number) => {
    const next = [...sessions];
    next[idx] = { ...next[idx], [field]: value };
    setSessions(next);
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
          <Clock size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Trading Sessions (UTC)</div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Configure the UTC hours for each trading session. Trades will be auto-assigned based on their open time.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {sessions.map((s, idx) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontWeight: 600, minWidth: '90px', fontSize: '14px' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Start</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={s.start}
                  onChange={e => updateSession(idx, 'start', Number(e.target.value))}
                  style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)', fontSize: '14px' }}
                />
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>End</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={s.end}
                  onChange={e => updateSession(idx, 'end', Number(e.target.value))}
                  style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)', fontSize: '14px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>UTC</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={handleSaveSessions}>
          {sessionsSaved ? <><Check size={14} /> Saved!</> : 'Save Session Hours'}
        </button>
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
