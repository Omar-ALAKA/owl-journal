// Types OWL Journal
export interface Trade {
  id: number;
  account_id: number;
  ticket?: string;
  open_time: string;
  close_time?: string;
  symbol: string;
  direction: 'long' | 'short';
  volume: number;
  entry_price: number;
  exit_price?: number;
  sl_price?: number;
  tp_price?: number;
  profit: number;
  commission: number;
  swap: number;
  session?: string;
  setup?: string;
  confluences?: string;
  notes?: string;
  setup_quality?: number;
  rr_target?: number;
  rr_actual?: number;
  r_multiple?: number;
  is_winner: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  name: string;
  broker?: string;
  broker_acct?: string;
  account_type: 'challenge' | 'funded' | 'personal';
  phase?: string;
  status: string;
  starting_balance: number;
  current_balance: number;
  target_profit_pct: number;
  max_drawdown_pct: number;
  daily_loss_pct: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
  drawdown_pct: number;
}

export interface Stats {
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  avg_r: number;
  best_r: number;
  worst_r: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  expectancy: number;
  current_equity: number;
}

export interface SessionStat {
  session: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  avg_r: number;
  best_r: number;
  worst_r: number;
}

export interface SetupStat {
  setup: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  avg_r: number;
  best_r: number;
  worst_r: number;
  avg_quality: number;
}

export interface DailyStat {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  avg_r: number;
}

export interface RBucket {
  label: string;
  count: number;
  profit: number;
}

export interface RSummary {
  total: number;
  avg_r: number;
  median_r: number;
  min_r: number;
  max_r: number;
}

export interface ChallengeData {
  id: number;
  name: string;
  broker?: string;
  phase?: string;
  starting_balance: number;
  current_equity: number;
  target_equity: number;
  progress_pct: number;
  net_pnl: number;
  net_pnl_pct: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  drawdown_limit_pct: number;
  drawdown_remaining_pct: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_pnl: number;
  best_trade: number;
  worst_trade: number;
  last_checkpoint?: Checkpoint;
  first_trade_date?: string;
  last_trade_date?: string;
  created_at?: string;
  status: string;
}

export interface Checkpoint {
  id: number;
  account_id: number;
  checkpoint_type: string;
  balance: number;
  equity: number;
  drawdown: number;
  notes?: string;
  created_at?: string;
}

export interface Violation {
  account_id: number;
  account_name: string;
  phase?: string;
  max_drawdown_pct: number;
  daily_loss_limit: number;
  net_pnl: number;
  violation_count: number;
  violations: ViolationItem[];
}

export interface ViolationItem {
  type: string;
  value: number;
  limit: number;
  severity: string;
  date?: string;
  daily_pnl?: number;
  daily_loss_pct?: number;
}

export interface JournalSession {
  session: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_profit: number;
  avg_pnl: number;
  avg_r_multiple: number;
  best_trade: number;
  worst_trade: number;
  total_commission: number;
  total_swap: number;
}

export interface JournalDaily {
  id?: number;
  account_id?: number;
  trade_date: string;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
}

export interface StreakData {
  current_streak: { type: string | null; count: number };
  max_win_streak: number;
  max_loss_streak: number;
  avg_win_streak: number;
  avg_loss_streak: number;
  total_streaks: number;
  streaks: { type: string; count: number }[];
}

export interface CalendarDay {
  date: string;
  pl: number;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  best_r: number | null;
  worst_r: number | null;
}

export interface CalendarMonth {
  year: number;
  month: number;
  data: Record<string, CalendarDay>;
  summary: {
    total_trades: number;
    total_pl: number;
    total_wins: number;
    total_losses: number;
    win_rate: number;
    profitable_days: number;
    losing_days: number;
    trading_days: number;
  };
}

export interface DailyEquity {
  date: string;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
}

export interface HistoryAccount {
  id: number;
  name: string;
  broker?: string;
  broker_acct?: string;
  account_type?: string;
  phase?: string;
  status: string;
  starting_balance: number;
  current_balance: number;
  target_profit_pct: number;
  max_drawdown_pct: number;
  daily_loss_pct: number;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    net_pnl: number;
    avg_pnl: number;
    avg_r_multiple: number;
    best_trade: number;
    worst_trade: number;
    max_drawdown_pct: number;
    roi_pct: number;
  };
  last_trade_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Strategy {
  id: number;
  name: string;
  description?: string;
  rules?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ImportPreview {
  preview: boolean;
  filename: string;
  detected_format: string;
  total_trades: number;
  symbols: string[];
  stats: {
    total_profit: number;
    wins: number;
    losses: number;
    win_rate: number;
  };
  account?: { id: number; name: string; broker?: string };
  trades: Partial<Trade>[];
}
