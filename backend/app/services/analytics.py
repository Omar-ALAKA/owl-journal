# app/services/analytics.py
"""Analytics and KPI calculation services."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trade import Trade
from app.models.account import Account
from app.services.equity import calculate_equity_curve


def detect_session(open_time: datetime) -> str:
    """Detect the trading session based on UTC hour of trade open_time.

    Priority:
      - Asia:        00:00 - 08:59 UTC
      - London:      07:00 - 11:59 UTC (no overlap with NY)
      - London/NY:   12:00 - 15:59 UTC (overlap)
      - New York:    16:00 - 20:59 UTC (no overlap with London)
      - Outside defined sessions -> returns "Other"
    """
    hour = open_time.hour  # open_time is expected to be UTC
    if 0 <= hour < 9:
        return "Asia"
    elif 9 <= hour < 12:
        return "London"
    elif 12 <= hour < 16:
        return "London/NY"
    elif 16 <= hour < 21:
        return "New York"
    else:
        return "Other"


async def calculate_kpis(account_id: int, db: AsyncSession) -> dict[str, Any]:
    """Calculate all KPIs for an account.

    Returns a dict with comprehensive trading metrics.
    """
    account_result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return {}

    trades_result = await db.execute(
        select(Trade).where(
            and_(
                Trade.account_id == account_id,
                Trade.close_time.isnot(None),
            )
        )
    )
    trades = trades_result.scalars().all()

    total_trades = len(trades)
    if total_trades == 0:
        return {
            "account_id": account_id,
            "total_trades": 0,
            "net_pnl": 0,
            "gross_profit": 0,
            "gross_loss": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "avg_win": 0,
            "avg_loss": 0,
            "expectancy": 0,
            "avg_trade": 0,
            "largest_win": 0,
            "largest_loss": 0,
            "avg_r_multiple": 0,
            "sharpe_ratio": 0,
            "calmar_ratio": 0,
            "max_drawdown": 0,
            "max_drawdown_pct": 0,
            "recovery_factor": 0,
            "payoff_ratio": 0,
        }

    wins = [t for t in trades if float(t.profit or 0) > 0]
    losses = [t for t in trades if float(t.profit or 0) <= 0]

    gross_profit = sum(float(t.profit or 0) for t in wins)
    gross_loss = abs(sum(float(t.profit or 0) for t in losses))
    net_pnl = gross_profit - gross_loss

    win_rate = (len(wins) / total_trades * 100) if total_trades > 0 else 0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf")

    avg_win = (gross_profit / len(wins)) if wins else 0
    avg_loss = (gross_loss / len(losses)) if losses else 0
    expectancy = (win_rate / 100 * avg_win) - ((1 - win_rate / 100) * avg_loss)
    avg_trade = net_pnl / total_trades

    largest_win = max((float(t.profit or 0) for t in wins), default=0)
    largest_loss = min((float(t.profit or 0) for t in losses), default=0)

    r_values = [float(t.r_multiple or 0) for t in trades if t.r_multiple]
    avg_r = (sum(r_values) / len(r_values)) if r_values else 0

    # Drawdown from equity curve
    curve = await calculate_equity_curve(account_id, db)
    max_dd = 0
    max_dd_pct = 0
    if curve:
        max_dd = max((point["drawdown"] for point in curve), default=0)
        max_dd_pct = max((point["drawdown_pct"] for point in curve), default=0)

    # Sharpe-like ratio (simplified)
    if len(trades) > 1:
        import math

        pnls = [float(t.profit or 0) for t in trades]
        mean_pnl = sum(pnls) / len(pnls)
        variance = sum((p - mean_pnl) ** 2 for p in pnls) / len(pnls)
        std_pnl = math.sqrt(variance)
        sharpe = (mean_pnl / std_pnl * math.sqrt(252)) if std_pnl > 0 else 0
    else:
        sharpe = 0

    calmar = (net_pnl / max_dd) if max_dd > 0 else 0
    recovery = (net_pnl / max_dd) if max_dd > 0 else 0
    payoff = (avg_win / avg_loss) if avg_loss > 0 else 0

    return {
        "account_id": account_id,
        "total_trades": total_trades,
        "net_pnl": round(net_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "win_rate": round(win_rate, 2),
        "profit_factor": round(profit_factor, 3),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "expectancy": round(expectancy, 2),
        "avg_trade": round(avg_trade, 2),
        "largest_win": round(largest_win, 2),
        "largest_loss": round(largest_loss, 2),
        "avg_r_multiple": round(avg_r, 2),
        "sharpe_ratio": round(sharpe, 3),
        "calmar_ratio": round(calmar, 3),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "recovery_factor": round(recovery, 3),
        "payoff_ratio": round(payoff, 3),
    }


async def calculate_streaks(account_id: int, db: AsyncSession) -> dict[str, Any]:
    """Calculate winning and losing streaks.

    Returns dict with current_streak, best_win_streak, best_loss_streak.
    """
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

    if not trades:
        return {
            "current_streak": 0,
            "current_type": "none",
            "best_win_streak": 0,
            "best_loss_streak": 0,
        }

    best_win = 0
    best_loss = 0
    current_streak = 0
    current_type = "none"

    for trade in trades:
        is_win = float(trade.profit or 0) > 0
        trade_type = "win" if is_win else "loss"

        if current_type == trade_type:
            current_streak += 1
        else:
            current_streak = 1
            current_type = trade_type

        if is_win and current_streak > best_win:
            best_win = current_streak
        elif not is_win and current_streak > best_loss:
            best_loss = current_streak

    return {
        "current_streak": current_streak,
        "current_type": current_type,
        "best_win_streak": best_win,
        "best_loss_streak": best_loss,
    }


async def calculate_drawdown(account_id: int, db: AsyncSession) -> dict[str, Any]:
    """Calculate drawdown metrics for an account.

    Returns dict with max_dd, current_dd, max_dd_pct, current_dd_pct.
    """
    curve = await calculate_equity_curve(account_id, db)

    if not curve:
        return {
            "max_drawdown": 0,
            "max_drawdown_pct": 0,
            "current_drawdown": 0,
            "current_drawdown_pct": 0,
            "peak_equity": 0,
            "current_equity": 0,
        }

    max_dd = max(point["drawdown"] for point in curve)
    max_dd_pct = max(point["drawdown_pct"] for point in curve)

    last = curve[-1]
    current_equity = last["equity"]
    current_dd = last["drawdown"]
    current_dd_pct = last["drawdown_pct"]

    peak = max(point["equity"] for point in curve)

    return {
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "current_drawdown": round(current_dd, 2),
        "current_drawdown_pct": round(current_dd_pct, 2),
        "peak_equity": round(peak, 2),
        "current_equity": round(current_equity, 2),
    }
