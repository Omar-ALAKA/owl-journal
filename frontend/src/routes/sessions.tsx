// routes/sessions.tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAccounts, updateAccount } from '../lib/api';
import type { Account } from '../types';
import { Clock, Check, Globe } from 'lucide-react';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, formatOffset, getCurrentSession, TZ_OPTIONS, type TimezoneCode } from '../stores/timezone';

const DEFAULT_SESSIONS = [
  { name: 'Asia', start: 0, end: 9, color: '#34D399' },
  { name: 'London', start: 9, end: 12, color: '#E8A838' },
  { name: 'London/NY', start: 12, end: 16, color: '#F87171' },
  { name: 'New York', start: 16, end: 21, color: '#60A5FA' },
];

const groupedOptions = TZ_OPTIONS.reduce((acc, opt) => {
  if (!acc[opt.group]) acc[opt.group] = [];
  acc[opt.group].push(opt);
  return acc;
}, {} as Record<string, typeof TZ_OPTIONS>);

export function SessionsPage() {
  const qc = useQueryClient();
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [saved, setSaved] = useState(false);
  const { timezone, setTimezone } = useTimezoneStore();

  const { data: accountsData } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts().catch(() => ({ accounts: [] })),
  });
  const accounts: Account[] = accountsData?.accounts || [];

  // Active account for session config
  const activeAccount = accounts.find(a => a.status === 'active') || accounts[0];

  // Load session config from account on mount/reload
  useEffect(() => {
    if (!activeAccount) return;
    try {
      const saved = activeAccount.session_hours;
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        const merged = DEFAULT_SESSIONS.map(def => {
          const savedEntry = (saved as Record<string, { start: number; end: number }>)[def.name];
          if (savedEntry && typeof savedEntry === 'object') {
            return { ...def, start: savedEntry.start ?? def.start, end: savedEntry.end ?? def.end };
          }
          return def;
        });
        setSessions(merged);
      }
    } catch {
      // Keep defaults
    }
  }, [activeAccount]);

  const offset = getTimezoneOffset(timezone);
  const tzName = getEffectiveTzName(timezone);
  const currentSession = getCurrentSession(offset);

  // Save session config to the active account
  const handleSave = async () => {
    if (!activeAccount) return;
    const sessionConfig: Record<string, { start: number; end: number }> = {};
    for (const s of sessions) {
      sessionConfig[s.name] = { start: s.start, end: s.end };
    }
    try {
      await updateAccount(activeAccount.id, { session_hours: sessionConfig });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaved(false);
    }
  };

  const updateSession = (idx: number, field: 'start' | 'end', value: number) => {
    const next = [...sessions];
    next[idx] = { ...next[idx], [field]: value };
    setSessions(next);
  };

  // Convert UTC session hours to local time for display
  const toLocal = (utcHour: number) => ((utcHour + offset) % 24 + 24) % 24;

  return (
    <div className="page">
      <div className="page-header"><h1>Trading Sessions</h1></div>

      {/* ── Timezone selector ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Timezone</div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Select your reference timezone. Session hours will be configured in UTC but displayed in your local time.
        </p>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Timezone</label>
          <select
            className="form-select"
            value={timezone}
            onChange={e => setTimezone(e.target.value as TimezoneCode)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(232,168,56,0.08)', borderRadius: '8px' }}>
          <Clock size={16} color="var(--color-accent)" />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {tzName} {formatOffset(offset)} · Current: <span style={{ color: currentSession !== 'Off-hours' ? '#34D399' : '#6B7280' }}>{currentSession}</span>
          </span>
        </div>
      </div>

      {/* ── Session config ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} color="var(--color-accent)" />
          <div className="card-title" style={{ margin: 0 }}>Session Hours</div>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Configure session boundaries in UTC. The timeline shows your local time conversion.
        </p>

        {/* Visual timeline - LOCAL time */}
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Local Time ({tzName})</div>
          <div style={{ display: 'flex', height: '32px', borderRadius: '6px', overflow: 'hidden', gap: '1px' }}>
            {Array.from({ length: 24 }, (_, h) => {
              // h is local hour, find which session it belongs to
              const utcHour = ((h - offset) % 24 + 24) % 24;
              const session = sessions.find(s => utcHour >= s.start && utcHour < s.end);
              const color = session ? session.color : 'rgba(255,255,255,0.05)';
              return (
                <div
                  key={h}
                  style={{ flex: 1, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: session ? '#000' : 'var(--color-text-muted)' }}
                  title={`${h}:00 ${tzName}${session ? ` (${session.name})` : ''}`}
                >
                  {h % 3 === 0 ? h : ''}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
            {sessions.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color }} />
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {s.name} (UTC {s.start}:00-{s.end}:00 / {tzName} {toLocal(s.start)}:00-{toLocal(s.end)}:00)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Config inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {sessions.map((s, idx) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
              <div style={{ fontWeight: 600, minWidth: '90px', fontSize: '14px' }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>UTC Start</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={s.start}
                  onChange={e => updateSession(idx, 'start', Number(e.target.value))}
                  style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)', fontSize: '14px' }}
                />
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>UTC End</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={s.end}
                  onChange={e => updateSession(idx, 'end', Number(e.target.value))}
                  style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--color-text)', fontSize: '14px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '100px' }}>
                  → {tzName} {toLocal(s.start)}:00-{toLocal(s.end)}:00
                </span>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><Check size={14} /> Saved!</> : 'Save Session Hours'}
        </button>
      </div>
    </div>
  );
}
