# app/api/v1/journal.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal
from app.database import get_db
from app.models.trade import Trade
from app.models.account import Account
from app.models.equity import EquityCurve, DailyStats
from app.models.strategy import Strategy

router = APIRouter(prefix="/journal", tags=["journal"])


# ───────────────────────────────────────────────────────────
# GET /journal/sessions  — Stats par session de trading
# ───────────────────────────────────────────────────────────
@router.get("/sessions")
async def get_sessions_analysis(
    account_id: Optional[int] = None,
    session_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retourne l'analyse des performances groupées par session."""

    conditions = [Trade.close_time.isnot(None)]
    if account_id:
        conditions.append(Trade.account_id == account_id)

    # Récupérer toutes les sessions distinctes
    session_query = select(Trade.session).where(and_(*conditions)).distinct()
    if session_filter:
        session_query = session_query.where(Trade.session == session_filter)
    session_query = session_query.order_by(Trade.session)
    session_result = await db.execute(session_query)
    sessions = [s[0] for s in session_result.all() if s[0]]

    session_stats = []
    for sess in sessions:
        trade_conditions = and_(
            Trade.session == sess,
            Trade.close_time.isnot(None),
            *([Trade.account_id == account_id] if account_id else []),
        )

        # Stats agrégées
        stats_query = select(
            func.count().label("total_trades"),
            func.sum(case((Trade.profit > 0, 1), else_=0)).label("wins"),
            func.sum(case((Trade.profit < 0, 1), else_=0)).label("losses"),
            func.sum(Trade.profit).label("net_pnl"),
            func.avg(Trade.profit).label("avg_pnl"),
            func.avg(Trade.r_multiple).label("avg_r_multiple"),
            func.max(Trade.profit).label("best_trade"),
            func.min(Trade.profit).label("worst_trade"),
            func.sum(Trade.commission).label("total_commission"),
            func.sum(Trade.swap).label("total_swap"),
        ).where(trade_conditions)
        stats_result = await db.execute(stats_query)
        row = stats_result.one()

        total = row.total_trades or 0
        wins = row.wins or 0
        losses = row.losses or 0
        net_pnl = float(row.net_pnl or 0)
        avg_pnl = float(row.avg_pnl or 0)
        avg_r = float(row.avg_r_multiple or 0)
        best = float(row.best_trade or 0)
        worst = float(row.worst_trade or 0)
        commission = float(row.total_commission or 0)
        swap = float(row.total_swap or 0)
        win_rate = (wins / total * 100) if total > 0 else 0

        session_stats.append({
            "session": sess,
            "total_trades": total,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "net_pnl": round(net_pnl, 2),
            "avg_pnl": round(avg_pnl, 2),
            "avg_r_multiple": round(avg_r, 2),
            "best_trade": round(best, 2),
            "worst_trade": round(worst, 2),
            "total_commission": round(commission, 2),
            "total_swap": round(swap, 2),
        })

    return {
        "sessions": session_stats,
        "count": len(session_stats),
    }


# ───────────────────────────────────────────────────────────
# GET /journal/streaks  — Séquences win / loss consécutives
# ───────────────────────────────────────────────────────────
@router.get("/streaks")
async def get_streaks(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Calcule les séquences de wins et losses consécutives."""

    conditions = [Trade.close_time.isnot(None)]
    if account_id:
        conditions.append(Trade.account_id == account_id)

    query = (
        select(Trade.profit)
        .where(and_(*conditions))
        .order_by(Trade.open_time.asc())
    )
    result = await db.execute(query)
    profits = [float(row[0]) for row in result.all()]

    if not profits:
        return {
            "current_streak": {"type": None, "count": 0},
            "max_win_streak": 0,
            "max_loss_streak": 0,
            "avg_win_streak": 0,
            "avg_loss_streak": 0,
            "streaks": [],
        }

    streaks = []
    current_type = None
    current_count = 0

    for p in profits:
        t = "win" if p > 0 else "loss" if p < 0 else "breakeven"
        if t == "breakeven":
            continue
        if t == current_type:
            current_count += 1
        else:
            if current_type is not None:
                streaks.append({"type": current_type, "count": current_count})
            current_type = t
            current_count = 1
    if current_type is not None:
        streaks.append({"type": current_type, "count": current_count})

    win_streaks = [s["count"] for s in streaks if s["type"] == "win"]
    loss_streaks = [s["count"] for s in streaks if s["type"] == "loss"]

    # Current streak (last one)
    current_streak = streaks[-1] if streaks else {"type": None, "count": 0}

    return {
        "current_streak": current_streak,
        "max_win_streak": max(win_streaks) if win_streaks else 0,
        "max_loss_streak": max(loss_streaks) if loss_streaks else 0,
        "avg_win_streak": round(sum(win_streaks) / len(win_streaks), 1) if win_streaks else 0,
        "avg_loss_streak": round(sum(loss_streaks) / len(loss_streaks), 1) if loss_streaks else 0,
        "total_streaks": len(streaks),
        "streaks": streaks[-20:],  # 20 dernières séquences
    }


# ───────────────────────────────────────────────────────────
# GET /journal/equity  — Courbe d'equity
# ───────────────────────────────────────────────────────────
@router.get("/equity")
async def get_equity_curve(
    view: str = Query("global", pattern="^(global|challenge|percent)$"),
    account_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Retourne la courbe d'equity.
    - view=global: equity absolue
    - view=challenge: equity des comptes de type 'challenge'
    - view=percent: equity en pourcentage (base 100)
    """

    # Construire la requête de base sur EquityCurve
    query = select(EquityCurve)

    if account_id:
        query = query.where(EquityCurve.account_id == account_id)
    elif view == "challenge":
        # Joindre les comptes de type challenge
        query = query.join(Account, EquityCurve.account_id == Account.id).where(
            Account.account_type == "challenge"
        )

    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date)
            query = query.where(EquityCurve.timestamp >= dt_from)
        except ValueError:
            raise HTTPException(400, "Invalid from_date format (ISO 8601)")

    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date)
            query = query.where(EquityCurve.timestamp <= dt_to)
        except ValueError:
            raise HTTPException(400, "Invalid to_date format (ISO 8601)")

    query = query.order_by(EquityCurve.timestamp.asc())
    result = await db.execute(query)
    points = result.scalars().all()

    if not points:
        return {"view": view, "data": [], "count": 0}

    data = []
    base_equity = None

    for p in points:
        equity_val = float(p.equity)
        if view == "percent":
            if base_equity is None:
                base_equity = equity_val
            pct = (equity_val / base_equity * 100) if base_equity else 100
            data.append({
                "timestamp": p.timestamp.isoformat(),
                "equity": round(pct, 2),
                "drawdown_pct": float(p.drawdown_pct or 0),
                "account_id": p.account_id,
            })
        else:
            data.append({
                "timestamp": p.timestamp.isoformat(),
                "equity": equity_val,
                "drawdown": float(p.drawdown or 0),
                "drawdown_pct": float(p.drawdown_pct or 0),
                "account_id": p.account_id,
            })

    return {
        "view": view,
        "data": data,
        "count": len(data),
    }


# ───────────────────────────────────────────────────────────
# GET /journal/daily  — Stats journalières (depuis DailyStats)
# ───────────────────────────────────────────────────────────
@router.get("/daily")
async def get_daily_stats(
    account_id: Optional[int] = None,
    limit: int = Query(90, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Retourne les statistiques journalières."""
    query = select(DailyStats)
    if account_id:
        query = query.where(DailyStats.account_id == account_id)
    query = query.order_by(DailyStats.trade_date.desc()).limit(limit)
    result = await db.execute(query)
    stats = result.scalars().all()

    return {
        "daily": [
            {
                "id": s.id,
                "account_id": s.account_id,
                "trade_date": s.trade_date.isoformat() if s.trade_date else None,
                "net_pnl": float(s.net_pnl or 0),
                "gross_profit": float(s.gross_profit or 0),
                "gross_loss": float(s.gross_loss or 0),
                "total_trades": s.total_trades or 0,
                "wins": s.winning_trades or 0,
                "losses": s.losing_trades or 0,
                "win_rate": float(s.win_rate or 0),
                "profit_factor": float(s.profit_factor or 0),
            }
            for s in stats
        ],
        "count": len(stats),
    }
