// routes/settings.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rebuildEquity, fetchAccounts } from '../lib/api';
import type { Account } from '../types';
import { Settings, Database, RefreshCw, Check, Globe, Clock } from 'lucide-react';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, formatOffset, getCurrentSession, TZ_OPTIONS, type TimezoneCode } from '../stores/timezone';

// Group options for optgroup
const groupedOptions = TZ_OPTIONS.reduce((acc, opt) => {
  if (!acc[opt.group]) acc[opt.group] = [];
  acc[opt.group].push(opt);
  return acc;
}, {} as Record<string, typeof TZ_OPTIONS>);

export function SettingsPage() {
  const qc = useQueryClient();
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);
  const [rebuildAccountId, setRebuildAccountId] = useState<number>(0);

  const { timezone, setTimezone } = useTimezoneStore();
  const offset = getTimezoneOffset(timezone);
  const tzName = getEffectiveTzName(timezone);
  const currentSession = getCurrentSession(offset);

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

  const handleTimezoneChange = (tz: TimezoneCode) => {
    setTimezone(tz);
  };

  // Session times display based on selected timezone
  const sessionTimes = [
    { name: 'Asia', start: 0, end: 9 },
    { name: 'London', start: 9, end: 12 },
    { name: 'New York', start: 12, end: 17 },
    { name: 'Late NY', start: 17, end: 21 },
  ];

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1></div>

      {/* ── Timezone Card ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Timezone</div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Select your trading timezone. Sessions (Asia, London, NY) are calculated based on this.
          Auto-detect uses New York with automatic DST switching (EST/EDT).
        </p>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Timezone</label>
          <select
            className="form-select"
            value={timezone}
            onChange={e => handleTimezoneChange(e.target.value as TimezoneCode)}
          >
            {Object.entries(groupedOptions).map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} {opt.hasDst ? '(auto-DST)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '10px 14px', background: 'rgba(232,168,56,0.08)', borderRadius: '8px' }}>
          <Clock size={16} color="var(--color-accent)" />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {tzName} {' — '}
            <span style={{ color: 'var(--color-accent)' }}>{formatOffset(offset)}</span>
            {' · '}
            <span style={{ color: currentSession !== 'Off-hours' ? '#34D399' : '#6B7280' }}>
              {currentSession}
            </span>
          </span>
        </div>

        {/* Session schedule */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
            Session Schedule — Local Time → UTC
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            {sessionTimes.map(s => (
              <div key={s.name} style={{
                padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-accent)', marginTop: '2px' }}>
                  {String(s.start).padStart(2, '0')}:00 — {String(s.end).padStart(2, '0')}:00
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  UTC {String((s.start - offset + 24) % 24).padStart(2, '0')}:00 — {String((s.end - offset + 24) % 24).padStart(2, '0')}:00
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data Management ── */}
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

      {/* ── About ── */}
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
