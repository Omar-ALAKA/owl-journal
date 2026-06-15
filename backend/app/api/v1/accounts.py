# app/api/v1/accounts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.account import Account

router = APIRouter(prefix="/accounts", tags=["accounts"])


def model_to_dict(obj):
    """Convert SQLAlchemy model to dict, filtering internal attrs and serializing dates."""
    d = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
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
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).order_by(Account.created_at.desc()))
    accounts = result.scalars().all()
    return {"accounts": [model_to_dict(a) for a in accounts]}


@router.get("/{account_id}")
async def get_account(account_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return model_to_dict(account)


@router.post("/")
async def create_account(data: dict, db: AsyncSession = Depends(get_db)):
    account = Account(**data)
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return model_to_dict(account)


@router.put("/{account_id}")
async def update_account(account_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for key, value in data.items():
        setattr(account, key, value)
    await db.flush()
    return model_to_dict(account)


@router.delete("/{account_id}")
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    return {"message": "Account deleted", "id": account_id}
