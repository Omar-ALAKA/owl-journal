// lib/timezone.ts - Frontend timezone formatting utilities
import { useTimezoneStore, getTimezoneOffset, getEffectiveTzName, formatOffset } from '../stores/timezone';

/**
 * Format a UTC date string to local timezone.
 * @param utcDateStr - ISO date string from backend (UTC)
 * @param fmt - 'date' | 'time' | 'datetime' | 'full'
 * @param offset - optional offset (uses store if not provided)
 */
export function formatLocal(
  utcDateStr: string | undefined | null,
  fmt: 'date' | 'time' | 'datetime' | 'full' = 'datetime',
  offset?: number
): string {
  if (!utcDateStr) return '-';

  const d = new Date(utcDateStr);
  if (isNaN(d.getTime())) return '-';

  const off = offset ?? getTimezoneOffset(useTimezoneStore.getState().timezone);
  const local = new Date(d.getTime() + off * 3600000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const Y = local.getUTCFullYear();
  const M = pad(local.getUTCMonth() + 1);
  const D = pad(local.getUTCDate());
  const h = pad(local.getUTCHours());
  const m = pad(local.getUTCMinutes());
  const s = pad(local.getUTCSeconds());

  switch (fmt) {
    case 'date': return `${Y}-${M}-${D}`;
    case 'time': return `${h}:${m}`;
    case 'datetime': return `${Y}-${M}-${D} ${h}:${m}`;
    case 'full': return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    default: return `${Y}-${M}-${D} ${h}:${m}`;
  }
}

/**
 * Get current local time string for display.
 */
export function getLocalTimeStr(offset?: number): string {
  const now = new Date();
  const off = offset ?? getTimezoneOffset(useTimezoneStore.getState().timezone);
  const local = new Date(now.getTime() + off * 3600000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/**
 * Get current timezone info for display.
 */
export function getTzDisplay(): { name: string; offset: string; session: string } {
  const tz = useTimezoneStore.getState().timezone;
  const offset = getTimezoneOffset(tz);
  const name = getEffectiveTzName(tz);
  const session = getCurrentSession(offset);
  return { name, offset: formatOffset(offset), session };
}

import { getCurrentSession } from '../stores/timezone';
