# app/models/account.py
from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    broker = Column(String(50))
    broker_acct = Column(String(50))
    account_type = Column(String(20))  # challenge/funded/personal
    phase = Column(String(20))
    status = Column(String(20), default="active")
    starting_balance = Column(Numeric(12, 2), default=0)
    current_balance = Column(Numeric(12, 2), default=0)
    target_profit_pct = Column(Numeric(5, 2), default=10)
    max_drawdown_pct = Column(Numeric(5, 2), default=7)
    daily_loss_pct = Column(Numeric(5, 2), default=5)
    min_trading_days = Column(Integer, default=0)  # 0 = pas de minimum
    session_hours = Column(Text, default="{}")  # JSON: {"asia":{"start":0,"end":9},...}
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    trades = relationship("Trade", back_populates="account", cascade="all, delete-orphan")
    equity_curve = relationship("EquityCurve", back_populates="account", cascade="all, delete-orphan")
    daily_stats = relationship("DailyStats", back_populates="account", cascade="all, delete-orphan")
    checkpoints = relationship("Checkpoint", back_populates="account", cascade="all, delete-orphan")
