# app/api/v1/accounts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


from sqlalchemy import inspect as sa_inspect

def model_to_dict(obj):
    """Convert SQLAlchemy model to dict, safely handling all column types."""
    d = {}
    inspector = sa_inspect(obj.__class__)
    for col in obj.__table__.columns:
        col_name = col.name
        try:
            # Use getattr with a default to avoid lazy loading issues
            val = getattr(obj, col_name, None)
            if val is None:
                d[col_name] = None
            elif hasattr(val, "isoformat"):
                d[col_name] = val.isoformat()
            elif hasattr(val, "__float__"):
                d[col_name] = float(val)
            else:
                d[col_name] = val
        except Exception:
            # If we can't read the value (expired, etc), try the identity map
            try:
                state = sa_inspect(obj)
                if state.attrs[col_name].loaded_value is not None:
                    d[col_name] = state.attrs[col_name].loaded_value
                else:
                    d[col_name] = None
            except Exception:
                d[col_name] = None
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
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db)):
    account = Account(**data.model_dump())
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return model_to_dict(account)


@router.put("/{account_id}")
async def update_account(account_id: int, data: AccountUpdate, db: AsyncSession = Depends(get_db)):
    import logging, traceback
    logger = logging.getLogger(__name__)
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    logger.info(f"Updating account {account_id} with keys: {list(data.model_dump().keys())}")
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        if hasattr(account, key):
            try:
                setattr(account, key, value)
            except Exception as e:
                logger.error(f"Cannot set {key}={value!r}: {e}")
                logger.error(traceback.format_exc())
                continue
        else:
            logger.warning(f"Unknown field: {key}")
    try:
        await db.flush()
    except Exception as e:
        logger.error(f"DB flush error: {e}")
        logger.error(traceback.format_exc())
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return model_to_dict(account)


@router.put("/{account_id}/sessions")
async def update_session_config(account_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """Update session hours configuration for an account.

    Expected payload:
    {
        "Asia": {"start": 0, "end": 8},
        "London": {"start": 8, "end": 12},
        "New York": {"start": 13, "end": 21},
        "Late NY": {"start": 22, "end": 23}
    }
    Hours are in the user's local timezone.
    """
    from app.services.session_config import validate_session_config

    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    validated = validate_session_config(data)
    account.session_hours = validated
    await db.flush()
    return {"message": "Session config updated", "session_hours": validated}
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    return {"message": "Account deleted", "id": account_id}
