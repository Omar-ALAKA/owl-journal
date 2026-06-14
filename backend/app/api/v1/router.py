# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import trades, accounts, strategies, journal, history, challenge
from app.api.v1 import import_routes, analytics, calendar, equity

api_router = APIRouter()
api_router.include_router(trades.router)
api_router.include_router(accounts.router)
api_router.include_router(strategies.router)
api_router.include_router(journal.router)
api_router.include_router(history.router)
api_router.include_router(challenge.router)
api_router.include_router(import_routes.router)
api_router.include_router(analytics.router)
api_router.include_router(calendar.router)
api_router.include_router(equity.router)
