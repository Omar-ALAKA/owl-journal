# app/api/v1/import.py
import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.trade import Trade
from app.models.account import Account

router = APIRouter(prefix="/import", tags=["import"])

# ───────────────────────────────────────────────────────────
# Format detection & column mapping
# ───────────────────────────────────────────────────────────

# Known column name variants (lowercased)
COLUMN_MAP = {
    # identity
    "ticket": ["ticket", "order", "order id", "trade id", "deal", "#"],
    # open time
    "open_time": [
        "open time", "opentime", "open_time", "time", "date/time",
        "opening time", "open", "datetime", "timestamp", "time opened",
    ],
    # close time
    "close_time": [
        "close time", "closetime", "close_time", "closing time",
        "close", "time closed", "time closed",
    ],
    # symbol
    "symbol": ["symbol", "instrument", "pair", "ticker", "market"],
    # direction
    "direction": [
        "direction", "type", "side", "trade type", "order type",
        "transaction type", "cmd", "type",
    ],
    # volume / lots
    "volume": [
        "volume", "size", "lots", "quantity", "qty", "amount",
        "volume (lots)", "size (lots)",
    ],
    # entry price
    "entry_price": [
        "entry price", "entry_price", "open price", "price",
        "opening price", "entry", "open price",
    ],
    # exit price
    "exit_price": [
        "exit price", "exit_price", "close price", "closing price",
        "exit", "close price",
    ],
    # stop loss
    "sl_price": [
        "sl", "stop loss", "sl_price", "stoploss", "stop loss price",
        "sl price",
    ],
    # take profit
    "tp_price": [
        "tp", "take profit", "tp_price", "takeprofit", "take profit price",
        "tp price",
    ],
    # commission
    "commission": ["commission", "comm", "commissions", "fee", "fees"],
    # swap
    "swap": ["swap", "swap charge", "rollover"],
    # profit
    "profit": [
        "profit", "pnl", "p&l", "net pnl", "gain", "pnl (usd)",
        "profit (usd)", "profit (usd)", "net profit",
    ],
    # r_multiple
    "r_multiple": ["r multiple", "r_multiple", "r:r", "r/r", "rr"],
    # session
    "session": ["session", "trading session", "session name"],
    # setup
    "setup": ["setup", "strategy", "setup name", "trade setup"],
    # notes
    "notes": ["notes", "comment", "comments", "remark", "remarks"],
}


def _normalize_header(header: str) -> str:
    """Lowercase, strip, collapse whitespace."""
    return re.sub(r"\s+", " ", header.strip().lower())


def _map_columns(headers: list[str]) -> dict[str, int]:
    """
    Returns mapping: canonical_name -> column_index.
    Uses first match wins.
    """
    normalized = [_normalize_header(h) for h in headers]
    mapping: dict[str, int] = {}
    for canonical, variants in COLUMN_MAP.items():
        for idx, norm in enumerate(normalized):
            if norm in variants and canonical not in mapping:
                mapping[canonical] = idx
                break
    return mapping


