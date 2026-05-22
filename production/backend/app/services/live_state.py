from __future__ import annotations

import json
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

DRIVER_KEY_PREFIX = "trickee:live-state:driver:"
VEHICLE_KEY_PREFIX = "trickee:live-state:vehicle:"


def _safe_point(point: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "driver_id",
        "driver_code",
        "vehicle_id",
        "fleet_id",
        "lat",
        "lng",
        "soc",
        "speed",
        "recorded_at",
    }
    return {key: point.get(key) for key in allowed if point.get(key) is not None}


async def store_live_vehicle_point(point: dict[str, Any], redis_url: str | None = None) -> None:
    settings = get_settings()
    if not settings.live_state_redis_enabled:
        return
    redis_url = redis_url or settings.redis_url
    if not redis_url:
        return

    payload = _safe_point(point)
    if not payload.get("vehicle_id") or not payload.get("driver_id"):
        return

    ttl_seconds = max(60, settings.live_state_ttl_seconds)
    try:
        from redis.asyncio import Redis
    except Exception as exc:
        logger.warning("Redis live-state disabled, package unavailable: %s", exc)
        return

    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        encoded = json.dumps(payload, default=str)
        await client.setex(f"{VEHICLE_KEY_PREFIX}{payload['vehicle_id']}", ttl_seconds, encoded)
        await client.setex(f"{DRIVER_KEY_PREFIX}{payload['driver_id']}", ttl_seconds, encoded)
        await client.aclose()
    except Exception as exc:
        logger.warning("Redis live-state write failed: %s", exc)


def load_live_points_for_drivers(driver_ids: list[str], redis_url: str | None = None) -> dict[str, dict[str, Any]]:
    settings = get_settings()
    if not settings.live_state_redis_enabled:
        return {}
    redis_url = redis_url or settings.redis_url
    if not redis_url or not driver_ids:
        return {}

    try:
        from redis import Redis
    except Exception as exc:
        logger.warning("Redis live-state disabled, package unavailable: %s", exc)
        return {}

    keys = [f"{DRIVER_KEY_PREFIX}{driver_id}" for driver_id in driver_ids]
    try:
        client = Redis.from_url(redis_url, decode_responses=True)
        values = client.mget(keys)
        client.close()
    except Exception as exc:
        logger.warning("Redis live-state read failed: %s", exc)
        return {}

    points: dict[str, dict[str, Any]] = {}
    for driver_id, value in zip(driver_ids, values):
        if not value:
            continue
        try:
            point = json.loads(value)
        except json.JSONDecodeError:
            continue
        if point.get("driver_id") == driver_id:
            points[driver_id] = point
    return points
