from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.services.live_intelligence import live_map_context
from app.services.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

_PUSH_INTERVAL_SECONDS = 5


def _get_user_from_token(token: str) -> User | None:
    """Decode a JWT passed as a query-param and return the matching User.

    Returns *None* on any auth failure so callers can close with code 4001.
    This is the WS-safe equivalent of ``get_current_user`` (which uses the
    Authorization header and cannot be used during a WebSocket handshake).
    """
    settings = get_settings()
    db: Session = SessionLocal()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.get(User, user_id)
        if not user or not user.is_active:
            return None
        return user
    except JWTError:
        return None
    finally:
        db.close()


@router.websocket("/ws/live-map")
async def ws_live_map(ws: WebSocket, token: str = Query(...), driver_id: str | None = Query(default=None)):
    """Push live-map snapshots to the connected client every 5 seconds.

    Authentication is via the JWT access token supplied as ``?token=<jwt>``.
    Browsers cannot set custom headers during a WebSocket handshake, so the
    query-param approach is the standard workaround.

    The server pushes a JSON envelope::

        {"type": "live_map", "data": { ...same shape as GET /intelligence/live-map... }}

    The client may send any text frame to keep the connection alive; such
    messages are silently ignored.
    """
    user = _get_user_from_token(token)
    if user is None:
        await ws.close(code=4001)
        return

    await manager.connect(ws, user.id)
    try:
        while True:
            db: Session = SessionLocal()
            try:
                data = live_map_context(db, user, driver_id=driver_id)
            finally:
                db.close()

            await ws.send_json({"type": "live_map", "data": data})
            await asyncio.sleep(_PUSH_INTERVAL_SECONDS)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WS error for user %s: %s", user.id, exc)
    finally:
        await manager.disconnect(ws)
