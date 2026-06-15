# app/api/v1/analytics.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, cast, Date
from typing import Optional
from app.database import get_db
from app.models.trade import Trade
from app.models.account import Account

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/stats")
async def get_stats(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Trade).where(Trade.close_time.isnot(None))
    if account_id:
        query = query.where(Trade.account_id == account_id)

    result = await db.execute(query)
    trades = result.scalars().all()

    if not trades:
        return {
            "net_profit": 0,
            "gross_profit": 0,
            "gross_loss": 0,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "avg_r": 0,
            "best_r": 0,
            "worst_r": 0,
            "max_consecutive_wins": 0,
            "max_consecutive_losses": 0,
            "max_drawdown": 0,
            "max_drawdown_pct": 0,
            "expectancy": 0,
            "current_equity": 0,
        }

    profits = [float(t.profit) for t in trades]
    r_multiples = [float(t.r_multiple) for t in trades if t.r_multiple]

    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]
    breakeven = [p for p in profits if p == 0]

    net_profit = sum(profits)
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0
    total_trades = len(trades)
    num_wins = len(wins)
    num_losses = len(losses)
    win_rate = (num_wins / total_trades * 100) if total_trades > 0 else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)
    avg_win = (sum(wins) / num_wins) if num_wins > 0 else 0
    avg_loss = (sum(losses) / num_losses) if num_losses > 0 else 0
    avg_r = (sum(r_multiples) / len(r_multiples)) if r_multiples else 0
    best_r = max(r_multiples) if r_multiples else 0
    worst_r = min(r_multiples) if r_multiples else 0

    # Consecutive streaks
    max_consecutive_wins = 0
    max_consecutive_losses = 0
    current_wins = 0
    current_losses = 0
    for t in sorted(trades, key=lambda x: x.open_time):
        if float(t.profit) > 0:
            current_wins += 1
            current_losses = 0
            max_consecutive_wins = max(max_consecutive_wins, current_wins)
        elif float(t.profit) < 0:
            current_losses += 1
            current_wins = 0
            max_consecutive_losses = max(max_consecutive_losses, current_losses)
        else:
            current_wins = 0
            current_losses = 0

    # Drawdown calculation
    cumulative = 0
    peak = 0
    max_drawdown = 0
    for p in profits:
        cumulative += p
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_drawdown:
            max_drawdown = dd

    # Max drawdown percentage
    max_drawdown_pct = 0
    if peak > 0:
        max_drawdown_pct = (max_drawdown / peak) * 100

    # Expectancy
    expectancy = (win_rate / 100 * avg_win) + (1 - win_rate / 100 * avg_loss) if total_trades > 0 else 0

    # Current equity from account
    equity = 0
    if account_id:
        acc_result = await db.execute(
            select(Account.current_balance).where(Account.id == account_id)
        )
        equity = float(acc_result.scalar_one_or_none() or 0)

    return {
        "net_profit": round(net_profit, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "total_trades": total_trades,
        "wins": num_wins,
        "losses": num_losses,
        "breakeven": len(breakeven),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 3),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "avg_r": round(avg_r, 2),
        "best_r": round(best_r, 2),
        "worst_r": round(worst_r, 2),
        "max_consecutive_wins": max_consecutive_wins,
        "max_consecutive_losses": max_consecutive_losses,
        "max_drawdown": round(max_drawdown, 2),
        "max_drawdown_pct": round(max_drawdown_pct, 2),
        "expectancy": round(expectancy, 2),
        "current_equity": round(equity, 2),
    }


