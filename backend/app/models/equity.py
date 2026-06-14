# app/models/equity.py
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class EquityCurve(Base):
    __tablename__ = "equity_curve"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    equity = Column(Numeric(12, 2), nullable=False)
    drawdown = Column(Numeric(12, 2), default=0)
    drawdown_pct = Column(Numeric(6, 2), default=0)

    account = relationship("Account", back_populates="equity_curve")

    __table_args__ = (
        UniqueConstraint("account_id", "timestamp"),
        Index("idx_equity_account_time", "account_id", "timestamp"),
    )


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    trade_date = Column(DateTime, nullable=False)
    net_pnl = Column(Numeric(12, 2), default=0)
    gross_profit = Column(Numeric(12, 2), default=0)
    gross_loss = Column(Numeric(12, 2), default=0)
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Numeric(5, 2), default=0)
    profit_factor = Column(Numeric(6, 3), default=0)

    account = relationship("Account", back_populates="daily_stats")

    __table_args__ = (
        UniqueConstraint("account_id", "trade_date"),
        Index("idx_daily_account_date", "account_id", "trade_date"),
    )


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    checkpoint_type = Column(String(30), nullable=False)
    balance = Column(Numeric(12, 2), nullable=False)
    equity = Column(Numeric(12, 2), nullable=False)
    drawdown_pct = Column(Numeric(6, 2), default=0)
    notes = Column("note", Text)
    created_at = Column(DateTime)

    account = relationship("Account", back_populates="checkpoints")
