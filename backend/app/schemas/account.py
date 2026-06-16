# app/schemas/account.py
"""Pydantic schemas for Account model."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SessionConfig(BaseModel):
    """Session hours configuration — hours are in the user's local timezone."""
    Asia: Optional[dict] = None      # {"start": 0, "end": 8}
    London: Optional[dict] = None    # {"start": 8, "end": 12}
    New_York: Optional[dict] = None  # {"start": 13, "end": 21}
    Late_NY: Optional[dict] = None   # {"start": 22, "end": 23}


class AccountBase(BaseModel):
    name: str
    broker: Optional[str] = None
    broker_acct: Optional[str] = None
    account_type: Optional[str] = None  # challenge / funded / personal
    phase: Optional[str] = None
    status: Optional[str] = "active"
    starting_balance: float = 0
    current_balance: float = 0
    target_profit_pct: float = 10
    max_drawdown_pct: float = 7
    daily_loss_pct: float = 5
    personal_target_pct: float = 5
    notes: Optional[str] = None


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    broker: Optional[str] = None
    broker_acct: Optional[str] = None
    account_type: Optional[str] = None
    phase: Optional[str] = None
    status: Optional[str] = None
    starting_balance: Optional[float] = None
    current_balance: Optional[float] = None
    target_profit_pct: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    daily_loss_pct: Optional[float] = None
    personal_target_pct: Optional[float] = None
    session_hours: Optional[dict] = None
    notes: Optional[str] = None


class AccountResponse(AccountBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountSummary(BaseModel):
    """Lightweight account summary for list views."""

    id: int
    name: str
    broker: Optional[str] = None
    account_type: Optional[str] = None
    status: Optional[str] = "active"
    starting_balance: float = 0
    current_balance: float = 0

    class Config:
        from_attributes = True
