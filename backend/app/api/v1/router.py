# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import trades, accounts

api_router = APIRouter()
api_router.include_router(trades.router)
api_router.include_router(accounts.router)
