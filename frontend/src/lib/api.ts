// lib/api.ts - API Client
import axios from 'axios';
import type {
  Trade, Account, Stats, SessionStat, SetupStat, DailyStat,
  RBucket, RSummary, EquityPoint, DailyEquity, ChallengeStatus, ChallengeData,
  Checkpoint, Violation, JournalSession, StreakData, JournalDaily,
  CalendarMonth, HistoryAccount, Strategy, ImportPreview
} from '../types';
import { useTimezoneStore } from '../stores/timezone';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Inject X-Timezone header on every request
api.interceptors.request.use((config) => {
  const tz = useTimezoneStore.getState().timezone || 'UTC';
  config.headers['X-Timezone'] = tz;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url || 'unknown';
      if (status && status >= 500) {
        console.error(`[API] Server error ${status} on ${url}:`, error.response?.data);
      } else if (status && status >= 400) {
        console.warn(`[API] Client error ${status} on ${url}:`, error.response?.data);
      } else if (!status) {
        console.error(`[API] Network error on ${url}:`, error.message);
      }
    } else {
      console.error('[API] Unexpected error:', error);
    }
    return Promise.reject(error);
  }
);

export default api;

// Generic helpers
export const get = <T>(url: string, params?: object): Promise<T> =>
  api.get<T>(url, { params }).then((r) => r.data);

export const post = <T>(url: string, data?: object): Promise<T> =>
  api.post<T>(url, data).then((r) => r.data);

export const put = <T>(url: string, data?: object): Promise<T> =>
  api.put<T>(url, data).then((r) => r.data);

export const del = <T>(url: string): Promise<T> =>
  api.delete<T>(url).then((r) => r.data);

// ── Trades ──────────────────────────────────────
export const fetchTrades = (params?: Record<string, unknown>) =>
  get<{ trades: Trade[]; total: number; offset: number; limit: number }>('/trades', params);

export const fetchTrade = (id: number) =>
  get<Trade>(`/trades/${id}`);

export const createTrade = (data: Partial<Trade>) =>
  post<Trade>('/trades', data);

export const updateTrade = (id: number, data: Partial<Trade>) =>
  put<Trade>(`/trades/${id}`, data);

export const deleteTrade = (id: number) =>
  del<{ message: string; id: number }>(`/trades/${id}`);

// ── Accounts ────────────────────────────────────
export const fetchAccounts = () =>
  get<{ accounts: Account[] }>('/accounts');

export const fetchAccount = (id: number) =>
  get<Account>(`/accounts/${id}`);

export const createAccount = (data: Partial<Account>) =>
  post<Account>('/accounts', data);

export const updateAccount = (id: number, data: Partial<Account>) =>
  put<Account>(`/accounts/${id}`, data);

export const deleteAccount = (id: number) =>
  del<{ message: string; id: number }>(`/accounts/${id}`);

// ── Analytics ───────────────────────────────────
export const fetchStats = (accountId?: number) =>
  get<Stats>('/stats', accountId ? { account_id: accountId } : undefined);

export const fetchSessionAnalysis = (accountId?: number) =>
  get<{ sessions: SessionStat[] }>('/analytics/session-analysis', accountId ? { account_id: accountId } : undefined);

export const fetchSetupAnalysis = (accountId?: number) =>
  get<{ setups: SetupStat[] }>('/analytics/setup-analysis', accountId ? { account_id: accountId } : undefined);

export const fetchDailyStats = (accountId?: number, startDate?: string, endDate?: string) =>
  get<{ daily_stats: DailyStat[] }>('/analytics/daily-stats', { account_id: accountId, start_date: startDate, end_date: endDate });

export const fetchRDistribution = (accountId?: number) =>
  get<{ distribution: RBucket[]; summary: RSummary }>('/analytics/r-distribution', accountId ? { account_id: accountId } : undefined);

// ── Equity ──────────────────────────────────────
export const fetchEquityCurve = (accountId?: number) =>
  get<{ points: EquityPoint[]; source: string; count: number }>('/equity/curve', accountId ? { account_id: accountId } : undefined);

export const fetchDailyEquity = (accountId?: number, startDate?: string, endDate?: string) =>
  get<{ daily: DailyEquity[]; source: string; count: number }>('/equity/daily', { account_id: accountId, start_date: startDate, end_date: endDate });

// ── Challenge ───────────────────────────────────
export const fetchCurrentChallenge = () =>
  get<{ active: boolean; challenges: ChallengeData[]; count: number }>('/challenge/current');

export const fetchChallengeStatus = (accountId: number) =>
  get<ChallengeStatus>(`/challenge/status/${accountId}`);

export const fetchCheckpoints = (accountId?: number) =>
  get<{ checkpoints: Checkpoint[]; total: number }>('/challenge/checkpoints', accountId ? { account_id: accountId } : undefined);

