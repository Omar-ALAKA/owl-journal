# app/services/equity.py
"""Equity curve and daily statistics calculation services."""

from datetime import datetime, date
from decimal import Decimal
from typing import Any

from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trade import Trade
from app.models.equity import EquityCurve, DailyStats
from app.models.account import Account


async def calculate_equity_curve(
    account_id: int, db: AsyncSession
) -> list[dict[str, Any]]:
    """Calculate the equity curve for an account.

    Returns a list of dicts with keys:
        timestamp, equity, drawdown, drawdown_pct
    """
    # Fetch account for starting balance
    account_result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return []

    starting_balance = Decimal(str(account.starting_balance or 0))

    # Fetch closed trades ordered by close_time
    trades_result = await db.execute(
        select(Trade)
        .where(
            and_(
                Trade.account_id == account_id,
                Trade.close_time.isnot(None),
            )
        )
        .order_by(Trade.close_time.asc())
    )
    trades = trades_result.scalars().all()

    curve: list[dict[str, Any]] = []
    equity = starting_balance
    peak = equity

    for trade in trades:
        pnl = Decimal(str(trade.profit or 0))
        commission = Decimal(str(trade.commission or 0))
        swap = Decimal(str(trade.swap or 0))
        net = pnl + commission + swap
        equity += net

        if equity > peak:
            peak = equity

        drawdown = peak - equity
        drawdown_pct = (drawdown / peak * 100) if peak > 0 else Decimal("0")

        curve.append(
            {
                "timestamp": trade.close_time,
                "equity": float(equity),
                "drawdown": float(drawdown),
                "drawdown_pct": float(drawdown_pct.quantize(Decimal("0.01"))),
            }
        )

    return curve


async def calculate_daily_stats(
    account_id: int, db: AsyncSession
) -> list[dict[str, Any]]:
    """Calculate daily statistics for an account.

    Returns a list of dicts with keys:
        date, net_pnl, trades, wins, losses
    """
    # Fetch closed trades and aggregate in Python (avoids SQLAlchemy func.case/asyncpg issues)
    trades_result = await db.execute(
        select(Trade)
        .where(
            and_(
                Trade.account_id == account_id,
                Trade.close_time.isnot(None),
            )
        )
        .order_by(Trade.close_time.asc())
    )
    trades = trades_result.scalars().all()

    daily: list[dict[str, Any]] = []
    from collections import defaultdict
    daily_agg: dict[str, dict[str, Any]] = {}

    for t in trades:
        day_str = t.close_time.strftime("%Y-%m-%d")
        if day_str not in daily_agg:
            daily_agg[day_str] = {
                "date": day_str, "net_pnl": 0.0, "trades": 0,
                "wins": 0, "losses": 0,
            }
        d = daily_agg[day_str]
        d["trades"] += 1
        pnl = float(t.profit or 0)
        comm = float(t.commission or 0)
        swp = float(t.swap or 0)
        d["net_pnl"] += pnl + comm + swp
        if pnl > 0:
            d["wins"] += 1
        elif pnl <= 0:
            d["losses"] += 1

    for day_str in sorted(daily_agg.keys()):
        d = daily_agg[day_str]
        daily.append(d)

    return daily
