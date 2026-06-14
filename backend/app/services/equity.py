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
    # Aggregate trades by day
    trades_result = await db.execute(
        select(
            cast(Trade.close_time, Date).label("trade_date"),
            func.count(Trade.id).label("total_trades"),
            func.sum(Trade.profit + Trade.commission + Trade.swap).label("net_pnl"),
            func.sum(
                func.case((Trade.profit > 0, 1), else_=0)
            ).label("wins"),
            func.sum(
                func.case((Trade.profit <= 0, 1), else_=0)
            ).label("losses"),
        )
        .where(
            and_(
                Trade.account_id == account_id,
                Trade.close_time.isnot(None),
            )
        )
        .group_by(cast(Trade.close_time, Date))
        .order_by(cast(Trade.close_time, Date).asc())
    )

    rows = trades_result.all()

    daily: list[dict[str, Any]] = []
    for row in rows:
        trade_date = row.trade_date
        if isinstance(trade_date, str):
            trade_date = date.fromisoformat(trade_date)

        total_trades = row.total_trades or 0
        wins = row.wins or 0
        losses = row.losses or 0

        daily.append(
            {
                "date": trade_date,
                "net_pnl": float(row.net_pnl or 0),
                "trades": total_trades,
                "wins": wins,
                "losses": losses,
            }
        )

    return daily
