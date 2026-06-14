# app/services/import_parser.py
"""Trade import parser for multiple broker formats.

Supported formats: FTMO, MyFundedFX, Equity Edge, generic CSV.
"""

import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any


# ── Column mapping definitions per format ──────────────────────────────────

FTMO_MAP = {
    "date": ["date", "time", "datetime", "close time", "open time"],
    "symbol": ["symbol", "instrument", "pair", "ticker"],
    "direction": ["direction", "type", "side", "action", "trade type"],
    "volume": ["volume", "size", "lots", "qty", "quantity"],
    "open_price": ["open price", "entry price", "open", "entry", "price open"],
    "close_price": ["close price", "exit price", "close", "exit", "price close"],
    "profit": ["profit", "pnl", "net pnl", "gain", "p/l", "pl"],
    "commission": ["commission", "comm", "fees"],
    "swap": ["swap", "swap charge", "overnight"],
    "sl": ["sl", "stop loss", "sl price", "stop"],
    "tp": ["tp", "take profit", "tp price", "target"],
}

MYFUNDEDFX_MAP = {
    "date": ["date/time", "date", "time", "datetime", "close time", "open time"],
    "symbol": ["symbol", "instrument", "pair", "ticker"],
    "direction": ["action", "type", "direction", "side", "trade type"],
    "volume": ["lots", "volume", "size", "qty", "quantity"],
    "open_price": ["price", "open price", "entry price", "open", "entry"],
    "close_price": ["close price", "exit price", "close", "exit"],
    "profit": ["profit", "pnl", "net pnl", "gain", "p/l", "pl"],
    "commission": ["commission", "comm", "fees"],
    "swap": ["swap", "swap charge", "overnight"],
    "sl": ["sl", "stop loss", "sl price", "stop"],
    "tp": ["tp", "take profit", "tp price", "target"],
}

EQUITY_EDGE_MAP = {
    "date": ["time", "date", "datetime", "s/l", "date/time"],
    "symbol": ["type", "symbol", "instrument", "pair"],
    "direction": ["order", "type", "direction", "side", "action"],
    "volume": ["size", "volume", "lots", "qty"],
    "open_price": ["price", "open price", "entry price"],
    "close_price": ["close price", "exit price", "price close"],
    "profit": ["profit", "pnl", "net pnl", "gain", "p/l"],
    "commission": ["commission", "comm", "fees"],
    "swap": ["swap", "swap charge"],
    "sl": ["s/l", "stop loss", "sl"],
    "tp": ["t/p", "take profit", "tp"],
}


def _normalize_col(name: str) -> str:
    """Normalize a column name for matching."""
    return re.sub(r"[^a-z0-9/]", " ", name.lower().strip())


def _find_col(headers: list[str], candidates: list[str]) -> int | None:
    """Find the index of a column matching any candidate name."""
    normalized = [_normalize_col(h) for h in headers]
    for candidate in candidates:
        nc = _normalize_col(candidate)
        for i, h in enumerate(normalized):
            if nc in h or h in nc:
                return i
    return None


def _parse_decimal(value: str) -> float:
    """Parse a string to float, handling common formats."""
    if not value or not value.strip():
        return 0.0
    cleaned = value.strip().replace(",", "").replace("$", "").replace(" ", "")
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return 0.0


def _parse_direction(value: str) -> str:
    """Normalize direction to long/short."""
    v = value.strip().lower()
    if v in ("buy", "long", "b", "buy limit", "buy stop"):
        return "long"
    if v in ("sell", "short", "s", "sell limit", "sell stop"):
        return "short"
    return v


def _parse_datetime(value: str) -> datetime | None:
    """Try multiple datetime formats."""
    if not value or not value.strip():
        return None

    value = value.strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    # Try ISO format with timezone
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        pass

    return None


def _map_headers(
    headers: list[str], col_map: dict[str, list[str]]
) -> dict[str, int | None]:
    """Map normalized column names to header indices."""
    mapping: dict[str, int | None] = {}
    for field, candidates in col_map.items():
        mapping[field] = _find_col(headers, candidates)
    return mapping


