from __future__ import annotations

import re
from datetime import datetime
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import (
    Driver,
    MobileChargingSession,
    MobileTripSession,
    MobileWaitEvent,
    Telemetry,
    User,
    Vehicle,
)

T = TypeVar("T")

DESTINATION_FILLER_RE = re.compile(
    r"\b(go to|going to|navigate to|customer location|delivery|drop|pickup|near|in)\b",
    re.IGNORECASE,
)
SPACES_RE = re.compile(r"\s+")


def require_mobile_driver(db: Session, user: User) -> Driver:
    if user.role != "driver" or not user.driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mobile driver app access requires an approved mapped driver account",
        )
    driver = db.get(Driver, user.driver_id)
    if not driver or driver.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mapped driver profile is not active")
    return driver


def latest_vehicle_for_driver(db: Session, driver_id: str) -> tuple[Vehicle | None, Telemetry | None]:
    latest = (
        db.query(Telemetry)
        .filter(Telemetry.driver_id == driver_id)
        .order_by(desc(Telemetry.recorded_at))
        .first()
    )
    if not latest:
        return None, None
    vehicle = db.get(Vehicle, latest.vehicle_id) if latest.vehicle_id else None
    if not vehicle or vehicle.deleted_at is not None:
        return None, latest
    return vehicle, latest


def resolve_mobile_vehicle(db: Session, driver_id: str, vehicle_id: str | None = None) -> Vehicle | None:
    if vehicle_id:
        vehicle = db.get(Vehicle, vehicle_id)
        if not vehicle or vehicle.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        latest = (
            db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .first()
        )
        if latest and latest.driver_id and latest.driver_id != driver_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vehicle is not mapped to this driver")
        return vehicle
    vehicle, _ = latest_vehicle_for_driver(db, driver_id)
    return vehicle


def existing_by_idempotency(db: Session, model: type[T], idempotency_key: str | None) -> T | None:
    if not idempotency_key:
        return None
    return db.query(model).filter(model.idempotency_key == idempotency_key).first()


def active_trip_for_driver(db: Session, driver_id: str, trip_session_id: str | None = None) -> MobileTripSession | None:
    query = db.query(MobileTripSession).filter(MobileTripSession.driver_id == driver_id)
    if trip_session_id:
        trip = query.filter(MobileTripSession.id == trip_session_id).first()
        if not trip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip session not found")
        return trip
    return query.filter(MobileTripSession.status == "active").order_by(desc(MobileTripSession.started_at)).first()


def active_wait_for_driver(db: Session, driver_id: str, wait_event_id: str | None = None) -> MobileWaitEvent | None:
    query = db.query(MobileWaitEvent).filter(MobileWaitEvent.driver_id == driver_id)
    if wait_event_id:
        row = query.filter(MobileWaitEvent.id == wait_event_id).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waiting event not found")
        return row
    return query.filter(MobileWaitEvent.ended_at.is_(None)).order_by(desc(MobileWaitEvent.started_at)).first()


def active_charging_for_driver(
    db: Session,
    driver_id: str,
    charging_session_id: str | None = None,
) -> MobileChargingSession | None:
    query = db.query(MobileChargingSession).filter(MobileChargingSession.driver_id == driver_id)
    if charging_session_id:
        row = query.filter(MobileChargingSession.id == charging_session_id).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Charging session not found")
        return row
    return query.filter(MobileChargingSession.ended_at.is_(None)).order_by(desc(MobileChargingSession.started_at)).first()


def close_duration_seconds(started_at: datetime, ended_at: datetime) -> int:
    return max(0, int((ended_at - started_at).total_seconds()))


def resolve_destination_text(text: str) -> dict[str, Any]:
    normalized = SPACES_RE.sub(" ", text.strip())
    extracted = DESTINATION_FILLER_RE.sub(" ", normalized)
    extracted = SPACES_RE.sub(" ", extracted).strip(" .,")
    confidence = 0.25
    if extracted:
        confidence = 0.55
    if len(extracted) >= 4:
        confidence = 0.72
    if len(extracted.split()) >= 2:
        confidence = 0.82
    if any(char.isdigit() for char in extracted):
        confidence = min(0.88, confidence + 0.05)
    return {
        "raw_text": normalized,
        "destination_text": extracted or normalized,
        "intent": "start_trip",
        "confidence": round(confidence, 2),
        "needs_confirmation": confidence < 0.7,
        "candidates": [],
        "resolution_source": "backend_text_extraction",
        "map_resolution_status": "pending_backend_geocoder",
    }
