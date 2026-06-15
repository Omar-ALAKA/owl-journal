# app/api/v1/equity.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional
from app.database import get_db
from app.models.equity import EquityCurve, DailyStats
from app.models.trade import Trade
from app.models.account import Account

router = APIRouter(prefix="/equity", tags=["equity"])


@router.get("/curve")
async def get_equity_curve(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    # Try to get from EquityCurve table first
    query = select(EquityCurve).order_by(EquityCurve.timestamp.asc())
    if account_id:
        query = query.where(EquityCurve.account_id == account_id)

    result = await db.execute(query)
    curve_points = result.scalars().all()

    if curve_points:
        points = [
            {
                "timestamp": p.timestamp.isoformat(),
                "equity": float(p.equity),
                "drawdown": float(p.drawdown or 0),
                "drawdown_pct": float(p.drawdown_pct or 0),
            }
            for p in curve_points
        ]
        return {
            "source": "equity_curve_table",
            "points": points,
            "count": len(points),
        }

    # Fallback: compute from trades
    trade_query = select(Trade).where(Trade.close_time.isnot(None))
    if account_id:
        trade_query = trade_query.where(Trade.account_id == account_id)
    trade_query = trade_query.order_by(Trade.close_time.asc())

    trade_result = await db.execute(trade_query)
    trades = trade_result.scalars().all()

    if not trades:
        return {
            "source": "computed_from_trades",
            "points": [],
            "count": 0,
        }

    # Get starting balance
    starting_balance = 0
    if account_id:
        acc_result = await db.execute(
            select(Account.starting_balance).where(Account.id == account_id)
        )
        starting_balance = float(acc_result.scalar_one_or_none() or 0)

    points = []
    cumulative = starting_balance
    peak = starting_balance
    for t in trades:
        cumulative += float(t.profit or 0)
        if cumulative > peak:
            peak = cumulative
        drawdown = peak - cumulative
        drawdown_pct = (drawdown / peak * 100) if peak > 0 else 0
        points.append({
            "timestamp": t.close_time.isoformat() if t.close_time else None,
            "equity": round(cumulative, 2),
            "drawdown": round(drawdown, 2),
            "drawdown_pct": round(drawdown_pct, 2),
        })

    return {
        "source": "computed_from_trades",
        "points": points,
        "count": len(points),
    }


@router.get("/daily")
async def get_daily_equity(
    account_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime

    # Try DailyStats table first
    query = select(DailyStats).order_by(DailyStats.trade_date.asc())
    if account_id:
        query = query.where(DailyStats.account_id == account_id)
    if start_date:
        sd = datetime.fromisoformat(start_date)
        query = query.where(DailyStats.trade_date >= sd)
    if end_date:
        ed = datetime.fromisoformat(end_date)
        query = query.where(DailyStats.trade_date <= ed)

    result = await db.execute(query)
    daily_records = result.scalars().all()

    if daily_records:
        records = [
            {
                "date": r.trade_date.isoformat() if hasattr(r.trade_date, 'isoformat') else str(r.trade_date),
                "net_pnl": float(r.net_pnl or 0),
                "gross_profit": float(r.gross_profit or 0),
                "gross_loss": float(r.gross_loss or 0),
                "total_trades": r.total_trades or 0,
                "wins": r.winning_trades or 0,
                "losses": r.losing_trades or 0,
                "win_rate": float(r.win_rate or 0),
                "profit_factor": float(r.profit_factor or 0),
            }
            for r in daily_records
        ]
        return {
            "source": "daily_stats_table",
            "daily": records,
            "count": len(records),
        }

    # Fallback: compute from trades
    trade_query = select(Trade).where(Trade.close_time.isnot(None))
    if account_id:
        trade_query = trade_query.where(Trade.account_id == account_id)
    if start_date:
        sd = datetime.fromisoformat(start_date)
        trade_query = trade_query.where(Trade.close_time >= sd)
    if end_date:
        ed = datetime.fromisoformat(end_date)
        trade_query = trade_query.where(Trade.close_time <= ed)

    trade_result = await db.execute(trade_query)
    trades = trade_result.scalars().all()

    daily: dict = {}
    for t in trades:
        if t.close_time is None:
            continue
        day_str = t.close_time.date().isoformat()
        if day_str not in daily:
            daily[day_str] = {
                "date": day_str,
                "net_pnl": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "total_trades": 0,
                "wins": 0,
                "losses": 0,
            }
        d = daily[day_str]
        d["total_trades"] += 1
        profit = float(t.profit or 0)
        d["net_pnl"] += profit
        if profit > 0:
            d["wins"] += 1
            d["gross_profit"] += profit
        elif profit < 0:
            d["losses"] += 1
            d["gross_loss"] += abs(profit)

    records = []
    for day_str in sorted(daily.keys()):
        d = daily[day_str]
        gross_loss = d["gross_loss"] if d["gross_loss"] > 0 else 0
        profit_factor = (d["gross_profit"] / gross_loss) if gross_loss > 0 else (d["gross_profit"] if d["gross_profit"] > 0 else 0)
        win_rate = (d["wins"] / d["total_trades"] * 100) if d["total_trades"] > 0 else 0
        records.append({
            "date": d["date"],
            "net_pnl": round(d["net_pnl"], 2),
            "gross_profit": round(d["gross_profit"], 2),
            "gross_loss": round(d["gross_loss"], 2),
            "total_trades": d["total_trades"],
            "wins": d["wins"],
            "losses": d["losses"],
            "win_rate": round(win_rate, 2),
            "profit_factor": round(profit_factor, 3),
        })

    return {
        "source": "computed_from_trades",
        "daily": records,
        "count": len(records),
    }
