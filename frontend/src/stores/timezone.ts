// stores/timezone.ts - Timezone state management with DST auto-detection
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimezoneCode =
  | 'AUTO' | 'UTC'
  | 'EST' | 'EDT' | 'CST' | 'CDT' | 'MST' | 'MDT' | 'PST' | 'PDT'
  | 'GMT' | 'BST' | 'CET' | 'CEST' | 'EET' | 'EEST'
  | 'WAT' | 'JST' | 'KST' | 'IST' | 'HKT' | 'SGT'
  | 'AEST' | 'AEDT' | 'NZST' | 'NZDT';

export interface TimezoneOption {
  value: TimezoneCode;
  label: string;
  group: string;
  hasDst: boolean;
}

export const TZ_OPTIONS: TimezoneOption[] = [
  { value: 'AUTO', label: 'Auto-detect (New York DST)', group: 'Auto', hasDst: true },
  // US
  { value: 'EST', label: 'EST (UTC-5) — New York', group: 'Americas', hasDst: true },
  { value: 'EDT', label: 'EDT (UTC-4) — New York Summer', group: 'Americas', hasDst: false },
  { value: 'CST', label: 'CST (UTC-6) — Chicago', group: 'Americas', hasDst: true },
  { value: 'MST', label: 'MST (UTC-7) — Denver', group: 'Americas', hasDst: true },
  { value: 'PST', label: 'PST (UTC-8) — Los Angeles', group: 'Americas', hasDst: true },
  // Europe
  { value: 'GMT', label: 'GMT (UTC+0) — London', group: 'Europe', hasDst: true },
  { value: 'CET', label: 'CET (UTC+1) — Paris / Berlin', group: 'Europe', hasDst: true },
  { value: 'EET', label: 'EET (UTC+2) — Athens', group: 'Europe', hasDst: true },
  // Africa
  { value: 'GMT', label: 'GMT (UTC+0) — West Africa (Lomé, Accra, Dakar)', group: 'Africa', hasDst: false },
  { value: 'WAT', label: 'WAT (UTC+1) — West Africa (Lagos, Kinshasa)', group: 'Africa', hasDst: false },
  { value: 'UTC', label: 'UTC (UTC+0)', group: 'Other', hasDst: false },
  { value: 'IST', label: 'IST (UTC+5:30) — India', group: 'Asia', hasDst: false },
  { value: 'HKT', label: 'HKT (UTC+8) — Hong Kong', group: 'Asia', hasDst: false },
  { value: 'SGT', label: 'SGT (UTC+8) — Singapore', group: 'Asia', hasDst: false },
  { value: 'JST', label: 'JST (UTC+9) — Tokyo', group: 'Asia', hasDst: false },
  { value: 'KST', label: 'KST (UTC+9) — Seoul', group: 'Asia', hasDst: false },
  // Pacific
  { value: 'AEST', label: 'AEST (UTC+10) — Sydney', group: 'Pacific', hasDst: true },
  { value: 'NZST', label: 'NZST (UTC+12) — Auckland', group: 'Pacific', hasDst: true },
  // Other
  { value: 'UTC', label: 'UTC (UTC+0)', group: 'Other', hasDst: false },
];

// Static offsets for fixed timezones
const TZ_STATIC_OFFSETS: Record<string, number> = {
  UTC: 0, EDT: -4, CDT: -5, MDT: -6, PDT: -7, BST: 1,
  CEST: 2, EEST: 3, WAT: 1, JST: 9, KST: 9, IST: 5.5,
  HKT: 8, SGT: 8, AEDT: 11, NZDT: 13,
};

// Auto-DST timezone configs
const TZ_DST_CONFIG: Record<string, { std: number; dst: number; dstFunc: (d: Date) => boolean }> = {
  EST: { std: -5, dst: -4, dstFunc: isUsDst },
  CST: { std: -6, dst: -5, dstFunc: isUsDst },
  MST: { std: -7, dst: -6, dstFunc: isUsDst },
  PST: { std: -8, dst: -7, dstFunc: isUsDst },
  GMT: { std: 0, dst: 1, dstFunc: isEuDst },
  CET: { std: 1, dst: 2, dstFunc: isEuDst },
  EET: { std: 2, dst: 3, dstFunc: isEuDst },
  AEST: { std: 10, dst: 11, dstFunc: isAusDst },
  NZST: { std: 12, dst: 13, dstFunc: isNzDst },
};

// ── DST detection functions ──────────────────────────────────

function isUsDst(d: Date): boolean {
  const year = d.getUTCFullYear();
  const mar1 = new Date(Date.UTC(year, 2, 1));
  const daysToSun = (7 - mar1.getUTCDay()) % 7;
  const dstStart = new Date(Date.UTC(year, 2, 1 + daysToSun + 7, 2));
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const daysToSunNov = (7 - nov1.getUTCDay()) % 7;
  const dstEnd = new Date(Date.UTC(year, 10, 1 + daysToSunNov, 2));
  return d >= dstStart && d < dstEnd;
}

