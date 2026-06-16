# app/services/session_config.py
"""Configurable trading sessions — user defines session hours in their timezone."""

from datetime import datetime


# Default session definitions (hours in the user's local timezone)
DEFAULT_SESSIONS = {
    "Asia": {"start": 0, "end": 8},
    "London": {"start": 8, "end": 12},
    "New York": {"start": 13, "end": 21},
    "Late NY": {"start": 22, "end": 23},
}


def get_session_for_time(utc_dt: datetime, offset_hours: float, session_config: dict | None = None) -> str:
    """Determine trading session based on UTC time, timezone offset, and user-defined session hours.

    Args:
        utc_dt: The UTC datetime of the trade
        offset_hours: User's timezone offset (e.g. -5 for EST, 0 for UTC, 1 for WAT)
        session_config: User's session definitions, e.g.:
            {"Asia": {"start": 0, "end": 8}, "London": {"start": 8, "end": 12}, ...}
            Hours are in the USER's local timezone.

    Returns:
        Session name string
    """
    sessions = session_config or DEFAULT_SESSIONS

    # Convert UTC to user's local time
    local_hour = (utc_dt.hour + offset_hours) % 24
    if local_hour < 0:
        local_hour += 24

    # Check each session in order (most specific first)
    for name in ["Late NY", "New York", "London", "Asia"]:
        if name in sessions:
            cfg = sessions[name]
            start = cfg["start"]
            end = cfg["end"]
            if start <= local_hour < end:
                return name

    return "Off-hours"


def validate_session_config(config: dict) -> dict:
    """Validate and normalize session configuration."""
    validated = {}
    for name, cfg in config.items():
        if not isinstance(cfg, dict) or "start" not in cfg or "end" not in cfg:
            continue
        start = max(0, min(23, int(cfg["start"])))
        end = max(0, min(23, int(cfg["end"])))
        if start != end:
            validated[name] = {"start": start, "end": end}
    return validated if validated else DEFAULT_SESSIONS
