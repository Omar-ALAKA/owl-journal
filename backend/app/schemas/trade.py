# app/schemas/trade.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TradeBase(BaseModel):
    symbol: str
    direction: str  # long/short
    volume: float
    entry_price: float
    exit_price: Optional[float] = None
    sl_price: Optional[float] = None
    tp_price: Optional[float] = None
    profit: float = 0
    commission: float = 0
    swap: float = 0
    session: Optional[str] = None
    setup: Optional[str] = None
    confluences: Optional[str] = None
    notes: Optional[str] = None
    setup_quality: Optional[int] = None
    rr_target: Optional[float] = None
    rr_actual: Optional[float] = None
    open_time: datetime
    close_time: Optional[datetime] = None


class TradeCreate(TradeBase):
    account_id: int


class TradeUpdate(BaseModel):
    symbol: Optional[str] = None
    direction: Optional[str] = None
    volume: Optional[float] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    sl_price: Optional[float] = None
    tp_price: Optional[float] = None
    profit: Optional[float] = None
    commission: Optional[float] = None
    swap: Optional[float] = None
    session: Optional[str] = None
    setup: Optional[str] = None
    confluences: Optional[str] = None
    notes: Optional[str] = None
    setup_quality: Optional[int] = None
    rr_target: Optional[float] = None
    rr_actual: Optional[float] = None
    r_multiple: Optional[float] = None
    sl_distance: Optional[float] = None
    tp_distance: Optional[float] = None
    is_winner: Optional[int] = None
    chart_url: Optional[str] = None
    ticket: Optional[str] = None
    open_time: Optional[datetime] = None
    close_time: Optional[datetime] = None


class TradeResponse(TradeBase):
    id: int
    account_id: int
    is_winner: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Strategy / Tag Schemas ──────────────────────────────────────────────────

class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rules: Optional[dict] = None


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[dict] = None


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#E8A838"
