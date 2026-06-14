# app/api/v1/challenge.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from typing import Optional
from decimal import Decimal
from app.database import get_db
from app.models.account import Account
from app.models.trade import Trade
from app.models.equity import Checkpoint

router = APIRouter(prefix="/challenge", tags=["challenge"])


# ───────────────────────────────────────────────────────────
# GET /challenge/current  — Challenge actif avec stats live
# ───────────────────────────────────────────────────────────
@router.get("/current")
async def get_current_challenge(
    db: AsyncSession = Depends(get_db),
):
    """
    Retourne le challenge actif: compte(s) de type 'challenge' avec
    statut 'active', avec calculs live (equity, drawdown, progression).
    """

    # Trouver les comptes challenge actifs
    acc_query = select(Account).where(
        and_(
            Account.account_type == "challenge",
            Account.status == "active",
        )
    ).order_by(Account.created_at.asc())
    acc_result = await db.execute(acc_query)
    accounts = acc_result.scalars().all()

    if not accounts:
        return {
            "active": False,
            "message": "No active challenge account found",
            "challenges": [],
        }

    challenges = []
    for acc in accounts:
        # Dernier checkpoint
        cp_query = (
            select(Checkpoint)
            .where(Checkpoint.account_id == acc.id)
            .order_by(Checkpoint.created_at.desc())
            .limit(1)
        )
        cp_result = await db.execute(cp_query)
        last_checkpoint = cp_result.scalar_one_or_none()

        # Stats trades du compte
        trade_query = select(
            func.count().label("total_trades"),
            func.sum(case((Trade.profit > 0, 1), else_=0)).label("wins"),
            func.sum(case((Trade.profit < 0, 1), else_=0)).label("losses"),
            func.sum(Trade.profit).label("net_pnl"),
            func.avg(Trade.profit).label("avg_pnl"),
            func.max(Trade.profit).label("best_trade"),
            func.min(Trade.profit).label("worst_trade"),
            func.min(Trade.close_time).label("first_trade"),
            func.max(Trade.close_time).label("last_trade"),
        ).where(
            and_(
                Trade.account_id == acc.id,
                Trade.close_time.isnot(None),
            )
        )
        trade_result = await db.execute(trade_query)
        ts = trade_result.one()

        # Max drawdown personalisé
        all_trades_query = (
            select(Trade.profit)
            .where(
                and_(
                    Trade.account_id == acc.id,
                    Trade.close_time.isnot(None),
                )
            )
            .order_by(Trade.open_time.asc())
        )
        all_trades_result = await db.execute(all_trades_query)
        profits = [float(row[0]) for row in all_trades_result.all()]

        max_dd = 0
        peak = float(acc.starting_balance or 0)
        running = peak
        for p in profits:
            running += p
            if running > peak:
                peak = running
            dd = peak - running
            if dd > max_dd:
                max_dd = dd

        starting = float(acc.starting_balance or 0)
        net_pnl = float(ts.net_pnl or 0)
        current_equity = starting + net_pnl
        target = starting * (1 + float(acc.target_profit_pct or 10) / 100)
        progress = (net_pnl / (target - starting) * 100) if target > starting else 0

        total_trades = ts.total_trades or 0
        wins = ts.wins or 0
        losses = ts.losses or 0
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

        max_drawdown_val = max_dd
        max_drawdown_pct = (max_dd / starting * 100) if starting > 0 else 0
        dd_limit = float(acc.max_drawdown_pct or 7)

        challenges.append({
            "id": acc.id,
            "name": acc.name,
            "broker": acc.broker,
            "phase": acc.phase,
            "starting_balance": starting,
            "current_equity": round(current_equity, 2),
            "target_equity": round(target, 2),
            "progress_pct": round(progress, 2),
            "net_pnl": round(net_pnl, 2),
            "net_pnl_pct": round(net_pnl / starting * 100, 2) if starting else 0,
            "max_drawdown": round(max_drawdown_val, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "drawdown_limit_pct": dd_limit,
            "drawdown_remaining_pct": round(max(0, dd_limit - max_drawdown_pct), 2),
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "avg_pnl": round(float(ts.avg_pnl or 0), 2),
            "best_trade": round(float(ts.best_trade or 0), 2),
            "worst_trade": round(float(ts.worst_trade or 0), 2),
            "last_checkpoint": {
                "type": last_checkpoint.checkpoint_type,
                "balance": float(last_checkpoint.balance),
                "equity": float(last_checkpoint.equity),
                "drawdown": float(last_checkpoint.drawdown_pct or 0),
                "created_at": last_checkpoint.created_at.isoformat()
                if last_checkpoint.created_at else None,
            } if last_checkpoint else None,
            "first_trade_date": ts.first_trade.isoformat() if ts.first_trade else None,
            "last_trade_date": ts.last_trade.isoformat() if ts.last_trade else None,
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
            "status": acc.status,
        })

    return {
        "active": True,
        "challenges": challenges,
        "count": len(challenges),
    }


# ───────────────────────────────────────────────────────────
# GET /challenge/checkpoints  — Jalons du challenge
# ───────────────────────────────────────────────────────────
@router.get("/checkpoints")
async def list_checkpoints(
    account_id: Optional[int] = None,
    checkpoint_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Retourne les checkpoints (jalons) des comptes challenge."""

    query = select(Checkpoint)
    if account_id:
        query = query.where(Checkpoint.account_id == account_id)
    if checkpoint_type:
        query = query.where(Checkpoint.checkpoint_type == checkpoint_type)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Checkpoint.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    checkpoints = result.scalars().all()

    return {
        "checkpoints": [
            {
                "id": cp.id,
                "account_id": cp.account_id,
                "checkpoint_type": cp.checkpoint_type,
                "balance": float(cp.balance),
                "equity": float(cp.equity),
                "drawdown": float(cp.drawdown_pct or 0),
                "notes": cp.notes,
                "created_at": cp.created_at.isoformat() if cp.created_at else None,
            }
            for cp in checkpoints
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


# ───────────────────────────────────────────────────────────
# POST /challenge/checkpoints  — Ajouter un jalon
# ───────────────────────────────────────────────────────────
@router.post("/checkpoints")
async def create_checkpoint(data: dict, db: AsyncSession = Depends(get_db)):
    """
    Ajoute un checkpoint (jalon) à un compte challenge.
    Champs attendus: account_id, checkpoint_type, balance, equity,
    optionnels: drawdown, notes.
    """

    required = {"account_id", "checkpoint_type", "balance", "equity"}
    missing = required - set(data.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required fields: {', '.join(missing)}",
        )

    # Vérifier que le compte existe
    acc_result = await db.execute(
        select(Account).where(Account.id == data["account_id"])
    )
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")

    checkpoint = Checkpoint(
        account_id=data["account_id"],
        checkpoint_type=data["checkpoint_type"],
        balance=data["balance"],
        equity=data["equity"],
        drawdown_pct=data.get("drawdown_pct", data.get("drawdown", 0)),
        notes=data.get("notes"),
    )
    db.add(checkpoint)
    await db.flush()
    await db.refresh(checkpoint)

    return {
        "id": checkpoint.id,
        "account_id": checkpoint.account_id,
        "checkpoint_type": checkpoint.checkpoint_type,
        "balance": float(checkpoint.balance),
        "equity": float(checkpoint.equity),
        "drawdown": float(checkpoint.drawdown_pct or 0),
        "notes": checkpoint.notes,
        "created_at": checkpoint.created_at.isoformat()
        if checkpoint.created_at else None,
    }


# ───────────────────────────────────────────────────────────
# DELETE /challenge/checkpoints/{id}  — Supprimer un jalon
# ───────────────────────────────────────────────────────────
@router.delete("/checkpoints/{checkpoint_id}")
async def delete_checkpoint(
    checkpoint_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Checkpoint).where(Checkpoint.id == checkpoint_id)
    )
    checkpoint = result.scalar_one_or_none()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    await db.delete(checkpoint)
    return {"message": "Checkpoint deleted", "id": checkpoint_id}


# ───────────────────────────────────────────────────────────
# GET /challenge/violations  — Violations de règles
# ───────────────────────────────────────────────────────────
@router.get("/violations")
async def get_violations(
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Vérifie si les comptes challenge ont violé leurs limites."""

    # Récupérer les comptes challenge
    acc_query = select(Account).where(Account.account_type == "challenge")
    if account_id:
        acc_query = acc_query.where(Account.id == account_id)
    acc_result = await db.execute(acc_query)
    accounts = acc_result.scalars().all()

    violations = []
    for acc in accounts:
        # Calculer le drawdown courant
        trades_query = (
            select(Trade.profit, Trade.open_time)
            .where(
                and_(
                    Trade.account_id == acc.id,
                    Trade.close_time.isnot(None),
                )
            )
            .order_by(Trade.open_time.asc())
        )
        trades_result = await db.execute(trades_query)
        trades = [(float(r[0]), r[1]) for r in trades_result.all()]

        starting = float(acc.starting_balance or 0)
        peak = starting
        running = starting
        max_dd_pct = 0
        dd_limit = float(acc.max_drawdown_pct or 7)
        daily_loss_limit = float(acc.daily_loss_pct or 5)

        # Calculer le drawdown max
        for profit, _ in trades:
            running += profit
            if running > peak:
                peak = running
            dd = (peak - running) / peak * 100 if peak > 0 else 0
            if dd > max_dd_pct:
                max_dd_pct = dd

        # PnL total
        net_pnl = sum(p for p, _ in trades)

        account_violations = []

        # Max drawdown violation
        if max_dd_pct > dd_limit:
            account_violations.append({
                "type": "max_drawdown_exceeded",
                "value": round(max_dd_pct, 2),
                "limit": dd_limit,
                "severity": "critical",
            })

        # Daily loss violation (par jour)
        daily_pnl = {}
        for profit, open_time in trades:
            day_key = open_time.strftime("%Y-%m-%d")
            daily_pnl[day_key] = daily_pnl.get(day_key, 0) + profit

        for day, day_pnl in daily_pnl.items():
            if day_pnl < 0:
                day_loss_pct = abs(day_pnl) / starting * 100 if starting > 0 else 0
                if day_loss_pct > daily_loss_limit:
                    account_violations.append({
                        "type": "daily_loss_exceeded",
                        "date": day,
                        "daily_pnl": round(day_pnl, 2),
                        "daily_loss_pct": round(day_loss_pct, 2),
                        "limit": daily_loss_limit,
                        "severity": "critical",
                    })

        violations.append({
            "account_id": acc.id,
            "account_name": acc.name,
            "phase": acc.phase,
            "max_drawdown_pct": round(max_dd_pct, 2),
            "daily_loss_limit": daily_loss_limit,
            "net_pnl": round(net_pnl, 2),
            "violation_count": len(account_violations),
            "violations": account_violations,
        })

    return {
        "violations": violations,
        "total_accounts_checked": len(accounts),
        "accounts_with_violations": sum(
            1 for v in violations if v["violation_count"] > 0
        ),
    }
