// components/layout/sidebar.tsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Trophy, BookOpen, Clock, Calendar,
  ArrowLeftRight, BarChart3, Target, CreditCard, Upload,
  Moon, Sun, TrendingDown,
} from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, getCurrentSession, formatOffset } from '@/stores/timezone';
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '@/lib/api';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/challenge', icon: Trophy, label: 'Challenge' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/strategies', icon: Target, label: 'Strategies' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/sessions', icon: Clock, label: 'Sessions' },
];

const SESSION_COLORS: Record<string, string> = {
  'Asia': '#E8A838',
  'London': '#60A5FA',
  'New York': '#34D399',
  'Late NY': '#FBBF24',
  'Off-hours': '#4A5266',
};

function getDdColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs <= 2.5) return '#34D399';
  if (abs <= 5) return '#FBBF24';
  return '#F87171';
}

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const { timezone } = useTimezoneStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  const offset = getTimezoneOffset(timezone, now);
  const tzName = getEffectiveTzName(timezone, now);
  const currentSession = getCurrentSession(offset);
  const sessionColor = SESSION_COLORS[currentSession] || '#4A5266';
  const localTime = new Date(now.getTime() + offset * 3600000);
  const timeStr = localTime.toISOString().slice(11, 16);

  const { data: ddData } = useQuery({
    queryKey: ['sidebar-drawdown'],
    queryFn: () => fetchDrawdownAnalysis().catch(() => null),
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const currentDdPct = ddData?.current_drawdown_pct ?? 0;
  const maxDdPct = ddData?.max_drawdown_pct ?? 0;
  const ddColor = getDdColor(currentDdPct);
  const thermWidth = Math.min((Math.abs(currentDdPct) / 7) * 100, 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 22h20" />
            <path d="M8 22v-6a2 2 0 0 1 4 0v6" />
            <path d="M2 15c0-5 1-10 4-13 3 3 4 8 4 13" />
            <path d="M18 15c0-5 1-10 4-13 3 3 4 8 4 13" />
            <path d="M12 11v11" />
          </svg>
          <span className="sidebar-brand-text">OWL Journal</span>
        </div>
      </div>

      {/* ── Session / Timezone ── */}
      <div className="session-panel">
        <div className="session-tz">
          <span>{tzName} {formatOffset(offset)}</span>
          <span className="session-time">{timeStr}</span>
        </div>
        <div className="session-badge">
          <div className="session-dot" style={{ background: sessionColor, boxShadow: `0 0 8px ${sessionColor}` }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: sessionColor }}>
            {currentSession}
          </span>
          <span className="session-live" style={{ color: currentSession !== 'Off-hours' ? 'var(--color-pos)' : 'var(--color-text-dim)' }}>
            {currentSession !== 'Off-hours' ? '● Live' : '○ Off'}
          </span>
        </div>
      </div>

      {/* ── Drawdown Thermometer ── */}
      <div className="dd-thermometer">
        <div className="dd-therm-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingDown size={10} /> Drawdown
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: ddColor, fontSize: '12px' }}>
            {Math.abs(currentDdPct).toFixed(2)}%
          </span>
        </div>
        <div className="dd-therm-track">
          <div className="dd-therm-fill" style={{ width: `${thermWidth}%`, background: ddColor }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>Max: {Math.abs(maxDdPct).toFixed(1)}%</span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-dim)' }}>
            {Math.abs(currentDdPct) <= 2.5 ? 'Safe' : Math.abs(currentDdPct) <= 5 ? 'Caution' : 'Danger'}
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}
          >
            <item.icon size={18} />
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={toggle} title="Toggle theme">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="sidebar-link-text">Theme</span>
        </button>
      </div>
    </aside>
  );
}
