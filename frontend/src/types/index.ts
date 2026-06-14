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
  is_winner: number; // 0=loss, 1=win, 2=be
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

export interface DailyStats {
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

export interface Stats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  be_trades: number;
  win_rate: number;
  profit_factor: number;
  gross_profit: number;
  gross_loss: number;
  net_profit: number;
  avg_winner: number;
  avg_loser: number;
  largest_winner: number;
  largest_loser: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  current_drawdown: number;
  current_drawdown_pct: number;
  equity: number;
  current_streak: number;
  streak_type: string;
  best_win_streak: number;
  best_loss_streak: number;
  day_streak: number;
  day_streak_type: string;
  avg_trades_per_day: number;
  expectancy: number;
  recovery_factor: number;
  consistency: number;
  avg_win_loss_ratio: number;
}

export interface CalendarDay {
  pl: number;
  pct: number;
  trades: number;
  wins: number;
  losses: number;
}

export interface CalendarData {
  year: number;
  month: number;
  starting_equity: number;
  data: Record<string, CalendarDay>;
}