@router.get("/session-analysis")
async def get_session_analysis(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Trade).where(
        and_(Trade.close_time.isnot(None), Trade.session.isnot(None))
    )
    if account_id:
        base_query = base_query.where(Trade.account_id == account_id)

    result = await db.execute(base_query)
    trades = result.scalars().all()

    sessions: dict = {}
    for t in trades:
        sess = t.session or "unknown"
        if sess not in sessions:
            sessions[sess] = {
                "session": sess,
                "trades": 0,
                "wins": 0,
                "losses": 0,
                "net_profit": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "total_r": 0.0,
                "best_r": None,
                "worst_r": None,
            }
        s = sessions[sess]
        s["trades"] += 1
        profit = float(t.profit or 0)
        s["net_profit"] += profit
        if profit > 0:
            s["wins"] += 1
            s["gross_profit"] += profit
        elif profit < 0:
            s["losses"] += 1
            s["gross_loss"] += abs(profit)
        if t.r_multiple is not None:
            r = float(t.r_multiple)
            s["total_r"] += r
            if s["best_r"] is None or r > s["best_r"]:
                s["best_r"] = r
            if s["worst_r"] is None or r < s["worst_r"]:
                s["worst_r"] = r

    output = []
    for sess, s in sessions.items():
        win_rate = (s["wins"] / s["trades"] * 100) if s["trades"] > 0 else 0
        gross_loss = s["gross_loss"] if s["gross_loss"] > 0 else 0
        profit_factor = (s["gross_profit"] / gross_loss) if gross_loss > 0 else (s["gross_profit"] if s["gross_profit"] > 0 else 0)
        avg_r = (s["total_r"] / s["trades"]) if s["trades"] > 0 else 0
        output.append({
            "session": s["session"],
            "trades": s["trades"],
            "wins": s["wins"],
            "losses": s["losses"],
            "win_rate": round(win_rate, 2),
            "net_profit": round(s["net_profit"], 2),
            "gross_profit": round(s["gross_profit"], 2),
            "gross_loss": round(s["gross_loss"], 2),
            "profit_factor": round(profit_factor, 3),
            "avg_r": round(avg_r, 2),
            "best_r": round(s["best_r"], 2) if s["best_r"] is not None else 0,
            "worst_r": round(s["worst_r"], 2) if s["worst_r"] is not None else 0,
        })

    output.sort(key=lambda x: x["net_profit"], reverse=True)
    return {"sessions": output}


@router.get("/setup-analysis")
async def get_setup_analysis(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Trade).where(
        and_(Trade.close_time.isnot(None), Trade.setup.isnot(None))
    )
    if account_id:
        base_query = base_query.where(Trade.account_id == account_id)

    result = await db.execute(base_query)
    trades = result.scalars().all()

    setups: dict = {}
    for t in trades:
        setup = t.setup or "unknown"
        if setup not in setups:
            setups[setup] = {
                "setup": setup,
                "trades": 0,
                "wins": 0,
                "losses": 0,
                "net_profit": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "total_r": 0.0,
                "best_r": None,
                "worst_r": None,
                "avg_quality": 0.0,
                "quality_count": 0,
            }
        s = setups[setup]
        s["trades"] += 1
        profit = float(t.profit or 0)
        s["net_profit"] += profit
        if profit > 0:
            s["wins"] += 1
            s["gross_profit"] += profit
        elif profit < 0:
            s["losses"] += 1
            s["gross_loss"] += abs(profit)
        if t.r_multiple is not None:
            r = float(t.r_multiple)
            s["total_r"] += r
            if s["best_r"] is None or r > s["best_r"]:
                s["best_r"] = r
            if s["worst_r"] is None or r < s["worst_r"]:
                s["worst_r"] = r
        if t.setup_quality is not None:
            s["avg_quality"] += float(t.setup_quality)
            s["quality_count"] += 1

    output = []
    for setup, s in setups.items():
        win_rate = (s["wins"] / s["trades"] * 100) if s["trades"] > 0 else 0
        gross_loss = s["gross_loss"] if s["gross_loss"] > 0 else 0
        profit_factor = (s["gross_profit"] / gross_loss) if gross_loss > 0 else (s["gross_profit"] if s["gross_profit"] > 0 else 0)
        avg_r = (s["total_r"] / s["trades"]) if s["trades"] > 0 else 0
        avg_quality = (s["avg_quality"] / s["quality_count"]) if s["quality_count"] > 0 else 0
        output.append({
            "setup": s["setup"],
            "trades": s["trades"],
            "wins": s["wins"],
            "losses": s["losses"],
            "win_rate": round(win_rate, 2),
            "net_profit": round(s["net_profit"], 2),
            "gross_profit": round(s["gross_profit"], 2),
            "gross_loss": round(s["gross_loss"], 2),
            "profit_factor": round(profit_factor, 3),
            "avg_r": round(avg_r, 2),
            "best_r": round(s["best_r"], 2) if s["best_r"] is not None else 0,
            "worst_r": round(s["worst_r"], 2) if s["worst_r"] is not None else 0,
            "avg_quality": round(avg_quality, 1),
        })

    output.sort(key=lambda x: x["net_profit"], reverse=True)
    return {"setups": output}


