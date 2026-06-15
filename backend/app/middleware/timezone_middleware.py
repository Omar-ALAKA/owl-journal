# app/middleware/timezone_middleware.py
"""Timezone utilities for request context."""

from fastapi import Request


async def get_timezone_from_request(request: Request) -> str:
    """Extract timezone code from X-Timezone header."""
    return request.headers.get("X-Timezone", "EST")


def get_request_offset(tz_code: str = None, dt=None) -> float:
    """Get UTC offset for a timezone code."""
    from app.services.timezone import get_offset
    if tz_code is None:
        tz_code = "EST"
    return get_offset(tz_code, dt)
