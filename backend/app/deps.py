# app/deps.py
"""Shared FastAPI dependencies."""

from fastapi import Header, Query
from typing import Optional


async def get_timezone(
    x_timezone: Optional[str] = Header(None, alias="X-Timezone"),
) -> str:
    """Extract timezone from X-Timezone header. Defaults to EST (New York)."""
    return (x_timezone or "EST").upper()
