from __future__ import annotations

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Telemetry, Trip
from app.services.geo import haversine_km
from app.services.trip_outcome import update_personal_factor_from_trip

MIN_MOVING_SPEED_KMPH = 3.0


def _valid_gps(row: Telemetry) -> bool:
    return row.lat is not None and row.lng is not None and row.lat != 0 and row.lng != 0


def _distance_for_trip(db: Session, trip: Trip) -> float:
    rows = (
        db.query(Telemetry)
        .filter(
            Telemetry.vehicle_id == trip.vehicle_id,
            Telemetry.recorded_at >= trip.started_at,
            Telemetry.recorded_at <= (trip.ended_at or trip.started_at),
            Telemetry.lat.is_not(None),
            Telemetry.lng.is_not(None),
        )
        .order_by(Telemetry.recorded_at)
        .all()
    )
    distance = 0.0
    prev = None
    for row in rows:
        if not _valid_gps(row):
            continue
        if prev is not None:
            hop = haversine_km(prev.lat, prev.lng, row.lat, row.lng)
            if hop < 2.0:
                distance += hop
        prev = row
    return round(distance, 3)


def update_inferred_trip(db: Session, row: Telemetry) -> Trip | None:
    """Infer trips from ignition, speed, GPS, and SOC when Evify trip_id is absent."""
    if not row.driver_id:
        return None

    moving = row.ignition_on and row.speed >= MIN_MOVING_SPEED_KMPH and _valid_gps(row)
    open_trip = (
        db.query(Trip)
        .filter(Trip.vehicle_id == row.vehicle_id, Trip.driver_id == row.driver_id, Trip.ended_at.is_(None))
        .order_by(desc(Trip.started_at))
        .first()
    )

    if moving and not open_trip:
        trip = Trip(
            vehicle_id=row.vehicle_id,
            driver_id=row.driver_id,
            started_at=row.recorded_at,
            origin_lat=row.lat,
            origin_lng=row.lng,
            soc_start=row.soc,
            route_taken="gps_inferred",
            recommended_route="gps_inferred",
            followed_nudge=None,
        )
        db.add(trip)
        return trip

    if open_trip and _valid_gps(row):
        open_trip.dest_lat = row.lat
        open_trip.dest_lng = row.lng
        open_trip.soc_end = row.soc

    if open_trip and not moving:
        open_trip.ended_at = row.recorded_at
        open_trip.soc_end = row.soc
        if _valid_gps(row):
            open_trip.dest_lat = row.lat
            open_trip.dest_lng = row.lng
        if open_trip.soc_start is not None and open_trip.soc_end is not None:
            open_trip.kwh_used = round(max(0.0, open_trip.soc_start - open_trip.soc_end) * 1.824 / 100.0, 4)
        open_trip.distance_km = _distance_for_trip(db, open_trip)
        # Update driver personal_factor from observed vs Google-predicted travel time.
        # Pure backend EMA — no agent needed. Caller owns the commit.
        update_personal_factor_from_trip(db, open_trip)
        return open_trip

    return open_trip
