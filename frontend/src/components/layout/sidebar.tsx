// components/layout/sidebar.tsx
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Trophy, BookOpen, Clock, Calendar,
  ArrowLeftRight, Activity, Target, CreditCard, Upload,
  Moon, Sun, Zap, Wallet,
} from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, getCurrentSession, formatOffset } from '@/stores/timezone';
import { useQuery } from '@tanstack/react-query';
import { fetchDrawdownAnalysis } from '@/lib/api';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/challenge', icon: Trophy, label: 'Challenge' },
  { to: '/funded', icon: Wallet, label: 'Funded' },
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
  'Asia': '#FBBF24', 'London': '#60A5FA', 'New York': '#34D399', 'Late NY': '#FB923C', 'Off-hours': '#475569',
};

function ddColor(pct: number): string {
  const a = Math.abs(pct);
  if (a <= 2.5) return 'var(--color-profit)';
  if (a <= 5) return 'var(--color-warning)';
  return 'var(--color-loss)';
}

const itemVariants = { hover: { x: 4 } };

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const { timezone } = useTimezoneStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(i); }, []);

  const offset = getTimezoneOffset(timezone, now);
  const tzName = getEffectiveTzName(timezone, now);
  const sess = getCurrentSession(offset);
  const sessColor = SESSION_COLORS[sess] || '#475569';
  const localTime = new Date(now.getTime() + offset * 3600000);
  const timeStr = localTime.toISOString().slice(11, 16);

  const { data: dd } = useQuery({
    queryKey: ['sb-dd'], queryFn: () => fetchDrawdownAnalysis().catch(() => null),
    refetchInterval: 30000, staleTime: 20000,
  });

  const curDd = dd?.current_drawdown_pct ?? 0;
  const maxDd = dd?.max_drawdown_pct ?? 0;
  const ddCol = ddColor(curDd);
  const thermW = Math.min((Math.abs(curDd) / 7) * 100, 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Zap size={16} color="#fff" /></div>
        <span className="sidebar-logo-text">OWL Journal</span>
      </div>

      {/* Session */}
      <div className="sidebar-widget">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{tzName} {formatOffset(offset)}</span>
          <span className="font-data" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-.03em' }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sessColor, boxShadow: `0 0 6px ${sessColor}`, animation: 'pulse-dot 2s ease-in-out infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: sessColor }}>{sess}</span>
          <span style={{ fontSize: 10, color: sess !== 'Off-hours' ? 'var(--color-profit)' : 'var(--color-text-muted)', marginLeft: 'auto' }}>
            {sess !== 'Off-hours' ? '● Live' : '○ Off'}
          </span>
        </div>
      </div>

      {/* Drawdown */}
      <div className="sidebar-widget" style={{ borderLeft: `3px solid ${ddCol}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="sidebar-widget-title" style={{ margin: 0 }}>Drawdown</span>
          <span className="font-data" style={{ fontSize: 13, fontWeight: 700, color: ddCol }}>
            {Math.abs(curDd).toFixed(2)}%
          </span>
        </div>
        <div className="progress-track">
          <motion.div
            className="progress-fill"
            style={{ background: ddCol }}
            initial={{ width: 0 }}
            animate={{ width: `${thermW}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
          <span>Max {Math.abs(maxDd).toFixed(1)}%</span>
          <span>{Math.abs(curDd) <= 2.5 ? '● Safe' : Math.abs(curDd) <= 5 ? '● Caution' : '● Danger'}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <motion.div whileHover="hover" variants={itemVariants}>
              <item.icon size={16} />
            </motion.div>
            <span className="nav-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="sidebar-footer">
        <button className="nav-link" onClick={toggle} style={{ width: '100%' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span className="nav-link-text">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>
    </aside>
  );
}
