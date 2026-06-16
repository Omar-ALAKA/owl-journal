# app/services/timezone.py
"""Timezone utilities with DST auto-detection for all major trading timezones."""

from datetime import datetime, timedelta
from typing import Optional


# ── Static offsets (standard time) ──────────────────────────

TZ_OFFSETS = {
    "UTC": 0,
    "EST": -5,   # Eastern Standard Time (US)
    "EDT": -4,   # Eastern Daylight Time (US) - fixed offset, no DST calc
    "CST": -6,   # Central Standard Time (US)
    "CDT": -5,   # Central Daylight Time (US) - fixed offset
    "MST": -7,   # Mountain Standard Time (US)
    "MDT": -6,   # Mountain Daylight Time (US) - fixed offset
    "PST": -8,   # Pacific Standard Time (US)
    "PDT": -7,   # Pacific Daylight Time (US) - fixed offset
    "GMT": 0,    # Greenwich Mean Time
    "BST": 1,    # British Summer Time - fixed offset
    "CET": 1,    # Central European Time
    "CEST": 2,   # Central European Summer Time - fixed offset
    "EET": 2,    # Eastern European Time
    "EEST": 3,   # Eastern European Summer Time - fixed offset
    "WAT": 1,    # West Africa Time (Lomé, Togo) - no DST
    "CAT": 2,    # Central Africa Time
    "JST": 9,    # Japan Standard Time - no DST
    "KST": 9,    # Korea Standard Time - no DST
    "IST": 5.5,  # India Standard Time - no DST
    "HKT": 8,    # Hong Kong Time - no DST
    "SGT": 8,    # Singapore Time - no DST
    "AEST": 10,  # Australian Eastern Standard Time
    "AEDT": 11,  # Australian Eastern Daylight Time - fixed offset
    "NZST": 12,  # New Zealand Standard Time
    "NZDT": 13,  # New Zealand Daylight Time - fixed offset
}

# Timezones that support auto-DST (the code calculates it dynamically)
# For these, we use the STANDARD time offset and let DST calc adjust
TZ_AUTO_DST = {
    "EST": {"std": -5, "dst": -4, "hemisphere": "north"},
    "CST": {"std": -6, "dst": -5, "hemisphere": "north"},
    "MST": {"std": -7, "dst": -6, "hemisphere": "north"},
    "PST": {"std": -8, "dst": -7, "hemisphere": "north"},
    "GMT": {"std": 0, "dst": 1, "hemisphere": "north"},   # BST
    "CET": {"std": 1, "dst": 2, "hemisphere": "north"},   # CEST
    "EET": {"std": 2, "dst": 3, "hemisphere": "north"},   # EEST
    "AEST": {"std": 10, "dst": 11, "hemisphere": "south"}, # AEDT
    "NZST": {"std": 12, "dst": 13, "hemisphere": "south"}, # NZDT
}

# Timezones with no DST
TZ_NO_DST = {"UTC", "EDT", "CDT", "MDT", "PDT", "BST", "CEST", "EEST", "AEDT", "NZDT",
             "WAT", "CAT", "JST", "KST", "IST", "HKT", "SGT"}


def _is_dst_us(dt: datetime, year: int) -> bool:
    """US DST: 2nd Sunday March 2AM -> 1st Sunday November 2AM."""
    mar_1 = datetime(year, 3, 1)
    days_to_sun = (6 - mar_1.weekday()) % 7
    dst_start = datetime(year, 3, 1 + days_to_sun + 7, 2, 0, 0)
    nov_1 = datetime(year, 11, 1)
    days_to_sun = (6 - nov_1.weekday()) % 7
    dst_end = datetime(year, 11, 1 + days_to_sun, 2, 0, 0)
    return dst_start <= dt < dst_end


def _is_dst_eu(dt: datetime, year: int) -> bool:
    """EU DST: last Sunday March 1AM UTC -> last Sunday October 1AM UTC."""
    mar_31 = datetime(year, 3, 31)
    days_back = (mar_31.weekday() + 1) % 7
    dst_start = datetime(year, 3, 31 - days_back, 1, 0, 0)
    oct_31 = datetime(year, 10, 31)
    days_back = (oct_31.weekday() + 1) % 7
    dst_end = datetime(year, 10, 31 - days_back, 1, 0, 0)
    return dst_start <= dt < dst_end


def _is_dst_aus(dt: datetime, year: int) -> bool:
    """Australia DST: 1st Sunday October 2AM -> 1st Sunday April 3AM."""
    oct_1 = datetime(year, 10, 1)
    days_to_sun = (6 - oct_1.weekday()) % 7
    dst_start = datetime(year, 10, 1 + days_to_sun, 2, 0, 0)
    apr_1 = datetime(year + 1, 4, 1)
    days_to_sun = (6 - apr_1.weekday()) % 7
    dst_end = datetime(year + 1, 4, 1 + days_to_sun, 3, 0, 0)
    return dt >= dst_start or dt < dst_end