export const createCheckpoint = (data: Partial<Checkpoint>) =>
  post<Checkpoint>('/challenge/checkpoints', data);

export const fetchViolations = (accountId?: number) =>
  get<{ violations: Violation[]; total_accounts_checked: number; accounts_with_violations: number }>('/challenge/violations', accountId ? { account_id: accountId } : undefined);

// ── Journal ─────────────────────────────────────
export const fetchJournalSessions = (accountId?: number) =>
  get<{ sessions: JournalSession[]; count: number }>('/journal/sessions', accountId ? { account_id: accountId } : undefined);

export const fetchStreaks = (accountId?: number) =>
  get<StreakData>('/journal/streaks', accountId ? { account_id: accountId } : undefined);

export const fetchJournalDaily = (accountId?: number) =>
  get<{ daily: JournalDaily[]; count: number }>('/journal/daily', accountId ? { account_id: accountId } : undefined);

// ── Calendar ────────────────────────────────────
export const fetchCalendar = (year?: number, month?: number, accountId?: number) =>
  get<CalendarMonth>('/calendar', { year, month, account_id: accountId });

// ── History ─────────────────────────────────────
export const fetchHistory = (params?: { account_type?: string; status?: string; broker?: string }) =>
  get<{ accounts: HistoryAccount[]; total: number }>('/history', params);

export const fetchAccountHistory = (accountId: number) =>
  get<{ account: Account; equity_curve: EquityPoint[]; daily_stats: JournalDaily[] }>(`/history/${accountId}`);

// ── Strategies ──────────────────────────────────
export const fetchStrategies = () =>
  get<{ strategies: Strategy[]; total: number }>('/strategies');

export const createStrategy = (data: Partial<Strategy>) =>
  post<Strategy>('/strategies', data);

export const updateStrategy = (id: number, data: Partial<Strategy>) =>
  put<Strategy>(`/strategies/${id}`, data);

export const deleteStrategy = (id: number) =>
  del<{ message: string }>(`/strategies/${id}`);

// ── Import ──────────────────────────────────────
export const previewImport = (file: File, accountId?: number) => {
  const formData = new FormData();
  formData.append('file', file);
  if (accountId) formData.append('account_id', String(accountId));
  return api.post<ImportPreview>('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const confirmImport = (trades: Partial<Trade>[], accountId: number) =>
  post<{ message: string; inserted: number; errors: unknown[] }>('/import/confirm', { trades, account_id: accountId });

// ── Rebuild ─────────────────────────────────────
export const rebuildEquity = (accountId: number) =>
  post<unknown>(`/rebuild-equity/${accountId}`);

// ── Timezone ─────────────────────────────────────
export const fetchTimezoneInfo = (tz?: string) =>
  get<{
    tz_code: string;
    tz_name: string;
    offset_hours: number;
    offset_formatted: string;
    is_dst: boolean | null;
    utc_now: string;
    local_now: string;
    current_session: string;
    available_timezones: string[];
  }>('/timezone/', tz ? { tz } : undefined);

export const fetchTimezoneSessions = (tz?: string) =>
  get<{
    tz_code: string;
    offset_hours: number;
    sessions: Record<string, { local_start: number; local_end: number; utc_start: number; utc_end: number; description: string }>;
    current_session: string;
  }>('/timezone/sessions', tz ? { tz } : undefined);

export const detectTimezone = () =>
  get<{
    detected_tz: string;
    iana_name: string;
    offset_hours: number;
    offset_formatted: string;
    is_dst: boolean;
    dst_active: boolean;
    dst_label: string;
    note: string;
  }>('/timezone/detect');

// ── Drawdown Analysis ─────────────────────────────
export const fetchDrawdownAnalysis = (accountId?: number, dateFrom?: string, dateTo?: string) => {
  const params: Record<string, string | number> = {};
  if (accountId) params.account_id = accountId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  return get<{
    max_drawdown_pct: number;
    max_drawdown_abs: number;
    avg_drawdown_pct: number;
    current_drawdown_pct: number;
    nb_drawdown_periods: number;
    longest_period_days: number;
    drawdown_periods: Array<{
      start: string;
      end: string;
      depth_abs: number;
      depth_pct: number;
      duration_days: number;
    }>;
    underwater_curve: Array<{
      date: string;
      equity: number;
      drawdown_pct: number;
    }>;
    current_equity: number;
    peak_equity: number;
    gain_required_pct: number;
    gain_required_abs: number;
    avg_loss: number;
    ev_per_trade: number;
    consec_losses_to_overall_limit: number;
    consec_losses_to_daily_limit: number;
    remaining_dd_room: number;
    recovery_probability: number;
    blowout_risk: number;
    median_recovery_trades: number;
    mean_recovery_trades: number;
  }>('/analytics/drawdown', Object.keys(params).length ? params : undefined);
};
