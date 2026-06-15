// components/layout/sidebar.tsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Trophy,
  BookOpen,
  Clock,
  Calendar,
  ArrowLeftRight,
  Activity,
  Target,
  CreditCard,
  Upload,
  Moon,
  Sun,
} from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, getCurrentSession, formatOffset } from '@/stores/timezone';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/challenge', icon: Trophy, label: 'Challenge' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/strategies', icon: Target, label: 'Strategies' },
  { to: '/analytics', icon: Activity, label: 'Analytics' },
  { to: '/accounts', icon: CreditCard, label: 'Accounts' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/sessions', icon: Clock, label: 'Sessions' },
];

const SESSION_COLORS: Record<string, string> = {
  'Asia': '#E8A838',
  'London': '#3B82F6',
  'New York': '#34D399',
  'Late NY': '#F59E0B',
  'Off-hours': '#6B7280',
};

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const { timezone } = useTimezoneStore();
  const [now, setNow] = useState(new Date());

  // Update every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const offset = getTimezoneOffset(timezone, now);
  const tzName = getEffectiveTzName(timezone, now);
  const currentSession = getCurrentSession(offset);
  const sessionColor = SESSION_COLORS[currentSession] || '#6B7280';
  const localTime = new Date(now.getTime() + offset * 3600000);
  const timeStr = localTime.toISOString().slice(11, 16);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 22h20" />
            <path d="M8 22v-6a2 2 0 0 1 4 0v6" />
            <path d="M2 15c0-5 1-10 4-13 3 3 4 8 4 13" />
            <path d="M18 15c0-5 1-10 4-13 3 3 4 8 4 13" />
            <path d="M12 11v11" />
          </svg>
          <span className="sidebar-brand-text">OWL Journal</span>
        </div>
      </div>

      {/* ── Timezone / Session indicator ── */}
      <div style={{
        margin: '0 12px 8px', padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{tzName} {formatOffset(offset)}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: sessionColor,
            boxShadow: `0 0 6px ${sessionColor}`,
            animation: currentSession !== 'Off-hours' ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: sessionColor }}>
            {currentSession}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            {currentSession !== 'Off-hours' ? '● Live' : '○ Off'}
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            <item.icon size={18} />
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-link" onClick={toggle}>
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="sidebar-link-text">Theme</span>
        </button>
      </div>
    </aside>
  );
}
