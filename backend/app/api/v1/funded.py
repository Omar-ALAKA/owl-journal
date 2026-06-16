# app/api/v1/funded.py
"""Funded account endpoints — personal goals, payouts, prop firm rules."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import date
from app.database import get_db
from app.models.account import Account, Payout
from app.schemas.payout import PayoutCreate, PayoutUpdate, PayoutResponse

router = APIRouter(prefix="/funded", tags=["funded"])


# ───────────────────────────────────────────────────────────
# GET /funded/accounts — All funded accounts with live stats
# ───────────────────────────────────────────────────────────
@router.get("/accounts")
async def list_funded_accounts(db: AsyncSession = Depends(get_db)):
    """Return all funded-type accounts with computed stats."""
    from app.models.trade import Trade

    acc_query = select(Account).where(Account.account_type == "funded").order_by(Account.created_at.asc())
    acc_result = await db.execute(acc_query)
    accounts = acc_result.scalars().all()

    results = []
    for acc in accounts:
        # All closed trades
        trade_query = (
            select(Trade.profit, Trade.open_time, Trade.close_time)
            .where(and_(Trade.account_id == acc.id, Trade.close_time.isnot(None)))
            .order_by(Trade.open_time.asc())
        )
        trade_result = await db.execute(trade_query)
        trade_rows = trade_result.all()

        total_trades = len(trade_rows)
        wins = sum(1 for r in trade_rows if float(r[0] or 0) > 0)
        losses = sum(1 for r in trade_rows if float(r[0] or 0) < 0)
        net_pnl = sum(float(r[0] or 0) for r in trade_rows)
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0

        starting = float(acc.starting_balance or 0)
        current_equity = starting + net_pnl

        # Personal target progress (default 5%)
        personal_target_pct = float(acc.personal_target_pct or 5)
        target_amount = starting * personal_target_pct / 100
        personal_progress = (net_pnl / target_amount * 100) if target_amount > 0 else 0
        target_reached = net_pnl >= target_amount

        # Max drawdown
        peak = starting
        running = starting
        max_dd = 0
        for r in trade_rows:
            running += float(r[0] or 0)
            if running > peak:
                peak = running
            dd = peak - running
            if dd > max_dd:
                max_dd = dd
        max_dd_pct = (max_dd / starting * 100) if starting > 0 else 0

        # Total payouts
        payout_query = select(func.sum(Payout.amount)).where(
            and_(Payout.account_id == acc.id, Payout.status.in_(["approved", "paid"]))
        )
        payout_result = await db.execute(payout_query)
        total_payouts = float(payout_result.scalar() or 0)

        results.append({
            "id": acc.id,
            "name": acc.name,
            "broker": acc.broker,
            "status": acc.status,
            "starting_balance": starting,
            "current_equity": round(current_equity, 2),
            "net_pnl": round(net_pnl, 2),
            "net_pnl_pct": round(net_pnl / starting * 100, 2) if starting else 0,
            "personal_target_pct": personal_target_pct,
            "personal_target_amount": round(target_amount, 2),
            "personal_progress_pct": round(personal_progress, 2),
            "personal_target_reached": target_reached,
            "max_drawdown": round(max_dd, 2),
            "max_drawdown_pct": round(max_dd_pct, 2),
            "drawdown_limit_pct": float(acc.max_drawdown_pct or 7),
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "total_payouts": round(total_payouts, 2),
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
        })

    return {"accounts": results, "count": len(results)}


# ───────────────────────────────────────────────────────────
# GET /funded/{account_id}/summary — Single funded account
# ───────────────────────────────────────────────────────────
@router.get("/{account_id}/summary")
async def get_funded_summary(account_id: int, db: AsyncSession = Depends(get_db)):
    """Full summary for one funded account."""
    from app.models.trade import Trade

    acc_result = await db.execute(select(Account).where(Account.id == account_id))
    acc = acc_result.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    starting = float(acc.starting_balance or 0)

    trade_query = (
        select(Trade.profit, Trade.open_time, Trade.close_time)
        .where(and_(Trade.account_id == account_id, Trade.close_time.isnot(None)))
        .order_by(Trade.open_time.asc())
    )
    trade_result = await db.execute(trade_query)
    trade_rows = trade_result.all()

    total_trades = len(trade_rows)
    wins = sum(1 for r in trade_rows if float(r[0] or 0) > 0)
    losses = sum(1 for r in trade_rows if float(r[0] or 0) < 0)
    net_pnl = sum(float(r[0] or 0) for r in trade_rows)
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
    current_equity = starting + net_pnl

    # Personal target
    personal_target_pct = float(acc.personal_target_pct or 5)
    target_amount = starting * personal_target_pct / 100
    personal_progress = (net_pnl / target_amount * 100) if target_amount > 0 else 0

    # Max drawdown
    peak = starting
    running = starting
    max_dd = 0
    for r in trade_rows:
        running += float(r[0] or 0)
        if running > peak:
            peak = running
        dd = peak - running
        if dd > max_dd:
            max_dd = dd
    max_dd_pct = (max_dd / starting * 100) if starting > 0 else 0

    # Payouts
    payout_query = select(Payout).where(Payout.account_id == account_id).order_by(Payout.payout_date.desc())
    payout_result = await db.execute(payout_query)
    payouts = payout_result.scalars().all()
    total_payouts = sum(float(p.amount) for p in payouts if p.status in ("approved", "paid"))

    return {
        "account_id": acc.id,
        "name": acc.name,
        "broker": acc.broker,
        "status": acc.status,
        "starting_balance": starting,
        "current_equity": round(current_equity, 2),
        "net_pnl": round(net_pnl, 2),
        "net_pnl_pct": round(net_pnl / starting * 100, 2) if starting else 0,
        "personal_target_pct": personal_target_pct,
        "personal_target_amount": round(target_amount, 2),
        "personal_progress_pct": round(personal_progress, 2),
        "personal_target_reached": net_pnl >= target_amount,
        "max_drawdown_pct": round(max_dd_pct, 2),
        "drawdown_limit_pct": float(acc.max_drawdown_pct or 7),
        "drawdown_remaining_pct": round(max(0, float(acc.max_drawdown_pct or 7) - max_dd_pct), 2),
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 2),
        "total_payouts": round(total_payouts, 2),
        "payouts": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "payout_date": p.payout_date.isoformat() if p.payout_date else None,
                "status": p.status,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payouts
        ],
    }


# ───────────────────────────────────────────────────────────
# PAYOUTS CRUD
# ───────────────────────────────────────────────────────────
@router.get("/{account_id}/payouts")
async def list_payouts(account_id: int, db: AsyncSession = Depends(get_db)):
    """List all payouts for a funded account."""
    acc_result = await db.execute(select(Account).where(Account.id == account_id))
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")

    query = select(Payout).where(Payout.account_id == account_id).order_by(Payout.payout_date.desc())
    result = await db.execute(query)
    payouts = result.scalars().all()
    return {
        "payouts": [
            {
                "id": p.id,
                "account_id": p.account_id,
                "amount": float(p.amount),
                "payout_date": p.payout_date.isoformat() if p.payout_date else None,
                "status": p.status,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payouts
        ],
        "total": len(payouts),
    }


@router.post("/{account_id}/payouts")
async def create_payout(account_id: int, data: PayoutCreate, db: AsyncSession = Depends(get_db)):
    """Add a payout record to a funded account."""
    acc_result = await db.execute(select(Account).where(Account.id == account_id))
    if not acc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Account not found")

    payout = Payout(
        account_id=account_id,
        amount=data.amount,
        payout_date=data.payout_date,
        status=data.status or "pending",
        notes=data.notes,
    )
    db.add(payout)
    await db.flush()
    await db.refresh(payout)

    return {
        "id": payout.id,
        "account_id": payout.account_id,
        "amount": float(payout.amount),
        "payout_date": payout.payout_date.isoformat() if payout.payout_date else None,
        "status": payout.status,
        "notes": payout.notes,
        "created_at": payout.created_at.isoformat() if payout.created_at else None,
    }


@router.put("/{account_id}/payouts/{payout_id}")
async def update_payout(account_id: int, payout_id: int, data: PayoutUpdate, db: AsyncSession = Depends(get_db)):
    """Update a payout record."""
    result = await db.execute(select(Payout).where(and_(Payout.id == payout_id, Payout.account_id == account_id)))
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    if data.amount is not None:
        payout.amount = data.amount
    if data.payout_date is not None:
        payout.payout_date = data.payout_date
    if data.status is not None:
        payout.status = data.status
    if data.notes is not None:
        payout.notes = data.notes

    await db.flush()
    await db.refresh(payout)

    return {
        "id": payout.id,
        "account_id": payout.account_id,
        "amount": float(payout.amount),
        "payout_date": payout.payout_date.isoformat() if payout.payout_date else None,
        "status": payout.status,
        "notes": payout.notes,
    }


@router.delete("/{account_id}/payouts/{payout_id}")
async def delete_payout(account_id: int, payout_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a payout record."""
    result = await db.execute(select(Payout).where(and_(Payout.id == payout_id, Payout.account_id == account_id)))
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    await db.delete(payout)
    return {"message": "Payout deleted", "id": payout_id}
