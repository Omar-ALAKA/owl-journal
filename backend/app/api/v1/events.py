# app/api/v1/events.py — SSE endpoint for real-time trade updates via PostgreSQL LISTEN/NOTIFY
import asyncio
import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["events"])

# Try to import asyncpg for LISTEN/NOTIFY
try:
    import asyncpg
    HAS_ASYNC_PG = True
except ImportError:
    HAS_ASYNC_PG = False
    logger.warning("asyncpg not installed — SSE events will use polling fallback")

async def get_db_conn():
    """Get a raw asyncpg connection for LISTEN/NOTIFY."""
    from app.config import get_settings
    settings = get_settings()
    # Parse the DATABASE_URL to extract connection params
    # postgresql+asyncpg://user:pass@host:port/dbname
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    return await asyncpg.connect(url)


@router.get("/")
async def stream_events():
    """SSE endpoint that listens for PostgreSQL NOTIFY on trade changes."""
    async def event_generator():
        if not HAS_ASYNC_PG:
            # Fallback: send a keepalive every 30s
            while True:
                yield f"event: ping\ndata: {json.dumps({'type': 'ping', 'ts': asyncio.get_event_loop().time()})}\n\n"
                await asyncio.sleep(30)
            return

        try:
            conn = await get_db_conn()
            await conn.add_listener('trade_updated', lambda *args: None)
            # We use a queue to bridge the asyncpg callback to the async generator
            queue = asyncio.Queue()

            def handle_notify(connection, pid, channel, payload):
                try:
                    queue.put_nowait(payload)
                except Exception:
                    pass

            await conn.add_listener('trade_updated', handle_notify)

            # Send initial connected event
            yield f"event: connected\ndata: {json.dumps({'type': 'connected'})}\n\n"

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"event: trade_updated\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"event: ping\ndata: {json.dumps({'type': 'ping'})}\n\n"
        except Exception as e:
            logger.error(f"SSE connection error: {e}")
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
