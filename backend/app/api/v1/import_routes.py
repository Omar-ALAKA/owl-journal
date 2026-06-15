# app/api/v1/import_routes.py
import csv
import io
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.trade import Trade
from app.models.account import Account

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

# ───────────────────────────────────────────────────────────
# Format detection & column mapping
# ───────────────────────────────────────────────────────────

COLUMN_MAP = {
    "ticket": ["ticket", "order", "order id", "trade id", "deal", "#", "trade #", "deal id", "position", "trade #"],
    "open_time": [
        "open time", "opentime", "open_time", "time", "date/time",
        "opening time", "open", "datetime", "timestamp", "time opened",
        "open date", "date opened", "heure", "date d'ouverture", "heure d'ouverture",
    ],
    "close_time": [
        "close time", "closetime", "close_time", "closing time",
        "close", "time closed", "closing date", "date closed", "time closed",
        "heure de fermeture", "date de fermeture", "heure",
    ],
    "symbol": ["symbol", "instrument", "pair", "ticker", "market", "asset", "symbole"],
    "direction": [
        "direction", "type", "side", "trade type", "order type",
        "transaction type", "cmd", "operation", "order type",
    ],
    "volume": [
        "volume", "size", "lots", "quantity", "qty", "amount",
        "volume (lots)", "size (lots)", "volume(lots)", "lot",
    ],
    "entry_price": [
        "entry price", "entry_price", "open price", "price",
        "opening price", "entry", "entry price", "open px", "buy price", "sell price",
        "prix", "prix d'entrée", "prix ouverture",
    ],
    "exit_price": [
        "exit price", "exit_price", "close price", "closing price",
        "exit", "close price", "close px", "prix de sortie", "prix fermeture", "prix",
    ],
    "sl_price": [
        "sl", "stop loss", "sl_price", "stoploss", "stop loss price",
        "sl price", "stop loss (sl)", "s / l", "stop loss", "sl",
    ],
    "tp_price": [
        "tp", "take profit", "tp_price", "takeprofit", "take profit price",
        "tp price", "take profit (tp)", "t / p", "take profit", "tp",
    ],
    "commission": ["commission", "comm", "commissions", "fee", "fees", "commission (comm)"],
    "swap": ["swap", "swap charge", "rollover", "echange"],
    "profit": [
        "profit", "pnl", "p&l", "net pnl", "gain", "pnl (usd)",
        "profit (usd)", "net profit", "result", "pnl (result)",
        "realized p&l", "closed p/l",
    ],
    "r_multiple": ["r multiple", "r_multiple", "r:r", "r/r", "rr", "r multiple (rm)"],
    "session": ["session", "trading session", "session name"],
    "setup": ["setup", "strategy", "setup name", "trade setup"],
    "notes": ["notes", "comment", "comments", "remark", "remarks"],
}


def _normalize_header(header: str) -> str:
    if header is None:
        return ""
    return re.sub(r"\s+", " ", header.strip().lower())


def _map_columns(headers: list[str]) -> dict[str, int]:
    normalized = [_normalize_header(h) for h in headers]
    mapping: dict[str, int] = {}
    used_indices: set[int] = set()

    for canonical, variants in COLUMN_MAP.items():
        for idx, norm in enumerate(normalized):
            if norm in variants and canonical not in mapping and idx not in used_indices:
                mapping[canonical] = idx
                used_indices.add(idx)
                break

    # Second pass: handle duplicate headers (e.g. "Heure" appears twice in Equity Edge)
    # Map unmapped canonical fields to columns with already-used header names
    for canonical, variants in COLUMN_MAP.items():
        if canonical not in mapping:
            for idx, norm in enumerate(normalized):
                if norm in variants and idx not in used_indices:
                    mapping[canonical] = idx
                    used_indices.add(idx)
                    break

    return mapping


def _safe_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s or s in ("-", "—", "N/A", "n/a"):
        return 0.0
    s = re.sub(r"[£€$¥₹,\s]", "", s)
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _safe_datetime(val: Any, fmt_hints: list[str] | None = None) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    # Handle Excel serial date (float)
    if isinstance(val, float):
        try:
            # Excel epoch: 1899-12-30 + days
            if 1 < val < 200000:  # reasonable range
                return datetime(1899, 12, 30) + timedelta(days=int(val))
        except (ValueError, OverflowError):
            pass
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
    if val is None:
        return ""
    s = str(val).strip().lower()
    if s in ("buy", "long", "b", "1", "buy market"):
        return "long"
    if s in ("sell", "short", "s", "-1", "2", "sell market"):
        return "short"
    return s


def _detect_format(headers: list[str]) -> str:
    normalized = [_normalize_header(h) for h in headers]
    joined = " ".join(normalized)

    # MT5: has "Deal", "Symbol", "Type", "Volume", "Price", "SL", "TP", "Profit", "Commission", "Swap"
    if any(h in normalized for h in ["deal", "deal id"]) and "profit" in joined:
        if "swap" in joined or "commission" in joined:
            return "mt5"

    # FTMO: similar to MT5 but with specific columns
    if "deal" in joined and "swap" in joined and "commission" in joined:
        return "ftmo"

    # MyFundedFX: has "Ticket", "Open Time", "Close Time", "Symbol", "Type"
    if "ticket" in joined and ("open time" in joined or "opening time" in joined):
        return "myfundedfx"

    # Equity Edge: has French headers "Heure", "Symbole", "Type", "S / L", "T / P", "Commission", "Echange"
    if "symbole" in joined and ("s / l" in joined or "t / p" in joined) and "echange" in joined:
        return "equity_edge"
    # Equity Edge English variant
    if "signal" in joined or "equity edge" in joined:
        return "equity_edge"

    # FundedNext: similar to FTMO
    if "order" in joined and "profit" in joined and "swap" in joined:
        return "fundednext"

    return "generic"


