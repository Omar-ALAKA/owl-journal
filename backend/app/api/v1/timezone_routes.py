# app/api/v1/timezone_routes.py
"""Timezone API endpoints."""

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta
from app.services.timezone import (
    get_offset,
    get_tz_name,
    get_session_for_time,
    format_offset,
    TZ_OFFSETS,
    TZ_AUTO_DST,
)
from app.deps import get_timezone

router = APIRouter(prefix="/timezone", tags=["timezone"])


@router.get("/")
async def get_timezone_info(
    tz: str = Query(None, description="Timezone code. Uses X-Timezone header if not provided."),
    header_tz: str = Depends(get_timezone),
):
    """Return current timezone info with auto-DST detection."""
    now_utc = datetime.utcnow()
    effective_tz = (tz or header_tz).upper()

    if effective_tz in TZ_OFFSETS:
        offset = get_offset(effective_tz, now_utc)
        tz_name = get_tz_name(effective_tz, now_utc)
        is_dst = None if effective_tz not in TZ_AUTO_DST else (offset != TZ_AUTO_DST[effective_tz]["std"])
    else:
        # Fallback to NY auto-detect
        effective_tz = "EST"
        offset = get_offset("EST", now_utc)
        tz_name = get_tz_name("EST", now_utc)
        is_dst = offset != -5

    local_time = now_utc + timedelta(hours=offset)
    current_session = get_session_for_time(now_utc, offset)

    return {
        "tz_code": tz_name,
        "tz_name": effective_tz,
        "offset_hours": offset,
        "offset_formatted": format_offset(offset),
        "is_dst": is_dst,
        "utc_now": now_utc.isoformat(),
        "local_now": local_time.isoformat(),
        "current_session": current_session,
        "available_timezones": list(TZ_OFFSETS.keys()),
    }


@router.get("/sessions")
async def get_sessions(
    tz: str = Query(None, description="Timezone code. Uses X-Timezone header if not provided."),
    header_tz: str = Depends(get_timezone),
):
    """Return session times in the specified timezone."""
    now_utc = datetime.utcnow()
    effective_tz = (tz or header_tz).upper()

    if effective_tz in TZ_OFFSETS:
        offset = get_offset(effective_tz, now_utc)
        tz_code = get_tz_name(effective_tz, now_utc)
    else:
        effective_tz = "EST"
        offset = get_offset("EST", now_utc)
        tz_code = get_tz_name("EST", now_utc)

    sessions = {
        "Asia": {"start": 0, "end": 9, "description": "Asian session"},
        "London": {"start": 9, "end": 12, "description": "London session"},
        "New York": {"start": 12, "end": 17, "description": "New York session"},
        "Late NY": {"start": 17, "end": 21, "description": "Late New York"},
    }

    result = {}
    for name, info in sessions.items():
        start_utc = (info["start"] - offset) % 24
        end_utc = (info["end"] - offset) % 24
        result[name] = {
            "local_start": info["start"],
            "local_end": info["end"],
            "utc_start": start_utc,
            "utc_end": end_utc,
            "description": info["description"],
        }

    return {
        "tz_code": tz_code,
        "offset_hours": offset,
        "sessions": result,
        "current_session": get_session_for_time(now_utc, offset),
    }


@router.get("/detect")
async def detect_timezone():
    """Auto-detect timezone info for New York with DST awareness."""
    now_utc = datetime.utcnow()
    tz_code = get_tz_name("EST", now_utc)
    offset = get_offset("EST", now_utc)
    is_dst = offset != -5

    return {
        "detected_tz": tz_code,
        "iana_name": "America/New_York",
        "offset_hours": offset,
        "offset_formatted": format_offset(offset),
        "is_dst": is_dst,
        "dst_active": is_dst,
        "dst_label": "Eastern Daylight Time" if is_dst else "Eastern Standard Time",
        "note": "Auto-detected based on US DST rules (2nd Sun Mar - 1st Sun Nov)",
    }
