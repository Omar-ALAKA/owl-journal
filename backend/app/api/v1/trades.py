from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.database import get_db
from app.models.trade import Trade
from app.schemas.trade import TradeCreate, TradeUpdate

router = APIRouter(prefix="/trades", tags=["trades"])


def trade_to_dict(t: Trade) -> dict:
    """Convert Trade SQLAlchemy model to dict, handling datetime and Decimal serialization."""
    d = {}
    for col in t.__table__.columns:
        val = getattr(t, col.name)
        if val is None:
            d[col.name] = None
        elif hasattr(val, "isoformat"):
            d[col.name] = val.isoformat()
        elif hasattr(val, "__float__"):
            d[col.name] = float(val)
        else:
            d[col.name] = val
    return d


@router.get("/")
async def list_trades(
    account_id: Optional[int] = None,
    session: Optional[str] = None,
    setup: Optional[str] = None,
    direction: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Trade)
    if account_id:
        query = query.where(Trade.account_id == account_id)
    if session:
        query = query.where(Trade.session == session)
    if setup:
        query = query.where(Trade.setup == setup)
    if direction:
        query = query.where(Trade.direction == direction)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Trade.open_time.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    trades = result.scalars().all()

    return {
        "trades": [trade_to_dict(t) for t in trades],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/{trade_id}")
async def get_trade(trade_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade_to_dict(trade)


@router.post("/")
async def create_trade(data: TradeCreate, db: AsyncSession = Depends(get_db)):
    trade = Trade(**data.model_dump())
    db.add(trade)
    await db.flush()
    await db.refresh(trade)
    return trade_to_dict(trade)


@router.put("/{trade_id}")
async def update_trade(trade_id: int, data: TradeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trade, key, value)
    await db.flush()
    await db.refresh(trade)
    return trade_to_dict(trade)


@router.delete("/{trade_id}")
async def delete_trade(trade_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    await db.delete(trade)
    return {"message": "Trade deleted", "id": trade_id}
