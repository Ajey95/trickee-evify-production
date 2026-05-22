from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import anyio
from fastapi import WebSocket

from app.services.live_state import store_live_vehicle_point

logger = logging.getLogger(__name__)
REDIS_CHANNEL = "trickee:live-map:vehicle-point"


@dataclass(frozen=True)
class ConnectionScope:
    user_id: str
    role: str
    fleet_id: str | None
    driver_id: str | None
    selected_driver_id: str | None = None


class ConnectionManager:
    """In-memory store of active WebSocket connections.

    Keyed by the WebSocket object; value is the authenticated connection scope.
    This is sufficient for a single-worker deployment.  For multi-worker
    setups add a Redis pub/sub broadcast layer in front of this manager.
    """

    def __init__(self) -> None:
        self._connections: dict[WebSocket, ConnectionScope] = {}
        self._lock = asyncio.Lock()
        self._instance_id = f"{os.getpid()}-{id(self)}"
        self._redis_listener_task: asyncio.Task | None = None

    async def connect(self, ws: WebSocket, scope: ConnectionScope) -> None:
        await ws.accept()
        async with self._lock:
            self._connections[ws] = scope
        logger.info("WS connected: user=%s  total=%d", scope.user_id, len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.pop(ws, None)
        logger.info("WS disconnected  total=%d", len(self._connections))

    def _can_receive(self, scope: ConnectionScope, point: dict[str, Any]) -> bool:
        point_driver_id = point.get("driver_id")
        point_fleet_id = point.get("fleet_id")
        if scope.selected_driver_id and point_driver_id != scope.selected_driver_id:
            return False
        if scope.role == "trickee_admin":
            return True
        if scope.role == "fleet_operator":
            return bool(scope.fleet_id and point_fleet_id == scope.fleet_id)
        if scope.role == "driver":
            return bool(scope.driver_id and point_driver_id == scope.driver_id)
        return False

    async def broadcast_vehicle_point(self, point: dict[str, Any]) -> None:
        async with self._lock:
            targets = [
                (ws, scope)
                for ws, scope in self._connections.items()
                if self._can_receive(scope, point)
            ]

        if not targets:
            return

        payload = {key: value for key, value in point.items() if key != "fleet_id"}
        stale: list[WebSocket] = []
        for ws, scope in targets:
            try:
                await ws.send_json({"type": "vehicle_point", "data": payload})
            except Exception as exc:
                logger.warning("WS push failed for user %s: %s", scope.user_id, exc)
                stale.append(ws)

        for ws in stale:
            await self.disconnect(ws)

    async def publish_vehicle_point(self, point: dict[str, Any], redis_url: str | None = None) -> None:
        await store_live_vehicle_point(point, redis_url)
        await self.broadcast_vehicle_point(point)
        if not redis_url:
            return
        try:
            from redis.asyncio import Redis
        except Exception as exc:
            logger.warning("Redis live-map broadcast disabled, package unavailable: %s", exc)
            return
        try:
            client = Redis.from_url(redis_url, decode_responses=True)
            await client.publish(
                REDIS_CHANNEL,
                json.dumps({"instance_id": self._instance_id, "point": point}, default=str),
            )
            await client.aclose()
        except Exception as exc:
            logger.warning("Redis live-map publish failed: %s", exc)

    def broadcast_vehicle_point_from_thread(self, point: dict[str, Any]) -> None:
        if not self.active_count:
            return
        try:
            anyio.from_thread.run(self.broadcast_vehicle_point, point)
        except RuntimeError as exc:
            logger.warning("Skipped live vehicle push outside ASGI worker thread: %s", exc)

    def publish_vehicle_point_from_thread(self, point: dict[str, Any], redis_url: str | None = None) -> None:
        if not self.active_count and not redis_url:
            return
        try:
            anyio.from_thread.run(self.publish_vehicle_point, point, redis_url)
        except RuntimeError as exc:
            logger.warning("Skipped live vehicle publish outside ASGI worker thread: %s", exc)

    def schedule_vehicle_point_publish(self, point: dict[str, Any], redis_url: str | None = None) -> None:
        """Publish live-map updates without blocking telemetry ingest responses."""
        if not self.active_count and not redis_url:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            self.publish_vehicle_point_from_thread(point, redis_url)
            return
        loop.create_task(self.publish_vehicle_point(point, redis_url))

    async def start_redis_listener(self, redis_url: str | None) -> None:
        if not redis_url or self._redis_listener_task:
            return
        try:
            from redis.asyncio import Redis
        except Exception as exc:
            logger.warning("Redis live-map listener disabled, package unavailable: %s", exc)
            return

        async def _listen() -> None:
            client = Redis.from_url(redis_url, decode_responses=True)
            pubsub = client.pubsub()
            try:
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info("Redis live-map listener subscribed to %s", REDIS_CHANNEL)
                async for message in pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    payload = json.loads(message.get("data") or "{}")
                    if payload.get("instance_id") == self._instance_id:
                        continue
                    point = payload.get("point")
                    if isinstance(point, dict):
                        await self.broadcast_vehicle_point(point)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Redis live-map listener stopped: %s", exc)
            finally:
                await pubsub.close()
                await client.aclose()

        self._redis_listener_task = asyncio.create_task(_listen())

    @property
    def active_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()
