# app/schemas/analytics.py
"""Pydantic schemas for analytics, KPIs, streaks, drawdown, and calendar."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


# ── KPI Schemas ──────────────────────────────────────────────────────────────


class KPIResponse(BaseModel):
    """Complete KPI set for an account."""

    account_id: int
    total_trades: int = 0
    net_pnl: float = 0
    gross_profit: float = 0
    gross_loss: float = 0
    win_rate: float = 0
    profit_factor: float = 0
    avg_win: float = 0
    avg_loss: float = 0
    expectancy: float = 0
    avg_trade: float = 0
    largest_win: float = 0
    largest_loss: float = 0
    avg_r_multiple: float = 0
    sharpe_ratio: float = 0
    calmar_ratio: float = 0
    max_drawdown: float = 0
    max_drawdown_pct: float = 0
    recovery_factor: float = 0
    payoff_ratio: float = 0


# ── Streak Schemas ───────────────────────────────────────────────────────────


class StreakResponse(BaseModel):
    """Winning/losing streak information."""

    current_streak: int = 0
    current_type: str = "none"  # win / loss / none
    best_win_streak: int = 0
    best_loss_streak: int = 0


# ── Drawdown Schemas ─────────────────────────────────────────────────────────


class DrawdownResponse(BaseModel):
    """Drawdown metrics for an account."""

    max_drawdown: float = 0
    max_drawdown_pct: float = 0
    current_drawdown: float = 0
    current_drawdown_pct: float = 0
    peak_equity: float = 0
    current_equity: float = 0


# ── Calendar Schemas ─────────────────────────────────────────────────────────


class CalendarDay(BaseModel):
    """Single day in the trading calendar."""

    date: date
    net_pnl: float = 0
    trades: int = 0
    wins: int = 0
    losses: int = 0
    is_profitable: bool = False


class CalendarWeek(BaseModel):
    """Week in the trading calendar."""

    week_number: int
    days: list[CalendarDay] = []
    week_pnl: float = 0
    week_trades: int = 0


class CalendarMonth(BaseModel):
    """Month in the trading calendar."""

    year: int
    month: int
    month_name: str
    weeks: list[CalendarWeek] = []
    month_pnl: float = 0
    month_trades: int = 0
    trading_days: int = 0


class CalendarResponse(BaseModel):
    """Full calendar response."""

    account_id: int
    year: int
    months: list[CalendarMonth] = []
    total_pnl: float = 0
    total_trades: int = 0


# ── Session Analytics ────────────────────────────────────────────────────────


class SessionStats(BaseModel):
    """Statistics per trading session."""

    session: str
    total_trades: int = 0
    net_pnl: float = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0
    avg_pnl: float = 0


class SessionAnalyticsResponse(BaseModel):
    """Session-based analytics."""

    account_id: int
    sessions: list[SessionStats] = []


# ── Setup Analytics ──────────────────────────────────────────────────────────


class SetupStats(BaseModel):
    """Statistics per setup/strategy."""

    setup: str
    total_trades: int = 0
    net_pnl: float = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0
    avg_r_multiple: float = 0
    profit_factor: float = 0


class SetupAnalyticsResponse(BaseModel):
    """Setup-based analytics."""

    account_id: int
    setups: list[SetupStats] = []


# ── Symbol Analytics ─────────────────────────────────────────────────────────


class SymbolStats(BaseModel):
    """Statistics per symbol/instrument."""

    symbol: str
    total_trades: int = 0
    net_pnl: float = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0
    avg_pnl: float = 0


class SymbolAnalyticsResponse(BaseModel):
    """Symbol-based analytics."""

    account_id: int
    symbols: list[SymbolStats] = []


# ── Monthly Summary ──────────────────────────────────────────────────────────


class MonthlySummary(BaseModel):
    """Monthly performance summary."""

    year: int
    month: int
    net_pnl: float = 0
    trades: int = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0
    profit_factor: float = 0
    best_day: float = 0
    worst_day: float = 0


class MonthlySummaryResponse(BaseModel):
    """Monthly summary response."""

    account_id: int
    months: list[MonthlySummary] = []
