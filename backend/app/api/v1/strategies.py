# app/api/v1/strategies.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.database import get_db
from app.models.strategy import Strategy, Tag, TradeTag
from app.models.trade import Trade

router = APIRouter(prefix="/strategies/custom", tags=["strategies"])


# ──────────────────────────────────────────────
# GET /strategies/custom  — Liste des stratégies
# ──────────────────────────────────────────────
@router.get("/")
async def list_strategies(
    search: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Strategy)
    if search:
        query = query.where(
            Strategy.name.ilike(f"%{search}%")
            | Strategy.description.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Strategy.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    strategies = result.scalars().all()

    return {
        "strategies": [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "rules": s.rules,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in strategies
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


# ──────────────────────────────────────────────
# GET /strategies/custom/{id}  — Détail stratégie
# ──────────────────────────────────────────────
@router.get("/{strategy_id}")
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {
        "id": strategy.id,
        "name": strategy.name,
        "description": strategy.description,
        "rules": strategy.rules,
        "created_at": strategy.created_at.isoformat() if strategy.created_at else None,
        "updated_at": strategy.updated_at.isoformat() if strategy.updated_at else None,
    }


# ──────────────────────────────────────────────
# POST /strategies/custom  — Créer une stratégie
# ──────────────────────────────────────────────
@router.post("/")
async def create_strategy(data: dict, db: AsyncSession = Depends(get_db)):
    # Vérifier l'unicité du nom
    existing = await db.execute(
        select(Strategy).where(Strategy.name == data.get("name", ""))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Strategy name already exists")

    strategy = Strategy(
        name=data["name"],
        description=data.get("description"),
        rules=data.get("rules", {}),
    )
    db.add(strategy)
    await db.flush()
    await db.refresh(strategy)
    return {
        "id": strategy.id,
        "name": strategy.name,
        "description": strategy.description,
        "rules": strategy.rules,
        "created_at": strategy.created_at.isoformat() if strategy.created_at else None,
    }


# ──────────────────────────────────────────────
# PUT /strategies/custom/{id}  — Modifier
# ──────────────────────────────────────────────
@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: int, data: dict, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # Vérifier unicité du nom si modifié
    if "name" in data and data["name"] != strategy.name:
        dup = await db.execute(
            select(Strategy).where(Strategy.name == data["name"])
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Strategy name already exists")

    allowed_fields = {"name", "description", "rules"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(strategy, key, value)

    await db.flush()
    await db.refresh(strategy)
    return {
        "id": strategy.id,
        "name": strategy.name,
        "description": strategy.description,
        "rules": strategy.rules,
        "updated_at": strategy.updated_at.isoformat() if strategy.updated_at else None,
    }


# ──────────────────────────────────────────────
# DELETE /strategies/custom/{id}  — Supprimer
# ──────────────────────────────────────────────
@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    await db.delete(strategy)
    return {"message": "Strategy deleted", "id": strategy_id}


# ──────────────────────────────────────────────
# Tags (sous-ressource rapide)
# ──────────────────────────────────────────────
@router.get("/tags")
async def list_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).order_by(Tag.name))
    tags = result.scalars().all()
    return {
        "tags": [
            {"id": t.id, "name": t.name, "color": t.color}
            for t in tags
        ]
    }


@router.post("/tags")
async def create_tag(data: dict, db: AsyncSession = Depends(get_db)):
    tag = Tag(
        name=data["name"],
        color=data.get("color", "#E8A838"),
    )
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color}