@router.get("/daily-stats")
async def get_daily_stats(
    account_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime

    base_query = select(Trade).where(Trade.close_time.isnot(None))
    if account_id:
        base_query = base_query.where(Trade.account_id == account_id)
    if start_date:
        sd = datetime.fromisoformat(start_date)
        base_query = base_query.where(Trade.close_time >= sd)
    if end_date:
        ed = datetime.fromisoformat(end_date)
        base_query = base_query.where(Trade.close_time <= ed)

    result = await db.execute(base_query)
    trades = result.scalars().all()

    daily: dict = {}
    for t in trades:
        day = t.close_time.date().isoformat() if t.close_time else None
        if not day:
            continue
        if day not in daily:
            daily[day] = {
                "date": day,
                "trades": 0,
                "wins": 0,
                "losses": 0,
                "net_profit": 0.0,
                "gross_profit": 0.0,
                "gross_loss": 0.0,
                "total_r": 0.0,
            }
        d = daily[day]
        d["trades"] += 1
        profit = float(t.profit or 0)
        d["net_profit"] += profit
        if profit > 0:
            d["wins"] += 1
            d["gross_profit"] += profit
        elif profit < 0:
            d["losses"] += 1
            d["gross_loss"] += abs(profit)
        if t.r_multiple is not None:
            d["total_r"] += float(t.r_multiple)

    output = []
    for day, d in sorted(daily.items()):
        win_rate = (d["wins"] / d["trades"] * 100) if d["trades"] > 0 else 0
        gross_loss = d["gross_loss"] if d["gross_loss"] > 0 else 0
        profit_factor = (d["gross_profit"] / gross_loss) if gross_loss > 0 else (d["gross_profit"] if d["gross_profit"] > 0 else 0)
        avg_r = (d["total_r"] / d["trades"]) if d["trades"] > 0 else 0
        output.append({
            "date": d["date"],
            "trades": d["trades"],
            "wins": d["wins"],
            "losses": d["losses"],
            "win_rate": round(win_rate, 2),
            "net_profit": round(d["net_profit"], 2),
            "gross_profit": round(d["gross_profit"], 2),
            "gross_loss": round(d["gross_loss"], 2),
            "profit_factor": round(profit_factor, 3),
            "avg_r": round(avg_r, 2),
        })

    return {"daily_stats": output}


@router.get("/r-distribution")
async def get_r_distribution(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Trade).where(
        and_(Trade.close_time.isnot(None), Trade.r_multiple.isnot(None))
    )
    if account_id:
        base_query = base_query.where(Trade.account_id == account_id)

    result = await db.execute(base_query)
    trades = result.scalars().all()

    if not trades:
        return {"distribution": [], "summary": {"total": 0, "avg_r": 0, "median_r": 0}}

    r_values = sorted([float(t.r_multiple) for t in trades if t.r_multiple is not None])

    # Build buckets
    min_r = min(r_values)
    max_r = max(r_values)

    # Define bucket ranges
    buckets = [
        {"label": "< -3R", "min": float("-inf"), "max": -3, "count": 0, "profit": 0.0},
        {"label": "-3R to -2R", "min": -3, "max": -2, "count": 0, "profit": 0.0},
        {"label": "-2R to -1R", "min": -2, "max": -1, "count": 0, "profit": 0.0},
        {"label": "-1R to 0", "min": -1, "max": 0, "count": 0, "profit": 0.0},
        {"label": "0 to 0.5R", "min": 0, "max": 0.5, "count": 0, "profit": 0.0},
        {"label": "0.5R to 1R", "min": 0.5, "max": 1, "count": 0, "profit": 0.0},
        {"label": "1R to 2R", "min": 1, "max": 2, "count": 0, "profit": 0.0},
        {"label": "2R to 3R", "min": 2, "max": 3, "count": 0, "profit": 0.0},
        {"label": "> 3R", "min": 3, "max": float("inf"), "count": 0, "profit": 0.0},
    ]

    for t in trades:
        if t.r_multiple is None:
            continue
        r = float(t.r_multiple)
        profit = float(t.profit or 0)
        for b in buckets:
            if r > b["min"] and r <= b["max"]:
                b["count"] += 1
                b["profit"] += profit
                break

    distribution = [
        {
            "label": b["label"],
            "count": b["count"],
            "profit": round(b["profit"], 2),
        }
        for b in buckets
    ]

    avg_r = sum(r_values) / len(r_values) if r_values else 0
    mid = len(r_values) // 2
    median_r = r_values[mid] if len(r_values) % 2 == 1 else (r_values[mid - 1] + r_values[mid]) / 2

    return {
        "distribution": distribution,
        "summary": {
            "total": len(r_values),
            "avg_r": round(avg_r, 2),
            "median_r": round(median_r, 2),
            "min_r": round(min_r, 2),
            "max_r": round(max_r, 2),
        },
    }


# ───────────────────────────────────────────────────────────
# GET /analytics/drawdown — Deep Drawdown Analysis
# ───────────────────────────────────────────────────────────

@router.get("/drawdown")
async def get_drawdown_analysis(
    account_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Deep drawdown analysis: equity curve, peak tracking, drawdown periods."""

    # 1. Build query for closed trades with optional filters
    query = select(Trade).where(Trade.close_time.isnot(None))
    if account_id:
        query = query.where(Trade.account_id == account_id)
    if date_from:
        from datetime import datetime
        try:
            df = datetime.fromisoformat(date_from)
            query = query.where(Trade.close_time >= df)
        except ValueError:
            pass
    if date_to:
        from datetime import datetime
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.where(Trade.close_time <= dt)
        except ValueError:
            pass

    query = query.order_by(Trade.close_time.asc())
    result = await db.execute(query)
    trades = result.scalars().all()

    # If no trades → return zeros
    if not trades:
        return {
            "max_drawdown_pct": 0.0,
            "max_drawdown_abs": 0.0,
            "avg_drawdown_pct": 0.0,
            "current_drawdown_pct": 0.0,
            "nb_drawdown_periods": 0,
            "longest_period_days": 0,
            "drawdown_periods": [],
            "underwater_curve": [],
        }

    # 2. Build equity curve (starting from 0, cumulating PnL)
    #    We use trade close_time as the timestamp
    equity_curve = []  # [{timestamp, equity}, ...]
    cumulative = 0.0
    for t in trades:
        pnl = float(t.profit or 0)
        cumulative += pnl
        equity_curve.append({
            "timestamp": t.close_time.isoformat() if t.close_time else None,
            "equity": round(cumulative, 2),
        })

    # 3. Calculate running peak and drawdown
    peak = 0.0
    max_dd_pct = 0.0
    max_dd_abs = 0.0
    dd_sum_pct = 0.0
    dd_count = 0
    underwater_curve = []

    for point in equity_curve:
        eq = point["equity"]
        if eq > peak:
            peak = eq
        dd_abs = eq - peak
        dd_pct = (dd_abs / peak * 100) if peak > 0 else 0.0
        if dd_pct < 0:
            dd_sum_pct += dd_pct
            dd_count += 1
        if dd_pct < max_dd_pct:
            max_dd_pct = dd_pct
            max_dd_abs = dd_abs
        underwater_curve.append({
            "date": point["timestamp"],
            "equity": point["equity"],
            "drawdown_pct": round(dd_pct, 4),
        })

    avg_dd_pct = round(dd_sum_pct / dd_count, 4) if dd_count > 0 else 0.0
    current_dd_pct = underwater_curve[-1]["drawdown_pct"] if underwater_curve else 0.0

    # 4. Detect drawdown periods (continuous stretches where dd < 0)
    drawdown_periods = []
    in_drawdown = False
    period_start = None
    period_peak_dd_pct = 0.0
    period_peak_dd_abs = 0.0

    from datetime import date as date_type

    for point in underwater_curve:
        dd_pct = point["drawdown_pct"]
        dd_abs = (point["equity"] - (point["equity"] - dd_pct / 100 * point["equity"])) if point["equity"] != 0 else 0

        if dd_pct < 0 and not in_drawdown:
            # Entering drawdown
            in_drawdown = True
            period_start = point["date"]
            period_peak_dd_pct = dd_pct
            period_peak_dd_abs = point["equity"] - (point["equity"] / (1 + dd_pct / 100)) if dd_pct != 0 else 0
        elif dd_pct < 0 and in_drawdown:
            # Still in drawdown → track deepest point
            if dd_pct < period_peak_dd_pct:
                period_peak_dd_pct = dd_pct
                # Recalculate abs from pct
                peak_at_point = point["equity"] / (1 + dd_pct / 100) if dd_pct > -100 else point["equity"]
                period_peak_dd_abs = point["equity"] - peak_at_point
        elif dd_pct >= 0 and in_drawdown:
            # Exiting drawdown
            in_drawdown = False
            period_end = point["date"]
            # Calculate duration
            duration_days = 0
            if period_start and period_end:
                try:
                    d_start = date_type.fromisoformat(period_start[:10])
                    d_end = date_type.fromisoformat(period_end[:10])
                    duration_days = (d_end - d_start).days
                except (ValueError, TypeError):
                    duration_days = 0
            drawdown_periods.append({
                "start": period_start[:10] if period_start else None,
                "end": period_end[:10] if period_end else None,
                "depth_abs": round(period_peak_dd_abs, 2),
                "depth_pct": round(period_peak_dd_pct, 2),
                "duration_days": duration_days,
            })
            period_start = None
            period_peak_dd_pct = 0.0
            period_peak_dd_abs = 0.0

    # If still in drawdown at end of data
    if in_drawdown and period_start:
        period_end = underwater_curve[-1]["date"] if underwater_curve else period_start
        duration_days = 0
        if period_start and period_end:
            try:
                d_start = date_type.fromisoformat(period_start[:10])
                d_end = date_type.fromisoformat(period_end[:10])
                duration_days = (d_end - d_start).days
            except (ValueError, TypeError):
                duration_days = 0
        drawdown_periods.append({
            "start": period_start[:10] if period_start else None,
            "end": period_end[:10] if period_end else None,
            "depth_abs": round(period_peak_dd_abs, 2),
            "depth_pct": round(period_peak_dd_pct, 2),
            "duration_days": duration_days,
        })

    # 5. Find longest period
    longest_days = max((p["duration_days"] for p in drawdown_periods), default=0)

    return {
        "max_drawdown_pct": round(max_dd_pct, 2),
        "max_drawdown_abs": round(max_dd_abs, 2),
        "avg_drawdown_pct": avg_dd_pct,
        "current_drawdown_pct": round(current_dd_pct, 2),
        "nb_drawdown_periods": len(drawdown_periods),
        "longest_period_days": longest_days,
        "drawdown_periods": drawdown_periods,
        "underwater_curve": underwater_curve,
    }
