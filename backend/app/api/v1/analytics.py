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
# GET /analytics/drawdown — Deep Drawdown Analysis + Monte Carlo
# ───────────────────────────────────────────────────────────

@router.get("/drawdown")
async def get_drawdown_analysis(
    account_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Deep drawdown analysis with Monte Carlo recovery simulation."""
    import random

    # 1. Build query for closed trades
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
        return _empty_drawdown_response()

    # 2. Build equity curve
    equity_curve = []
    cumulative = 0.0
    for t in trades:
        cumulative += float(t.profit or 0)
        equity_curve.append({
            "timestamp": t.close_time.isoformat() if t.close_time else None,
            "equity": round(cumulative, 2),
        })

    # 3. Running peak, drawdown, underwater curve
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

    # 4. Detect drawdown periods
    drawdown_periods = _detect_drawdown_periods(underwater_curve)
    longest_days = max((p["duration_days"] for p in drawdown_periods), default=0)

    # 5. Compute trade stats for Monte Carlo
    profits = [float(t.profit or 0) for t in trades]
    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]
    win_rate = len(wins) / len(profits) if profits else 0.0
    avg_win = sum(wins) / len(wins) if wins else 0.0
    avg_loss = abs(sum(losses) / len(losses)) if losses else 0.0
    ev_per_trade = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)

    # 6. Gain required to recover
    current_equity = equity_curve[-1]["equity"] if equity_curve else 0.0
    peak_equity = max(p["equity"] for p in equity_curve) if equity_curve else 0.0
    dd_abs_current = current_equity - peak_equity
    gain_required_pct = _gain_required_to_recover(abs(dd_abs_current), peak_equity)

    # 7. Consecutive losses to breach limits
    # Use avg_loss as reference; if no losses, use a small default
    ref_loss = avg_loss if avg_loss > 0 else 100.0
    # Overall DD limit: assume 10% of peak (prop firm standard)
    overall_dd_limit_pct = 10.0
    overall_dd_limit_abs = peak_equity * overall_dd_limit_pct / 100
    remaining_dd_room = overall_dd_limit_abs - abs(dd_abs_current)
    consec_losses_to_overall = int(remaining_dd_room / ref_loss) if ref_loss > 0 else 999

    # Daily DD limit: assume 5% of peak
    daily_dd_limit_pct = 5.0
    daily_dd_limit_abs = peak_equity * daily_dd_limit_pct / 100
    consec_losses_to_daily = int(daily_dd_limit_abs / ref_loss) if ref_loss > 0 else 999

    # 8. Monte Carlo simulation (500 paths, max 3000 trades each)
    mc_result = _monte_carlo_recovery(
        win_rate=win_rate,
        avg_win=avg_win,
        avg_loss=avg_loss,
        current_equity=current_equity,
        peak_equity=peak_equity,
        overall_dd_limit_abs=overall_dd_limit_abs,
        daily_dd_limit_abs=daily_dd_limit_abs,
        n_paths=500,
        max_trades=3000,
    )

    return {
        # Basic drawdown metrics
        "max_drawdown_pct": round(max_dd_pct, 2),
        "max_drawdown_abs": round(max_dd_abs, 2),
        "avg_drawdown_pct": avg_dd_pct,
        "current_drawdown_pct": round(current_dd_pct, 2),
        "nb_drawdown_periods": len(drawdown_periods),
        "longest_period_days": longest_days,
        "drawdown_periods": drawdown_periods,
        "underwater_curve": underwater_curve,
        # Recovery metrics
        "current_equity": round(current_equity, 2),
        "peak_equity": round(peak_equity, 2),
        "gain_required_pct": round(gain_required_pct, 2),
        "gain_required_abs": round(peak_equity - current_equity, 2),
        # Trade stats
        "win_rate": round(win_rate * 100, 1),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "ev_per_trade": round(ev_per_trade, 2),
        "total_trades": len(profits),
        # Consecutive losses to limits
        "consec_losses_to_overall_limit": max(0, consec_losses_to_overall),
        "consec_losses_to_daily_limit": max(0, consec_losses_to_daily),
        "remaining_dd_room": round(max(0, remaining_dd_room), 2),
        # Monte Carlo
        "recovery_probability": mc_result["recovery_probability"],
        "blowout_risk": mc_result["blowout_risk"],
        "median_recovery_trades": mc_result["median_recovery_trades"],
        "mean_recovery_trades": mc_result["mean_recovery_trades"],
    }


def _empty_drawdown_response():
    return {
        "max_drawdown_pct": 0.0, "max_drawdown_abs": 0.0,
        "avg_drawdown_pct": 0.0, "current_drawdown_pct": 0.0,
        "nb_drawdown_periods": 0, "longest_period_days": 0,
        "drawdown_periods": [], "underwater_curve": [],
        "current_equity": 0.0, "peak_equity": 0.0,
        "gain_required_pct": 0.0, "gain_required_abs": 0.0,
        "win_rate": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
        "ev_per_trade": 0.0, "total_trades": 0,
        "consec_losses_to_overall_limit": 0,
        "consec_losses_to_daily_limit": 0,
        "remaining_dd_room": 0.0,
        "recovery_probability": 0.0, "blowout_risk": 0.0,
        "median_recovery_trades": 0, "mean_recovery_trades": 0,
    }


def _gain_required_to_recover(dd_abs: float, peak: float) -> float:
    """Gain % required to recover from drawdown: 1/(1-dd_pct) - 1"""
    if peak <= 0:
        return 0.0
    dd_pct = dd_abs / peak
    if dd_pct >= 1.0:
        return float("inf")
    return (1.0 / (1.0 - dd_pct) - 1.0) * 100


def _detect_drawdown_periods(underwater_curve: list) -> list:
    """Detect continuous drawdown periods from underwater curve."""
    from datetime import date as date_type
    periods = []
    in_dd = False
    start = None
    peak_dd_pct = 0.0
    peak_dd_abs = 0.0

    for point in underwater_curve:
        dd_pct = point["drawdown_pct"]
        if dd_pct < 0 and not in_dd:
            in_dd = True
            start = point["date"]
            peak_dd_pct = dd_pct
            peak_dd_abs = point["equity"] - (point["equity"] / (1 + dd_pct / 100)) if dd_pct > -100 and dd_pct != 0 else 0
        elif dd_pct < 0 and in_dd:
            if dd_pct < peak_dd_pct:
                peak_dd_pct = dd_pct
                peak_dd_abs = point["equity"] - (point["equity"] / (1 + dd_pct / 100)) if dd_pct > -100 else 0
        elif dd_pct >= 0 and in_dd:
            in_dd = False
            end = point["date"]
            dur = _calc_duration(start, end)
            periods.append({"start": start[:10] if start else None, "end": end[:10] if end else None,
                           "depth_abs": round(peak_dd_abs, 2), "depth_pct": round(peak_dd_pct, 2), "duration_days": dur})
            start = None
            peak_dd_pct = 0.0
            peak_dd_abs = 0.0

    if in_dd and start:
        end = underwater_curve[-1]["date"] if underwater_curve else start
        dur = _calc_duration(start, end)
        periods.append({"start": start[:10] if start else None, "end": end[:10] if end else None,
                       "depth_abs": round(peak_dd_abs, 2), "depth_pct": round(peak_dd_pct, 2), "duration_days": dur})
    return periods


def _calc_duration(start: str, end: str) -> int:
    from datetime import date as date_type
    try:
        return (date_type.fromisoformat(end[:10]) - date_type.fromisoformat(start[:10])).days
    except (ValueError, TypeError):
        return 0


def _monte_carlo_recovery(
    win_rate: float, avg_win: float, avg_loss: float,
    current_equity: float, peak_equity: float,
    overall_dd_limit_abs: float, daily_dd_limit_abs: float,
    n_paths: int = 500, max_trades: int = 3000,
) -> dict:
    """Run Monte Carlo simulation to estimate recovery probability."""
    import random
    random.seed(42)

    if peak_equity <= 0 or current_equity <= 0:
        return {"recovery_probability": 0.0, "blowout_risk": 100.0,
                "median_recovery_trades": 0, "mean_recovery_trades": 0}

    recovery_trades = []
    blowouts = 0
    timeouts = 0

    for _ in range(n_paths):
        equity = current_equity
        peak = max(current_equity, peak_equity)
        daily_start_equity = equity
        consecutive_losses = 0

        for trade_num in range(1, max_trades + 1):
            # Simulate one trade
            if random.random() < win_rate:
                equity += avg_win
                consecutive_losses = 0
            else:
                equity -= avg_loss
                consecutive_losses += 1

            # Update peak
            if equity > peak:
                peak = equity

            # Check recovery
            if equity >= peak_equity:
                recovery_trades.append(trade_num)
                break

            # Check overall drawdown limit
            overall_dd = peak - equity
            if overall_dd >= overall_dd_limit_abs:
                blowouts += 1
                break

            # Check daily drawdown limit (reset daily every ~20 trades as proxy)
            daily_dd = daily_start_equity - equity
            if daily_dd >= daily_dd_limit_abs:
                blowouts += 1
                break

            # Reset daily equity every 20 trades
            if trade_num % 20 == 0:
                daily_start_equity = equity
        else:
            timeouts += 1

    total = n_paths
    n_recovered = len(recovery_trades)
    recovery_prob = (n_recovered / total * 100) if total > 0 else 0.0
    blowout_risk = ((blowouts + timeouts) / total * 100) if total > 0 else 100.0

    if recovery_trades:
        sorted_trades = sorted(recovery_trades)
        mid = len(sorted_trades) // 2
        median_trades = sorted_trades[mid] if len(sorted_trades) % 2 == 1 else (sorted_trades[mid - 1] + sorted_trades[mid]) / 2
        mean_trades = sum(recovery_trades) / len(recovery_trades)
    else:
        median_trades = 0
        mean_trades = 0

    return {
        "recovery_probability": round(recovery_prob, 1),
        "blowout_risk": round(blowout_risk, 1),
        "median_recovery_trades": int(median_trades),
        "mean_recovery_trades": int(mean_trades),
    }
