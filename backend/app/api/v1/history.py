# app/api/v1/history.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from typing import Optional
from app.database import get_db
from app.models.account import Account
from app.models.trade import Trade
from app.models.equity import EquityCurve, DailyStats

router = APIRouter(prefix="/history", tags=["history"])


# ───────────────────────────────────────────────────────────
# GET /history  — Historique des comptes avec stats agrégées
# ───────────────────────────────────────────────────────────
@router.get("/")
async def get_history(
    account_type: Optional[str] = None,
    status: Optional[str] = None,
    broker: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Retourne l'historique de tous les comptes avec leurs statistiques agrégées."""

    query = select(Account)
    if account_type:
        query = query.where(Account.account_type == account_type)
    if status:
        query = query.where(Account.status == status)
    if broker:
        query = query.where(Account.broker.ilike(f"%{broker}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Account.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    accounts = result.scalars().all()

    history = []
    for acc in accounts:
        # Stats agrégées pour ce compte - fetch trades and aggregate in Python (avoids func.case + asyncpg issues)
        trades_query = select(
            Trade.profit,
            Trade.r_multiple,
        ).where(
            and_(
                Trade.account_id == acc.id,
                Trade.close_time.isnot(None),
            )
        )
        trades_result = await db.execute(trades_query)
        rows = trades_result.all()

        total_trades = len(rows)
        wins = sum(1 for r in rows if float(r[0] or 0) > 0)
        losses = sum(1 for r in rows if float(r[0] or 0) < 0)
        net_pnl = sum(float(r[0] or 0) for r in rows)
        avg_pnl = (net_pnl / total_trades) if total_trades > 0 else 0
        profits = [float(r[0] or 0) for r in rows]
        best_trade = max(profits) if profits else 0
        worst_trade = min(profits) if profits else 0
        r_vals = [float(r[1] or 0) for r in rows if r[1] is not None]
        avg_r_multiple = (sum(r_vals) / len(r_vals)) if r_vals else 0

        ts_row = type('Row', (), {
            'total_trades': total_trades,
            'wins': wins,
            'losses': losses,
            'net_pnl': net_pnl,
            'avg_pnl': avg_pnl,
            'best_trade': best_trade,
            'worst_trade': worst_trade,
            'avg_r_multiple': avg_r_multiple,
        })()

        ts = ts_row

        # Max drawdown depuis EquityCurve
        dd_query = select(func.min(EquityCurve.drawdown_pct)).where(
            EquityCurve.account_id == acc.id
        )
        max_dd = await db.scalar(dd_query)

        # Dernier trade
        last_trade_query = (
            select(Trade.open_time)
            .where(Trade.account_id == acc.id)
            .order_by(Trade.open_time.desc())
            .limit(1)
        )
        last_trade_date = await db.scalar(last_trade_query)

        total_trades = ts.total_trades or 0
        wins = ts.wins or 0
        losses = ts.losses or 0
        net_pnl = float(ts.net_pnl or 0)
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

        starting = float(acc.starting_balance or 0)
        roi = (net_pnl / starting * 100) if starting > 0 else 0

        history.append({
            "id": acc.id,
            "name": acc.name,
            "broker": acc.broker,
            "broker_acct": acc.broker_acct,
            "account_type": acc.account_type,
            "phase": acc.phase,
            "status": acc.status,
            "starting_balance": starting,
            "current_balance": float(acc.current_balance or 0),
            "target_profit_pct": float(acc.target_profit_pct or 0),
            "max_drawdown_pct": float(acc.max_drawdown_pct or 0),
            "daily_loss_pct": float(acc.daily_loss_pct or 0),
            "stats": {
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate, 2),
                "net_pnl": round(net_pnl, 2),
                "avg_pnl": round(float(ts.avg_pnl or 0), 2),
                "avg_r_multiple": round(float(ts.avg_r_multiple or 0), 2),
                "best_trade": round(float(ts.best_trade or 0), 2),
                "worst_trade": round(float(ts.worst_trade or 0), 2),
                "max_drawdown_pct": round(float(max_dd or 0), 2),
                "roi_pct": round(roi, 2),
            },
            "last_trade_date": last_trade_date.isoformat() if last_trade_date else None,
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
            "updated_at": acc.updated_at.isoformat() if acc.updated_at else None,
        })

    return {
        "accounts": history,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


# ───────────────────────────────────────────────────────────
# GET /history/{account_id}  — Historique détaillé d'un compte
# ───────────────────────────────────────────────────────────
@router.get("/{account_id}")
async def get_account_history(
    account_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retourne l'historique complet d'un compte avec equity curve et daily stats."""

    # Vérifier que le compte existe
    acc_result = await db.execute(select(Account).where(Account.id == account_id))
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Equity curve
    eq_query = (
        select(EquityCurve)
        .where(EquityCurve.account_id == account_id)
        .order_by(EquityCurve.timestamp.asc())
    )
    eq_result = await db.execute(eq_query)
    equity_points = eq_result.scalars().all()

    # Daily stats
    daily_query = (
        select(DailyStats)
        .where(DailyStats.account_id == account_id)
        .order_by(DailyStats.trade_date.desc())
        .limit(90)
    )
    daily_result = await db.execute(daily_query)
    daily_stats = daily_result.scalars().all()

    return {
        "account": {
            "id": account.id,
            "name": account.name,
            "broker": account.broker,
            "account_type": account.account_type,
            "phase": account.phase,
            "status": account.status,
            "starting_balance": float(account.starting_balance or 0),
            "current_balance": float(account.current_balance or 0),
        },
        "equity_curve": [
            {
                "timestamp": p.timestamp.isoformat(),
                "equity": float(p.equity),
                "drawdown": float(p.drawdown or 0),
                "drawdown_pct": float(p.drawdown_pct or 0),
            }
            for p in equity_points
        ],
        "daily_stats": [
            {
                "trade_date": s.trade_date.isoformat() if s.trade_date else None,
                "net_pnl": float(s.net_pnl or 0),
                "total_trades": s.total_trades or 0,
                "win_rate": float(s.win_rate or 0),
                "profit_factor": float(s.profit_factor or 0),
            }
            for s in daily_stats
        ],
    }