def _is_dst_nz(dt: datetime, year: int) -> bool:
    """New Zealand DST: last Sunday September 2AM -> 1st Sunday April 3AM."""
    sep_30 = datetime(year, 9, 30)
    days_back = (sep_30.weekday() + 1) % 7
    dst_start = datetime(year, 9, 30 - days_back, 2, 0, 0)
    apr_1 = datetime(year + 1, 4, 1)
    days_to_sun = (6 - apr_1.weekday()) % 7
    dst_end = datetime(year + 1, 4, 1 + days_to_sun, 3, 0, 0)
    return dt >= dst_start or dt < dst_end


_DST_FUNCS = {
    "EST": _is_dst_us, "CST": _is_dst_us, "MST": _is_dst_us, "PST": _is_dst_us,
    "GMT": _is_dst_eu, "CET": _is_dst_eu, "EET": _is_dst_eu,
    "AEST": _is_dst_aus,
    "NZST": _is_dst_nz,
}


def get_offset(tz_code: str, dt: Optional[datetime] = None) -> float:
    """Get UTC offset in hours for a timezone code, with DST auto-detection.

    For timezone codes like EST, CET, etc., DST is calculated automatically.
    For fixed codes like EDT, CEST, the static offset is returned.
    """
    if dt is None:
        dt = datetime.utcnow()

    code = tz_code.upper()

    # Fixed-offset timezones (no DST calc needed)
    if code in TZ_NO_DST:
        return TZ_OFFSETS.get(code, 0)

    # Auto-DST timezones
    if code in TZ_AUTO_DST:
        info = TZ_AUTO_DST[code]
        dst_func = _DST_FUNCS.get(code)
        if dst_func and dst_func(dt, dt.year):
            return info["dst"]
        return info["std"]

    # Fallback: static offset
    return TZ_OFFSETS.get(code, 0)


def get_tz_name(tz_code: str, dt: Optional[datetime] = None) -> str:
    """Return the effective timezone name (e.g. 'EST' or 'EDT') based on DST."""
    code = tz_code.upper()
    if code in TZ_AUTO_DST:
        info = TZ_AUTO_DST[code]
        dst_func = _DST_FUNCS.get(code)
        if dst_func and dst_func(dt or datetime.utcnow(), (dt or datetime.utcnow()).year):
            # Return the DST name
            dst_names = {
                "EST": "EDT", "CST": "CDT", "MST": "MDT", "PST": "PDT",
                "GMT": "BST", "CET": "CEST", "EET": "EEST",
                "AEST": "AEDT", "NZST": "NZDT",
            }
            return dst_names.get(code, code)
        return code
    return code


def utc_to_local(utc_dt: datetime, offset_hours: float) -> datetime:
    """Convert UTC datetime to local time."""
    return utc_dt + timedelta(hours=offset_hours)


def local_to_utc(local_dt: datetime, offset_hours: float) -> datetime:
    """Convert local datetime to UTC."""
    return local_dt - timedelta(hours=offset_hours)


def get_session_for_time(utc_dt: datetime, offset_hours: float = 0) -> str:
    """Determine trading session based on UTC time.

    Sessions are defined in FIXED UTC hours (market hours don't change with DST):
    - Asia:     00:00 - 07:59 UTC (Tokyo/Sydney)
    - London:   08:00 - 12:59 UTC
    - New York: 13:00 - 21:59 UTC
    - Off-hours: 22:00 - 23:59 UTC

    The offset_hours parameter is kept for backward compatibility but
    session boundaries are always in UTC.
    """
    hour = utc_dt.hour
    if 0 <= hour < 8:
        return "Asia"
    elif 8 <= hour < 13:
        return "London"
    elif 13 <= hour < 22:
        return "New York"
    else:
        return "Off-hours"


def format_offset(offset_hours: float) -> str:
    """Format offset as 'UTC-5', 'UTC+1', 'UTC+5:30', etc."""
    if offset_hours == 0:
        return "UTC"
    sign = "+" if offset_hours > 0 else "-"
    abs_offset = abs(offset_hours)
    hours = int(abs_offset)
    minutes = int((abs_offset - hours) * 60)
    if minutes:
        return f"UTC{sign}{hours}:{minutes:02d}"
    return f"UTC{sign}{hours}"


def format_local_time(utc_dt: datetime, offset_hours: float, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format a UTC datetime as local time string."""
    local = utc_to_local(utc_dt, offset_hours)
    return local.strftime(fmt)
