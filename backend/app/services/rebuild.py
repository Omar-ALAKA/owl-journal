# app/services/rebuild.py
"""Rebuild equity curve and daily stats from trades."""

from datetime import datetime
from typing import Any

from sqlalchemy import select, delete, and_, cast, Date, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trade import Trade
from app.models.equity import EquityCurve, DailyStats
from app.models.account import Account


async def rebuild_equity_curve(
    account_id: int, db: AsyncSession
) -> dict[str, Any]:
    """Rebuild the entire equity curve for an account.

    Deletes existing curve points, recalculates from trades, and
    persists the new curve to the database.

    Returns a report dict with counts and status.
    """
    # Delete existing curve points
    await db.execute(
        delete(EquityCurve).where(EquityCurve.account_id == account_id)
    )
    await db.flush()

    # Fetch account
    account_result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return {"status": "error", "message": "Account not found", "points_created": 0}

    starting_balance = float(account.starting_balance or 0)

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

    equity = starting_balance
    peak = equity
    points_created = 0

    for trade in trades:
        pnl = float(trade.profit or 0)
        commission = float(trade.commission or 0)
        swap = float(trade.swap or 0)
        net = pnl + commission + swap
        equity += net

        if equity > peak:
            peak = equity

        drawdown = peak - equity
        drawdown_pct = round((drawdown / peak * 100) if peak > 0 else 0, 2)

        point = EquityCurve(
            account_id=account_id,
            timestamp=trade.close_time,
            equity=round(equity, 2),
            drawdown=round(drawdown, 2),
            drawdown_pct=drawdown_pct,
        )
        db.add(point)
        points_created += 1

    await db.flush()

    return {
        "status": "success",
        "account_id": account_id,
        "points_created": points_created,
        "starting_balance": starting_balance,
        "final_equity": round(equity, 2),
        "peak_equity": round(peak, 2),
        "max_drawdown": round(peak - min(equity, peak), 2) if points_created > 0 else 0,
    }


async def rebuild_daily_stats(
    account_id: int, db: AsyncSession
) -> dict[str, Any]:
    """Rebuild daily statistics for an account.

    Deletes existing daily stats, recalculates from trades, and
    persists the new stats to the database.

    Returns a report dict with counts and status.
    """
    # Delete existing daily stats
    await db.execute(
        delete(DailyStats).where(DailyStats.account_id == account_id)
    )
    await db.flush()

    # Aggregate trades by day
    agg_result = await db.execute(
        select(
            cast(Trade.close_time, Date).label("trade_date"),
            func.count(Trade.id).label("total_trades"),
            func.sum(
                func.case((Trade.profit > 0, Trade.profit), else_=0)
            ).label("gross_profit"),
            func.sum(
                func.case((Trade.profit <= 0, Trade.profit), else_=0)
            ).label("gross_loss"),
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

    rows = agg_result.all()
    days_created = 0

    for row in rows:
        trade_date = row.trade_date
        total_trades = row.total_trades or 0
        wins = row.wins or 0
        losses = row.losses or 0
        gross_profit = float(row.gross_profit or 0)
        gross_loss = abs(float(row.gross_loss or 0))
        net_pnl = float(row.net_pnl or 0)

        win_rate = round(wins / total_trades * 100, 2) if total_trades > 0 else 0
        profit_factor = round(gross_profit / gross_loss, 3) if gross_loss > 0 else 0

        stat = DailyStats(
            account_id=account_id,
            trade_date=datetime.combine(trade_date, datetime.min.time()),
            net_pnl=round(net_pnl, 2),
            gross_profit=round(gross_profit, 2),
            gross_loss=round(gross_loss, 2),
            total_trades=total_trades,
            wins=wins,
            losses=losses,
            win_rate=win_rate,
            profit_factor=profit_factor,
        )
        db.add(stat)
        days_created += 1

    await db.flush()

    return {
        "status": "success",
        "account_id": account_id,
        "days_created": days_created,
        "total_trades_processed": sum(r.total_trades or 0 for r in rows),
    }
