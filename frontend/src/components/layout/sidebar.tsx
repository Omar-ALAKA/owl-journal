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
];

export function Sidebar() {
  const { theme, toggle } = useThemeStore();

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
