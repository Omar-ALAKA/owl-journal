// routes/calendar.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendar } from '../lib/api';
import type { CalendarMonth, CalendarDay } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getHeatColor(day: CalendarDay | undefined): string {
  if (!day || day.trades === 0) return 'var(--color-bg-card-2)';
  if (day.pl > 0) {
    const intensity = Math.min(day.pl / 200, 1);
    return `rgba(52, 211, 153, ${0.2 + intensity * 0.6})`;
  }
  const intensity = Math.min(Math.abs(day.pl) / 200, 1);
  return `rgba(248, 113, 113, ${0.2 + intensity * 0.6})`;
}

export function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data } = useQuery<CalendarMonth>({
    queryKey: ['calendar', year, month],
    queryFn: () => fetchCalendar(year, month).catch(() => ({ year, month, data: {}, summary: { total_trades: 0, total_pl: 0, total_wins: 0, total_losses: 0, win_rate: 0, profitable_days: 0, losing_days: 0, trading_days: 0 } })),
  });

  const calData = data?.data || {};
  const summary = data?.summary;

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday start

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendar</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 600, minWidth: '140px', textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
        </div>
      </div>

      {summary && summary.total_trades > 0 && (
        <div className="kpi-grid" style={{ marginBottom: '20px' }}>
          <div className="kpi-card" style={{ padding: '14px' }}>
            <div className="kpi-label">Total P&L</div>
            <div className={`kpi-value ${summary.total_pl >= 0 ? 'green' : 'red'}`}>{summary.total_pl >= 0 ? '+' : ''}${summary.total_pl.toFixed(2)}</div>
          </div>
          <div className="kpi-card" style={{ padding: '14px' }}>
            <div className="kpi-label">Trades</div>
            <div className="kpi-value">{summary.total_trades}</div>
          </div>
          <div className="kpi-card" style={{ padding: '14px' }}>
            <div className="kpi-label">Win Rate</div>
            <div className="kpi-value">{summary.win_rate}%</div>
          </div>
          <div className="kpi-card" style={{ padding: '14px' }}>
            <div className="kpi-label">Profitable Days</div>
            <div className="kpi-value green">{summary.profitable_days}<span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> / {summary.trading_days}</span></div>
          </div>
        </div>
      )}

      <div className="card">
        {/* Day headers */}
        <div className="cal-grid" style={{ marginBottom: '4px' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px' }}>{d}</div>
          ))}
        </div>
        {/* Calendar days */}
        <div className="cal-grid">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} className="cal-day empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const day: CalendarDay | undefined = calData[dateStr];
            return (
              <div
                key={dateStr}
                className="cal-day"
                style={{ background: getHeatColor(day) }}
                title={day ? `${day.trades} trades, $${day.pl.toFixed(2)}` : undefined}
              >
                <span className="day-num">{dayNum}</span>
                {day && day.trades > 0 && <span className="day-pl">{day.pl >= 0 ? '+' : ''}{day.pl.toFixed(0)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
