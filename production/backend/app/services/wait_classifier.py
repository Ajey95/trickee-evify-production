from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Telemetry, WaitEvent
from app.services.alert_service import CHARGERS
from app.services.geo import haversine_km

STOP_SPEED_KMPH = 3.0
WAIT_CONTINUITY_GAP_MIN = 10
RESTAURANT_RADIUS_M = 120
CHARGER_RADIUS_M = 180

FALLBACK_RESTAURANTS = [
    {"name": "Hotel Kohinoor", "lat": 21.1701, "lng": 72.8310},
    {"name": "Varachha Pickup Cluster", "lat": 21.2103, "lng": 72.8788},
    {"name": "Althan Restaurant Hub", "lat": 21.1896, "lng": 72.8602},
]


def _distance_m(lat: float | None, lng: float | None, point: dict[str, Any]) -> int | None:
    if lat is None or lng is None:
        return None
    return int(haversine_km(lat, lng, float(point["lat"]), float(point["lng"])) * 1000)


def _nearest_distance(lat: float | None, lng: float | None, points: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, int | None]:
    if lat is None or lng is None:
        return None, None
    best = None
    best_distance = None
    for point in points:
        distance = _distance_m(lat, lng, point)
        if distance is not None and (best_distance is None or distance < best_distance):
            best = point
            best_distance = distance
    return best, best_distance


def classify_wait_snapshot(
    *,
    location: dict[str, float] | None = None,
    speed_kmph: float | None = None,
    ignition_on: bool | None = None,
    charge_plug: bool | None = None,
    restaurant_location: dict[str, float] | None = None,
    restaurant_locations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    lat = location.get("lat") if location else None
    lng = location.get("lng") if location else None
    restaurant_points = list(restaurant_locations or FALLBACK_RESTAURANTS)
    if restaurant_location:
        restaurant_points.insert(0, restaurant_location)

    restaurant, restaurant_distance_m = _nearest_distance(lat, lng, restaurant_points)
    charger, charger_distance_m = _nearest_distance(lat, lng, CHARGERS)
    stopped = speed_kmph is not None and speed_kmph < STOP_SPEED_KMPH

    if speed_kmph is None:
        wait_type = "restaurant_wait" if restaurant_distance_m is not None and restaurant_distance_m <= RESTAURANT_RADIUS_M else "approach_window"
        confidence = 0.5
        is_wait = wait_type == "restaurant_wait"
    elif not stopped:
        wait_type = "moving"
        confidence = 0.95
        is_wait = False
    elif charge_plug or (charger_distance_m is not None and charger_distance_m <= CHARGER_RADIUS_M and ignition_on is False):
        wait_type = "charging_wait"
        confidence = 0.86 if charge_plug else 0.72
        is_wait = True
    elif restaurant_distance_m is not None and restaurant_distance_m <= RESTAURANT_RADIUS_M:
        wait_type = "restaurant_wait"
        confidence = 0.82
        is_wait = True
    elif ignition_on:
        wait_type = "traffic_wait"
        confidence = 0.72
        is_wait = True
    else:
        wait_type = "idle_wait"
        confidence = 0.64
        is_wait = True

    return {
        "wait_type": wait_type,
        "is_wait": is_wait,
        "confidence": confidence,
        "restaurant_distance_m": restaurant_distance_m,
        "charger_distance_m": charger_distance_m,
        "nearest_restaurant": restaurant,
        "nearest_charger": charger,
        "context": {
            "speed": speed_kmph,
            "ignition_on": ignition_on,
            "charge_plug": charge_plug,
        },
    }


def classify_wait(
    row: Telemetry,
    *,
    order_context: dict[str, Any] | None = None,
    restaurant_locations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    restaurant_location = order_context.get("restaurant_location") if order_context else None
    result = classify_wait_snapshot(
        location={"lat": row.lat, "lng": row.lng} if row.lat is not None and row.lng is not None else None,
        speed_kmph=row.speed,
        ignition_on=row.ignition_on,
        charge_plug=row.charge_plug,
        restaurant_location=restaurant_location,
        restaurant_locations=restaurant_locations,
    )
    if result["wait_type"] == "restaurant_wait" and not order_context:
        result["confidence"] = min(result["confidence"], 0.68)

    result["context"] = {
        **result["context"],
            "speed": row.speed,
            "ignition_on": row.ignition_on,
            "charge_plug": row.charge_plug,
            "soc": row.soc,
            "order_context_present": bool(order_context),
    }
    return result


def update_wait_event(
    db: Session,
    row: Telemetry,
    *,
    order_context: dict[str, Any] | None = None,
    restaurant_locations: list[dict[str, Any]] | None = None,
) -> WaitEvent | None:
    classification = classify_wait(row, order_context=order_context, restaurant_locations=restaurant_locations)
    open_event = (
        db.query(WaitEvent)
        .filter(WaitEvent.vehicle_id == row.vehicle_id, WaitEvent.ended_at.is_(None))
        .order_by(desc(WaitEvent.started_at))
        .first()
    )

    if not classification["is_wait"]:
        if open_event:
            open_event.ended_at = row.recorded_at
            open_event.last_seen_at = row.recorded_at
            open_event.duration_seconds = int(max(0.0, (row.recorded_at - open_event.started_at).total_seconds()))
        return None

    if open_event:
        gap = row.recorded_at - open_event.last_seen_at
        same_type = open_event.wait_type == classification["wait_type"]
        if same_type and gap <= timedelta(minutes=WAIT_CONTINUITY_GAP_MIN):
            open_event.last_seen_at = row.recorded_at
            open_event.duration_seconds = int(max(0.0, (row.recorded_at - open_event.started_at).total_seconds()))
            open_event.confidence = max(open_event.confidence, classification["confidence"])
            open_event.lat = row.lat
            open_event.lng = row.lng
            open_event.ignition_on = row.ignition_on
            open_event.charge_plug = row.charge_plug
            open_event.restaurant_distance_m = classification["restaurant_distance_m"]
            open_event.charger_distance_m = classification["charger_distance_m"]
            open_event.context = classification["context"]
            return open_event
        open_event.ended_at = row.recorded_at
        open_event.last_seen_at = row.recorded_at
        open_event.duration_seconds = int(max(0.0, (row.recorded_at - open_event.started_at).total_seconds()))

    event = WaitEvent(
        vehicle_id=row.vehicle_id,
        driver_id=row.driver_id,
        started_at=row.recorded_at,
        last_seen_at=row.recorded_at,
        wait_type=classification["wait_type"],
        source="telemetry",
        ignition_on=row.ignition_on,
        charge_plug=row.charge_plug,
        lat=row.lat,
        lng=row.lng,
        duration_seconds=0,
        confidence=classification["confidence"],
        restaurant_distance_m=classification["restaurant_distance_m"],
        charger_distance_m=classification["charger_distance_m"],
        context=classification["context"],
    )
    db.add(event)
    db.flush()
    return event
