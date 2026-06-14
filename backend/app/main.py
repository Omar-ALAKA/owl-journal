# app/main.py
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.v1 import api_router
from app.database import init_db, close_pool
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_pool()


app = FastAPI(
    title="OWL Journal V4",
    version="4.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
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
    return {"status": "healthy", "version": "4.0.0"}


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
    from app.api.v1.analytics import get_stats
    return await get_stats(account_id=account_id, db=db)


@app.post("/api/rebuild-equity/{account_id}")
async def rebuild_equity(account_id: int, db=Depends(get_db)):
    """Rebuild equity curve and daily stats for an account."""
    from app.services.rebuild import rebuild_equity_curve, rebuild_daily_stats
    curve_result = await rebuild_equity_curve(account_id, db)
    daily_result = await rebuild_daily_stats(account_id, db)
    await db.commit()
    return {"equity": curve_result, "daily": daily_result}
