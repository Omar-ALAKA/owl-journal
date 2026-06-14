# app/models/trade.py
from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Text, SmallInteger,
    ForeignKey, UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    ticket = Column(String(50))
    open_time = Column(DateTime, nullable=False)
    close_time = Column(DateTime)
    symbol = Column(String(20), nullable=False)
    direction = Column(String(10))
    volume = Column(Numeric(10, 3), default=0)
    entry_price = Column(Numeric(12, 4), default=0)
    exit_price = Column(Numeric(12, 4), default=0)
    sl_price = Column(Numeric(12, 4), default=0)
    tp_price = Column(Numeric(12, 4), default=0)
    commission = Column(Numeric(10, 2), default=0)
    swap = Column(Numeric(10, 2), default=0)
    profit = Column(Numeric(10, 2), default=0)
    r_multiple = Column(Numeric(6, 2), default=0)
    rr_target = Column(Numeric(6, 2), default=0)
    rr_actual = Column(Numeric(6, 2), default=0)
    session = Column(String(20))
    setup = Column(String(50))
    setup_quality = Column(SmallInteger)
    confluences = Column(Text)
    sl_distance = Column(Numeric(12, 4), default=0)
    tp_distance = Column(Numeric(12, 4), default=0)
    is_winner = Column(SmallInteger, default=0)
    chart_url = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="trades")

    __table_args__ = (
        Index("idx_trades_account", "account_id"),
        Index("idx_trades_open_time", "open_time"),
        Index("idx_trades_setup", "setup"),
        Index("idx_trades_session", "session"),
    )