def _safe_float(val: Any) -> float:
    """Parse a float from string, handling commas, currency symbols, etc."""
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s or s in ("-", "—", "N/A", "n/a"):
        return 0.0
    # Remove currency symbols and thousands separators
    s = re.sub(r"[£€$¥₹,\s]", "", s)
    # Handle parentheses as negative
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _safe_datetime(val: Any, fmt_hints: list[str] | None = None) -> datetime | None:
    """Parse a datetime from various formats."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    s = str(val).strip()
    if not s or s in ("-", "—", "N/A", "n/a"):
        return None

    formats = fmt_hints or [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M",
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
        "%Y.%m.%d %H:%M:%S",
        "%Y.%m.%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _detect_direction(val: Any) -> str:
    """Normalize direction string."""
    if val is None:
        return ""
    s = str(val).strip().lower()
    if s in ("buy", "long", "b", "1"):
        return "long"
    if s in ("sell", "short", "s", "-1", "2"):
        return "short"
    return s


def _detect_format(headers: list[str]) -> str:
    """Heuristic to detect the broker export format."""
    normalized = [_normalize_header(h) for h in headers]
    joined = " ".join(normalized)

    # FTMO: typically has "Deal", "Symbol", "Type", "Volume", "Price", etc.
    if any(h in normalized for h in ["deal", "order"]) and "profit" in joined:
        if "swap" in joined and "commission" in joined:
            return "ftmo"

    # MyFundedFX: has "Ticket", "Open Time", "Close Time", "Symbol", "Type"
    if "ticket" in joined and ("open time" in joined or "opening time" in joined):
        return "myfundedfx"

    # Equity Edge: has "Trade #", "Signal", "Entry", "Exit"
    if "signal" in joined or "equity edge" in joined:
        return "equity_edge"

    # Generic CSV
    return "generic"


def _parse_csv_content(content: str) -> list[dict]:
    """Parse CSV content and return list of trade dicts."""
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    if len(rows) < 2:
        return []

    headers = rows[0]
    col_map = _map_columns(headers)
    fmt = _detect_format(headers)

    trades = []
    for row in rows[1:]:
        if not row or all(not c.strip() for c in row):
            continue

        def get(col_name: str, default: str = "") -> str:
            idx = col_map.get(col_name)
            if idx is None or idx >= len(row):
                return default
            return row[idx].strip()

        open_time_raw = get("open_time")
        close_time_raw = get("close_time")
        open_time = _safe_datetime(open_time_raw)
        close_time = _safe_datetime(close_time_raw)

        if not open_time:
            continue  # Skip rows without open time

        symbol = get("symbol")
        if not symbol:
            continue  # Skip rows without symbol

        direction = _detect_direction(get("direction"))
        volume = _safe_float(get("volume"))
        entry_price = _safe_float(get("entry_price"))
        exit_price = _safe_float(get("exit_price"))
        sl_price = _safe_float(get("sl_price"))
        tp_price = _safe_float(get("tp_price"))
        commission = _safe_float(get("commission"))
        swap = _safe_float(get("swap"))
        profit = _safe_float(get("profit"))
        r_multiple = _safe_float(get("r_multiple"))
        session = get("session")
        setup = get("setup")
        notes = get("notes")
        ticket = get("ticket")

        # Infer direction from profit if not set
        if not direction and profit != 0:
            direction = "long" if profit > 0 else "short"

        # Infer exit price from entry + profit if missing
        if exit_price == 0 and profit != 0 and entry_price != 0 and volume != 0:
            # Rough estimate: profit = (exit - entry) * volume * 100000 (for forex)
            # This is approximate; better to have actual exit price
            pass

        trade = {
            "ticket": ticket or None,
            "open_time": open_time.isoformat(),
            "close_time": close_time.isoformat() if close_time else None,
            "symbol": symbol.upper(),
            "direction": direction or "long",
            "volume": volume,
            "entry_price": entry_price,
            "exit_price": exit_price if exit_price > 0 else None,
            "sl_price": sl_price if sl_price > 0 else None,
            "tp_price": tp_price if tp_price > 0 else None,
            "commission": commission,
            "swap": swap,
            "profit": profit,
            "r_multiple": r_multiple if r_multiple > 0 else None,
            "session": session or None,
            "setup": setup or None,
            "notes": notes or None,
            "detected_format": fmt,
        }
        trades.append(trade)

    return trades


# ───────────────────────────────────────────────────────────
# POST /import/preview  — Parser un fichier sans sauvegarder
# ───────────────────────────────────────────────────────────
@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    account_id: int = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Parse un fichier CSV/XLSX et retourne les trades détectés
    sans les sauvegarder en base.
    """

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = file.filename.lower()

    # Lire le contenu
    content_bytes = await file.read()
    if len(content_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    if filename.endswith(".csv") or filename.endswith(".txt"):
        # Essayer plusieurs encodages
        for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                content = content_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(400, detail="Unable to decode file")

        trades = _parse_csv_content(content)

    elif filename.endswith((".xlsx", ".xls")):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content_bytes), read_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if len(rows) < 2:
                raise HTTPException(400, detail="Empty spreadsheet")

            headers = [str(h) if h else "" for h in rows[0]]
            content_lines = []
            content_lines.append(",".join(headers))
            for row in rows[1:]:
                line = ",".join(
                    str(c) if c is not None else "" for c in row
                )
                content_lines.append(line)
            content = "\n".join(content_lines)
            trades = _parse_csv_content(content)
        except ImportError:
            raise HTTPException(
                500,
                detail="openpyxl not installed. Install with: pip install openpyxl",
            )
    else:
        raise HTTPException(
            400,
            detail="Unsupported file format. Use .csv, .txt, .xlsx, or .xls",
        )

    # Si account_id fourni, vérifier qu'il existe
    account_info = None
    if account_id:
        acc_result = await db.execute(
            select(Account).where(Account.id == account_id)
        )
        acc = acc_result.scalar_one_or_none()
        if acc:
            account_info = {
                "id": acc.id,
                "name": acc.name,
                "broker": acc.broker,
            }

    # Stats rapides
    total = len(trades)
    detected_format = trades[0]["detected_format"] if trades else "unknown"
    symbols = list(set(t["symbol"] for t in trades if t["symbol"]))
    total_profit = sum(t["profit"] for t in trades)
    wins = sum(1 for t in trades if t["profit"] > 0)
    losses = sum(1 for t in trades if t["profit"] < 0)

    return {
        "preview": True,
        "filename": file.filename,
        "detected_format": detected_format,
        "total_trades": total,
        "symbols": sorted(symbols),
        "stats": {
            "total_profit": round(total_profit, 2),
            "wins": wins,
            "losses": losses,
            "win_rate": round(wins / total * 100, 1) if total > 0 else 0,
        },
        "account": account_info,
        "trades": trades,
    }