def _cell_to_str(cell: Any) -> str:
    """Convert an openpyxl cell value to string, handling numbers."""
    if cell is None:
        return ""
    if isinstance(cell, datetime):
        return cell.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(cell, float):
        # Format float: remove trailing zeros
        if cell == int(cell):
            return str(int(cell))
        return str(cell)
    return str(cell).strip()


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
            continue

        symbol = get("symbol")
        if not symbol:
            continue

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

        if not direction and profit != 0:
            direction = "long" if profit > 0 else "short"

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


def _parse_xlsx_content(content_bytes: bytes) -> list[dict]:
    """Parse XLSX content directly using openpyxl, handling Excel dates and multi-row headers."""
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content_bytes), read_only=True, data_only=True)

    all_trades = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))

        if len(rows) < 2:
            continue

        # Find header row: first row with at least 3 non-empty cells
        header_row_idx = 0
        for i, row in enumerate(rows):
            non_empty = sum(1 for c in row if c is not None and str(c).strip())
            if non_empty >= 3:
                header_row_idx = i
                break

        headers_raw = rows[header_row_idx]
        headers = [_cell_to_str(h) for h in headers_raw]
        logger.info(f"XLSX sheet '{sheet_name}' headers (row {header_row_idx}): {headers}")

        # Detect format from headers
        fmt = _detect_format(headers)

        # Map columns
        col_map = _map_columns(headers)
        logger.info(f"XLSX column mapping: {col_map}")

        # Parse data rows
        for row in rows[header_row_idx + 1:]:
            if all(c is None for c in row):
                continue

            # Convert all cells to strings
            str_row = [_cell_to_str(c) for c in row]

            def get(col_name: str, default: str = "") -> str:
                idx = col_map.get(col_name)
                if idx is None or idx >= len(str_row):
                    return default
                return str_row[idx]

            open_time_raw = get("open_time")
            close_time_raw = get("close_time")
            open_time = _safe_datetime(open_time_raw)
            close_time = _safe_datetime(close_time_raw)

            if not open_time:
                continue

            symbol = get("symbol")
            if not symbol:
                continue

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

            if not direction and profit != 0:
                direction = "long" if profit > 0 else "short"

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
            all_trades.append(trade)

    logger.info(f"XLSX parsed: {len(all_trades)} trades from {len(wb.sheetnames)} sheet(s)")
    return all_trades


# ───────────────────────────────────────────────────────────
# POST /import/preview
# ───────────────────────────────────────────────────────────
@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    account_id: int = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    logger.info(f"Import preview: file={file.filename}")
    filename = file.filename.lower()

    content_bytes = await file.read()
    logger.info(f"Import preview: file={file.filename}, size={len(content_bytes)}")
    if len(content_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    if filename.endswith(".csv") or filename.endswith(".txt"):
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
            trades = _parse_xlsx_content(content_bytes)
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

    total = len(trades)
    detected_format = trades[0]["detected_format"] if trades else "unknown"
    symbols = list(set(t["symbol"] for t in trades if t["symbol"]))
    total_profit = sum(t["profit"] for t in trades)
    wins = sum(1 for t in trades if t["profit"] > 0)
    losses = sum(1 for t in trades if t["profit"] < 0)

    logger.info(f"Import preview result: format={detected_format}, trades={total}, profit={total_profit:.2f}")

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
# POST /import/confirm
# ───────────────────────────────────────────────────────────
@router.post("/confirm")
async def confirm_import(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    trades_data = data.get("trades", [])
    account_id = data.get("account_id")

    logger.info(f"Import confirm: account_id={account_id}, trades={len(trades_data)}")

    if not trades_data:
        raise HTTPException(status_code=400, detail="No trades to import")

    if not account_id:
        raise HTTPException(status_code=400, detail="account_id is required")

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
            symbol = t.get("symbol")
            open_time_str = t.get("open_time")
            direction = t.get("direction", "long")

            if not symbol or not open_time_str:
                errors.append({
                    "row": idx,
                    "error": "Missing required fields: symbol, open_time",
                })
                continue

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

            close_time = None
            close_time_str = t.get("close_time")
            if close_time_str:
                if isinstance(close_time_str, str):
                    close_time = _safe_datetime(close_time_str)
                elif isinstance(close_time_str, datetime):
                    close_time = close_time_str

            profit = _safe_float(t.get("profit", 0))
            is_winner = 1 if profit > 0 else 0

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
            logger.error(f"Import error row {idx}: {e}", exc_info=True)
            errors.append({"row": idx, "error": str(e)})

    logger.info(f"Import confirm done: inserted={inserted}, errors={len(errors)}")

    return {
        "message": f"Imported {inserted} trades",
        "account_id": account_id,
        "inserted": inserted,
        "errors": errors,
        "error_count": len(errors),
        "trade_ids": created_trades,
    }
