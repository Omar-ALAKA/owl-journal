# app/api/v1/calendar.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from app.database import get_db
from app.models.trade import Trade
from datetime import datetime, date, timedelta
import calendar

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/")
async def get_calendar_heatmap(
    year: Optional[int] = Query(None, description="Year for the heatmap"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month for the heatmap (1-12)"),
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    # Calculate date range for the requested month
    first_day = date(year, month, 1)
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)

    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, last_day_num, 23, 59, 59)

    # Query closed trades within the date range
    query = select(Trade).where(
        and_(
            Trade.close_time.isnot(None),
            Trade.close_time >= start_dt,
            Trade.close_time <= end_dt,
        )
    )
    if account_id:
        query = query.where(Trade.account_id == account_id)

    result = await db.execute(query)
    trades = result.scalars().all()

    # Aggregate by date
    data: dict = {}
    for t in trades:
        if t.close_time is None:
            continue
        day_str = t.close_time.date().isoformat()
        if day_str not in data:
            data[day_str] = {
                "date": day_str,
                "pl": 0.0,
                "trades": 0,
                "wins": 0,
                "losses": 0,
                "win_rate": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "best_r": None,
                "worst_r": None,
            }
        d = data[day_str]
        d["trades"] += 1
        profit = float(t.profit or 0)
        d["pl"] += profit
        if profit > 0:
            d["wins"] += 1
            d["gross_profit"] += profit
        elif profit < 0:
            d["losses"] += 1
            d["gross_loss"] += abs(profit)
        if t.r_multiple is not None:
            r = float(t.r_multiple)
            if d["best_r"] is None or r > d["best_r"]:
                d["best_r"] = r
            if d["worst_r"] is None or r < d["worst_r"]:
                d["worst_r"] = r

    # Finalize computed fields
    for day_str, d in data.items():
        if d["trades"] > 0:
            d["win_rate"] = round(d["wins"] / d["trades"] * 100, 1)
        d["pl"] = round(d["pl"], 2)
        d["gross_profit"] = round(d["gross_profit"], 2)
        d["gross_loss"] = round(d["gross_loss"], 2)
        d["best_r"] = round(d["best_r"], 2) if d["best_r"] is not None else None
        d["worst_r"] = round(d["worst_r"], 2) if d["worst_r"] is not None else None

    # Summary for the month
    total_trades = sum(d["trades"] for d in data.values())
    total_pl = round(sum(d["pl"] for d in data.values()), 2)
    total_wins = sum(d["wins"] for d in data.values())
    total_losses = sum(d["losses"] for d in data.values())
    win_rate = round(total_wins / total_trades * 100, 1) if total_trades > 0 else 0
    profitable_days = sum(1 for d in data.values() if d["pl"] > 0)
    losing_days = sum(1 for d in data.values() if d["pl"] < 0)

    return {
        "year": year,
        "month": month,
        "data": data,
        "summary": {
            "total_trades": total_trades,
            "total_pl": total_pl,
            "total_wins": total_wins,
            "total_losses": total_losses,
            "win_rate": win_rate,
            "profitable_days": profitable_days,
            "losing_days": losing_days,
            "trading_days": len(data),
        },
    }