# ───────────────────────────────────────────────────────────
# POST /import/confirm  — Confirmer l'insertion des trades
# ───────────────────────────────────────────────────────────
@router.post("/confirm")
async def confirm_import(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirme l'insertion des trades parsés.
    Attend: { "trades": [...], "account_id": int }
    Chaque trade doit avoir au minimum: symbol, open_time, direction.
    """

    trades_data = data.get("trades", [])
    account_id = data.get("account_id")

    if not trades_data:
        raise HTTPException(status_code=400, detail="No trades to import")

    if not account_id:
        raise HTTPException(status_code=400, detail="account_id is required")

    # Vérifier que le compte existe
    acc_result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    inserted = 0
    errors = []
    created_trades = []

    for idx, t in enumerate(trades_data):
        try:
            # Champs requis
            symbol = t.get("symbol")
            open_time_str = t.get("open_time")
            direction = t.get("direction", "long")

            if not symbol or not open_time_str:
                errors.append({
                    "row": idx,
                    "error": "Missing required fields: symbol, open_time",
                })
                continue

            # Parser open_time
            if isinstance(open_time_str, str):
                open_time = _safe_datetime(open_time_str)
            elif isinstance(open_time_str, datetime):
                open_time = open_time_str
            else:
                open_time = None

            if not open_time:
                errors.append({
                    "row": idx,
                    "error": f"Cannot parse open_time: {open_time_str}",
                })
                continue

            # Parser close_time
            close_time = None
            close_time_str = t.get("close_time")
            if close_time_str:
                if isinstance(close_time_str, str):
                    close_time = _safe_datetime(close_time_str)
                elif isinstance(close_time_str, datetime):
                    close_time = close_time_str

            # Calculer is_winner
            profit = _safe_float(t.get("profit", 0))
            is_winner = 1 if profit > 0 else 0

            # Calculer r_multiple si absent
            r_multiple = t.get("r_multiple")
            if r_multiple is None and profit != 0:
                sl_price = _safe_float(t.get("sl_price", 0))
                entry_price = _safe_float(t.get("entry_price", 0))
                if sl_price > 0 and entry_price > 0:
                    risk = abs(entry_price - sl_price)
                    if risk > 0:
                        r_multiple = profit / risk

            trade = Trade(
                account_id=account_id,
                ticket=t.get("ticket"),
                open_time=open_time,
                close_time=close_time,
                symbol=symbol.upper(),
                direction=direction,
                volume=_safe_float(t.get("volume", 0)),
                entry_price=_safe_float(t.get("entry_price", 0)),
                exit_price=_safe_float(t.get("exit_price", 0)) or None,
                sl_price=_safe_float(t.get("sl_price", 0)) or None,
                tp_price=_safe_float(t.get("tp_price", 0)) or None,
                commission=_safe_float(t.get("commission", 0)),
                swap=_safe_float(t.get("swap", 0)),
                profit=profit,
                r_multiple=r_multiple if r_multiple else 0,
                session=t.get("session"),
                setup=t.get("setup"),
                notes=t.get("notes"),
                is_winner=is_winner,
            )
            db.add(trade)
            await db.flush()
            created_trades.append(trade.id)
            inserted += 1

        except Exception as e:
            errors.append({"row": idx, "error": str(e)})

    return {
        "message": f"Imported {inserted} trades",
        "account_id": account_id,
        "inserted": inserted,
        "errors": errors,
        "error_count": len(errors),
        "trade_ids": created_trades,
    }