def _extract_row(row: list[str], mapping: dict[str, int | None]) -> dict[str, Any]:
    """Extract trade data from a CSV row using a column mapping."""

    def get(field: str) -> str:
        idx = mapping.get(field)
        if idx is not None and idx < len(row):
            return row[idx]
        return ""

    open_time = _parse_datetime(get("date"))
    close_time = None

    # Some formats have separate close date
    if not open_time:
        return None  # type: ignore[return-value]

    direction_raw = get("direction")
    direction = _parse_direction(direction_raw)

    profit = _parse_decimal(get("profit"))
    volume = _parse_decimal(get("volume"))
    open_price = _parse_decimal(get("open_price"))
    close_price = _parse_decimal(get("close_price"))
    commission = _parse_decimal(get("commission"))
    swap = _parse_decimal(get("swap"))
    sl = _parse_decimal(get("sl"))
    tp = _parse_decimal(get("tp"))

    return {
        "open_time": open_time,
        "close_time": close_time,
        "symbol": get("symbol").strip() or "UNKNOWN",
        "direction": direction,
        "volume": volume,
        "entry_price": open_price,
        "exit_price": close_price,
        "sl_price": sl,
        "tp_price": tp,
        "commission": commission,
        "swap": swap,
        "profit": profit,
    }


def detect_format(file_content: str) -> str:
    """Detect the format of a CSV file.

    Returns one of: 'ftmo', 'myfundedfx', 'equity_edge', 'generic'
    """
    lines = file_content.strip().split("\n")
    if not lines:
        return "generic"

    header_line = lines[0].lower()

    # FTMO detection
    ftmo_indicators = ["direction", "open price", "close price"]
    if all(ind in header_line for ind in ftmo_indicators):
        return "ftmo"

    # MyFundedFX detection
    mff_indicators = ["action", "lots"]
    if all(ind in header_line for ind in mff_indicators):
        return "myfundedfx"

    # Equity Edge detection
    ee_indicators = ["s/l", "t/p"]
    if all(ind in header_line for ind in ee_indicators):
        return "equity_edge"

    return "generic"


def _parse_with_mapping(
    rows: list[list[str]], headers: list[str], col_map: dict[str, list[str]]
) -> list[dict[str, Any]]:
    """Parse rows using a specific column mapping."""
    mapping = _map_headers(headers, col_map)
    trades: list[dict[str, Any]] = []

    for row in rows:
        if not any(cell.strip() for cell in row):
            continue
        trade = _extract_row(row, mapping)
        if trade and trade["open_time"]:
            trades.append(trade)

    return trades


def parse_csv(file_content: str) -> list[dict[str, Any]]:
    """Parse CSV content and return a list of trade dicts.

    Auto-detects format and applies appropriate column mapping.
    """
    fmt = detect_format(file_content)
    reader = csv.reader(io.StringIO(file_content))
    rows = list(reader)

    if len(rows) < 2:
        return []

    headers = [h.strip() for h in rows[0]]
    data_rows = rows[1:]

    format_maps = {
        "ftmo": FTMO_MAP,
        "myfundedfx": MYFUNDEDFX_MAP,
        "equity_edge": EQUITY_EDGE_MAP,
    }

    if fmt in format_maps:
        trades = _parse_with_mapping(data_rows, headers, format_maps[fmt])
        if trades:
            return trades

    # Fallback: try all mappings, return the one with most results
    best_trades: list[dict[str, Any]] = []
    for col_map in [FTMO_MAP, MYFUNDEDFX_MAP, EQUITY_EDGE_MAP]:
        trades = _parse_with_mapping(data_rows, headers, col_map)
        if len(trades) > len(best_trades):
            best_trades = trades

    return best_trades


def parse_xlsx(file_content: bytes) -> list[dict[str, Any]]:
    """Parse XLSX content and return a list of trade dicts.

    Requires openpyxl to be installed.
    """
    try:
        import openpyxl
    except ImportError:
        raise ImportError(
            "openpyxl is required for XLSX parsing. Install with: pip install openpyxl"
        )

    wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        return []

    rows: list[list[str]] = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(cell) if cell is not None else "" for cell in row])

    wb.close()

    if len(rows) < 2:
        return []

    headers = [h.strip() for h in rows[0]]
    data_rows = rows[1:]

    # Try all format mappings
    best_trades: list[dict[str, Any]] = []
    for col_map in [FTMO_MAP, MYFUNDEDFX_MAP, EQUITY_EDGE_MAP]:
        trades = _parse_with_mapping(data_rows, headers, col_map)
        if len(trades) > len(best_trades):
            best_trades = trades

    return best_trades
