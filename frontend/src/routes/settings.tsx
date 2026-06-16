// routes/settings.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rebuildEquity, fetchAccounts, updateSessionConfig, fetchAccount } from '../lib/api';
import type { Account, SessionConfig } from '../types';
import { Settings, Database, RefreshCw, Check, Globe, Clock, Save } from 'lucide-react';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, formatOffset, getCurrentSession, TZ_OPTIONS, type TimezoneCode } from '../stores/timezone';

const DEFAULT_SESSIONS: SessionConfig = {
  Asia: { start: 0, end: 8 },
  London: { start: 8, end: 12 },
  "New York": { start: 13, end: 21 },
  "Late NY": { start: 22, end: 23 },
};

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
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [localSessions, setLocalSessions] = useState<SessionConfig>(DEFAULT_SESSIONS);
  const [sessionsSaved, setSessionsSaved] = useState(false);

  const { timezone, setTimezone } = useTimezoneStore();
  const offset = getTimezoneOffset(timezone);
  const tzName = getEffectiveTzName(timezone);
  const currentSession = getCurrentSession(offset);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts: Account[] = accountsData?.accounts || [];

  // Load session config from selected account
  const handleAccountSelect = async (id: number) => {
    setSelectedAccountId(id);
    setSessionsSaved(false);
    if (id === 0) {
      setLocalSessions(DEFAULT_SESSIONS);
      return;
    }
    try {
      const acc = await fetchAccount(id);
      if (acc.session_hours) {
        setLocalSessions(acc.session_hours as SessionConfig);
      } else {
        setLocalSessions(DEFAULT_SESSIONS);
      }
    } catch {
      setLocalSessions(DEFAULT_SESSIONS);
    }
  };

  const handleSessionChange = (name: string, field: 'start' | 'end', value: number) => {
    setSessionsSaved(false);
    setLocalSessions(prev => ({
      ...prev,
      [name]: { ...prev[name as keyof SessionConfig]!, [field]: Math.max(0, Math.min(23, value)) },
    }));
  };

  const handleSaveSessions = async () => {
    if (selectedAccountId === 0) {
      // Save to all accounts
      for (const acc of accounts) {
        await updateSessionConfig(acc.id, localSessions);
      }
    } else {
      await updateSessionConfig(selectedAccountId, localSessions);
    }
    setSessionsSaved(true);
    qc.invalidateQueries({ queryKey: ['accounts'] });
  };

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

        </div>

      {/* ── Session Configuration ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Session Configuration</div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Define session hours in your local timezone ({tzName} {formatOffset(offset)}).
          Sessions are automatically converted to UTC for trade analysis.
        </p>

        {/* Account selector */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Apply to Account</label>
          <select
            className="form-select"
            value={selectedAccountId}
            onChange={e => handleAccountSelect(Number(e.target.value))}
          >
            <option value={0}>All accounts (default)</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.broker || 'no broker'})</option>
            ))}
          </select>
        </div>

        {/* Session editors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {Object.entries(localSessions).map(([name, cfg]) => {
            if (!cfg) return null;
            const utcStart = ((cfg.start - offset) % 24 + 24) % 24;
            const utcEnd = ((cfg.end - offset) % 24 + 24) % 24;
            return (
              <div key={name} style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }} />
                  {name}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Start</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={cfg.start}
                      onChange={e => handleSessionChange(name, 'start', Number(e.target.value))}
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '13px', textAlign: 'center' }}
                    />
                  </div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '12px' }}>→</span>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>End</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={cfg.end}
                      onChange={e => handleSessionChange(name, 'end', Number(e.target.value))}
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '13px', textAlign: 'center' }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '6px', textAlign: 'center' }}>
                  UTC: {String(utcStart).padStart(2, '0')}:00 → {String(utcEnd).padStart(2, '0')}:00
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-primary" onClick={handleSaveSessions}>
            <Save size={16} /> Save Session Config
          </button>
          {sessionsSaved && (
            <span style={{ fontSize: '13px', color: 'var(--color-profit)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Saved!
            </span>
          )}
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
