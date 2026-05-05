from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """In-memory store of active WebSocket connections.

    Keyed by the WebSocket object; value is the authenticated user-id string.
    This is sufficient for a single-worker deployment.  For multi-worker
    setups add a Redis pub/sub broadcast layer in front of this manager.
    """

    def __init__(self) -> None:
        self._connections: dict[WebSocket, str] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: str) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[ws] = user_id
        logger.info("WS connected: user=%s  total=%d", user_id, len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(ws, None)
        logger.info("WS disconnected  total=%d", len(self._connections))

    @property
    def active_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()
