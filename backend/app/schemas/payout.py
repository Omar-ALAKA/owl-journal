# app/schemas/payout.py
"""Pydantic schemas for Payout model."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class PayoutBase(BaseModel):
    amount: float
    payout_date: date
    status: str = "pending"  # pending / approved / paid / cancelled
    notes: Optional[str] = None


class PayoutCreate(PayoutBase):
    account_id: int


class PayoutUpdate(BaseModel):
    amount: Optional[float] = None
    payout_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PayoutResponse(PayoutBase):
    id: int
    account_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
