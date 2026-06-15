# app/main.py
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("owl_journal")

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.v1 import api_router
from app.database import init_db, close_pool, get_db
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("OWL Journal V4 starting up")
    yield
    await close_pool()


app = FastAPI(
    title="OWL Journal V4",
    version="4.0.0",
    lifespan=lifespan,
    redirect_slashes=True,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes with /api prefix
app.include_router(api_router, prefix="/api")


@app.get("/api/health")
async def health():
    logger.info("Health check requested")
    return {"status": "healthy", "version": "4.0.0"}


# Global exception handler for 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")


# SPA fallback
@app.exception_handler(StarletteHTTPException)
async def spa_fallback(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404 and not request.url.path.startswith("/api/"):
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


# ── Aliases for frontend convenience ────────────────────────
@app.get("/api/stats")
async def stats_alias(account_id: int = None, db=Depends(get_db)):
    """Alias for /api/analytics/stats for frontend compatibility."""
    logger.info(f"Stats requested: account_id={account_id}")
    from app.api.v1.analytics import get_stats
    return await get_stats(account_id=account_id, db=db)


@app.post("/api/rebuild-equity/{account_id}")
async def rebuild_equity(account_id: int, db=Depends(get_db)):
    """Rebuild equity curve and daily stats for an account."""
    logger.info(f"Rebuild equity requested: account_id={account_id}")
    from app.services.rebuild import rebuild_equity_curve, rebuild_daily_stats
    curve_result = await rebuild_equity_curve(account_id, db)
    daily_result = await rebuild_daily_stats(account_id, db)
    await db.commit()
    logger.info(f"Rebuild equity done: account_id={account_id}")
    return {"equity": curve_result, "daily": daily_result}


# ── Strategy aliases ────────────────────────────────────────
@app.get("/api/strategies")
async def strategies_alias(search: str = None, limit: int = 100, offset: int = 0, db=Depends(get_db)):
    """Alias for /api/strategies/custom for frontend compatibility."""
    logger.info(f"Strategies requested: search={search}, limit={limit}, offset={offset}")
    from app.api.v1.strategies import list_strategies
    return await list_strategies(search=search, limit=limit, offset=offset, db=db)

@app.post("/api/strategies")
async def strategies_create(data: dict, db=Depends(get_db)):
    """Alias for POST /api/strategies/custom for frontend compatibility."""
    from app.api.v1.strategies import create_strategy
    return await create_strategy(data=data, db=db)

@app.put("/api/strategies/{strategy_id}")
async def strategies_update(strategy_id: int, data: dict, db=Depends(get_db)):
    """Alias for PUT /api/strategies/custom/{id} for frontend compatibility."""
    from app.api.v1.strategies import update_strategy
    return await update_strategy(strategy_id=strategy_id, data=data, db=db)

@app.delete("/api/strategies/{strategy_id}")
async def strategies_delete(strategy_id: int, db=Depends(get_db)):
    """Alias for DELETE /api/strategies/custom/{id} for frontend compatibility."""
    from app.api.v1.strategies import delete_strategy
    return await delete_strategy(strategy_id=strategy_id, db=db)