function isEuDst(d: Date): boolean {
  const year = d.getUTCFullYear();
  const mar31 = new Date(Date.UTC(year, 2, 31));
  const daysBack = (mar31.getUTCDay() + 1) % 7;
  const dstStart = new Date(Date.UTC(year, 2, 31 - daysBack, 1));
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const daysBackOct = (oct31.getUTCDay() + 1) % 7;
  const dstEnd = new Date(Date.UTC(year, 9, 31 - daysBackOct, 1));
  return d >= dstStart && d < dstEnd;
}

function isAusDst(d: Date): boolean {
  const year = d.getUTCFullYear();
  const oct1 = new Date(Date.UTC(year, 9, 1));
  const daysToSun = (7 - oct1.getUTCDay()) % 7;
  const dstStart = new Date(Date.UTC(year, 9, 1 + daysToSun, 2));
  const apr1 = new Date(Date.UTC(year + 1, 3, 1));
  const daysToSunApr = (7 - apr1.getUTCDay()) % 7;
  const dstEnd = new Date(Date.UTC(year + 1, 3, 1 + daysToSunApr, 3));
  return d >= dstStart || d < dstEnd;
}

function isNzDst(d: Date): boolean {
  const year = d.getUTCFullYear();
  const sep30 = new Date(Date.UTC(year, 8, 30));
  const daysBack = (sep30.getUTCDay() + 1) % 7;
  const dstStart = new Date(Date.UTC(year, 8, 30 - daysBack, 2));
  const apr1 = new Date(Date.UTC(year + 1, 3, 1));
  const daysToSun = (7 - apr1.getUTCDay()) % 7;
  const dstEnd = new Date(Date.UTC(year + 1, 3, 1 + daysToSun, 3));
  return d >= dstStart || d < dstEnd;
}

// ── Public API ────────────────────────────────────────────────

export function getTimezoneOffset(tz: TimezoneCode, dt?: Date): number {
  const d = dt || new Date();
  const code = tz.toUpperCase();

  if (code === 'AUTO') {
    return isUsDst(d) ? -4 : -5;
  }

  if (code in TZ_STATIC_OFFSETS) {
    return TZ_STATIC_OFFSETS[code];
  }

  if (code in TZ_DST_CONFIG) {
    const cfg = TZ_DST_CONFIG[code];
    return cfg.dstFunc(d) ? cfg.dst : cfg.std;
  }

  return 0;
}

export function getEffectiveTzName(tz: TimezoneCode, dt?: Date): string {
  const d = dt || new Date();
  const code = tz.toUpperCase();

  if (code === 'AUTO') return isUsDst(d) ? 'EDT' : 'EST';
  if (code in TZ_STATIC_OFFSETS) return code;

  if (code in TZ_DST_CONFIG) {
    const cfg = TZ_DST_CONFIG[code];
    const dstNames: Record<string, string> = {
      EST: 'EDT', CST: 'CDT', MST: 'MDT', PST: 'PDT',
      GMT: 'BST', CET: 'CEST', EET: 'EEST',
      AEST: 'AEDT', NZST: 'NZDT',
    };
    return cfg.dstFunc(d) ? (dstNames[code] || code) : code;
  }

  return code;
}

export function formatOffset(offsetHours: number): string {
  if (offsetHours === 0) return 'UTC';
  const sign = offsetHours > 0 ? '+' : '-';
  const absOffset = Math.abs(offsetHours);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  if (minutes) return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  return `UTC${sign}${hours}`;
}

export function utcToLocal(utcDate: Date, offsetHours: number): Date {
  return new Date(utcDate.getTime() + offsetHours * 3600000);
}

export function formatLocalTime(utcDateStr: string, offsetHours: number, fmt?: string): string {
  const d = new Date(utcDateStr);
  const local = utcToLocal(d, offsetHours);
  if (fmt === 'time') {
    return local.toISOString().slice(11, 16); // HH:MM
  }
  if (fmt === 'date') {
    return local.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (fmt === 'datetime') {
    return local.toISOString().slice(0, 16).replace('T', ' '); // YYYY-MM-DD HH:MM
  }
  return local.toISOString().slice(0, 19).replace('T', ' ');
}

export function getSessionForTime(utcHour: number, offsetHours: number): string {
  // Sessions are in FIXED UTC hours (market hours don't change with DST)
  // Asia: 00-07, London: 08-12, New York: 13-21, Off-hours: 22-23
  if (utcHour >= 0 && utcHour < 8) return 'Asia';
  if (utcHour >= 8 && utcHour < 13) return 'London';
  if (utcHour >= 13 && utcHour < 22) return 'New York';
  return 'Off-hours';
}

export function getCurrentSession(offsetHours: number): string {
  const now = new Date();
  return getSessionForTime(now.getUTCHours(), offsetHours);
}

// ── Store ─────────────────────────────────────────────────────

interface TimezoneState {
  timezone: TimezoneCode;
  setTimezone: (tz: TimezoneCode) => void;
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set) => ({
      timezone: 'EST',
      setTimezone: (tz) => set({ timezone: tz }),
    }),
    { name: 'owl-timezone' }
  )
);
