# app/models/account.py
from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, func, Boolean, JSON, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    broker = Column(String(50))
    broker_acct = Column(String(50))
    account_number = Column(String(50))
    platform = Column(String(30))
    account_type = Column(String(20))  # challenge/funded/personal
    challenge_type = Column(String(30))
    phase = Column(String(20))
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="active")
    is_active = Column(Boolean, default=True)
    starting_balance = Column(Numeric(12, 2), default=0)
    current_balance = Column(Numeric(12, 2), default=0)
    target_profit_pct = Column(Numeric(5, 2), default=10)
    max_drawdown_pct = Column(Numeric(5, 2), default=7)
    daily_loss_pct = Column(Numeric(5, 2), default=5)
    min_trading_days = Column(Integer, default=0)
    session_hours = Column(Text, default="{}")
    rules = Column(JSONB, default={})
    # Funded-specific: personal objective (not imposed by prop firm)
    personal_target_pct = Column(Numeric(5, 2), default=5)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    trades = relationship("Trade", back_populates="account", cascade="all, delete-orphan")
    equity_curve = relationship("EquityCurve", back_populates="account", cascade="all, delete-orphan")
    daily_stats = relationship("DailyStats", back_populates="account", cascade="all, delete-orphan")
    checkpoints = relationship("Checkpoint", back_populates="account", cascade="all, delete-orphan")
    payouts = relationship("Payout", back_populates="account", cascade="all, delete-orphan")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payout_date = Column(Date, nullable=False)
    status = Column(String(20), default="pending")  # pending/approved/paid/cancelled
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="payouts")
