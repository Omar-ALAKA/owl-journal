# app/schemas/equity.py
"""Pydantic schemas for EquityCurve, DailyStats, and Checkpoint models."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


# ── EquityCurve ─────────────────────────────────────────────────────────────


class EquityCurveBase(BaseModel):
    timestamp: datetime
    equity: float
    drawdown: float = 0
    drawdown_pct: float = 0


class EquityCurveCreate(EquityCurveBase):
    account_id: int


class EquityCurveResponse(EquityCurveBase):
    id: int
    account_id: int

    class Config:
        from_attributes = True


# ── DailyStats ───────────────────────────────────────────────────────────────


class DailyStatsBase(BaseModel):
    trade_date: datetime
    net_pnl: float = 0
    gross_profit: float = 0
    gross_loss: float = 0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0
    profit_factor: float = 0


class DailyStatsCreate(DailyStatsBase):
    account_id: int


class DailyStatsResponse(DailyStatsBase):
    id: int
    account_id: int

    class Config:
        from_attributes = True


# ── Checkpoint ───────────────────────────────────────────────────────────────


class CheckpointBase(BaseModel):
    checkpoint_type: str
    balance: float
    equity: float
    drawdown: float = 0
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class CheckpointCreate(CheckpointBase):
    account_id: int


class CheckpointResponse(CheckpointBase):
    id: int
    account_id: int

    class Config:
        from_attributes = True


# ── Equity Summary ──────────────────────────────────────────────────────────


class EquitySummary(BaseModel):
    """Summary of equity performance for an account."""

    account_id: int
    starting_balance: float
    current_equity: float
    peak_equity: float
    total_return: float
    total_return_pct: float
    max_drawdown: float
    max_drawdown_pct: float
    current_drawdown: float
    current_drawdown_pct: float
    total_trades: int
    data_points: int
