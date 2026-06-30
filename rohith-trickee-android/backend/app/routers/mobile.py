from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import (
    Alert,
    MobileChargingSession,
    MobileIssueEvent,
    MobileLocationPoint,
    MobileTripSession,
    MobileWaitEvent,
    NudgeEvent,
    Telemetry,
    User,
)
from app.schemas.api import ok
from app.services.auth import get_current_user
from app.services.live_state import store_live_vehicle_point
from app.services.mobile import (
    active_charging_for_driver,
    active_trip_for_driver,
    active_wait_for_driver,
    close_duration_seconds,
    existing_by_idempotency,
    latest_vehicle_for_driver,
    require_mobile_driver,
    resolve_destination_text,
    resolve_mobile_vehicle,
)
from app.services.rate_limit import check_rate_limit
from app.services.serializers import (
    alert_dict,
    driver_dict,
    mobile_charging_session_dict,
    mobile_issue_event_dict,
    mobile_location_point_dict,
    mobile_trip_session_dict,
    mobile_wait_event_dict,
    telemetry_dict,
    user_dict,
    vehicle_dict,
)

router = APIRouter(prefix="/mobile", tags=["mobile"])


class MobileLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class LocationPingRequest(MobileLocation):
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    accuracy_m: float | None = Field(default=None, ge=0, le=5000)
    speed_mps: float | None = Field(default=None, ge=0, le=90)
    heading_deg: float | None = Field(default=None, ge=0, le=360)
    battery_pct: float | None = Field(default=None, ge=0, le=100)
    tracking_state: Literal["ready", "trip_active", "waiting", "charging", "emergency"] = "ready"
    vehicle_id: str | None = Field(default=None, max_length=36)
    idempotency_key: str | None = Field(default=None, max_length=80)


class VoiceResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transcript: str = Field(min_length=1, max_length=255)
    current_location: MobileLocation | None = None


class TripStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_text: str | None = Field(default=None, max_length=255)
    destination_place_id: str | None = Field(default=None, max_length=255)
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)
    origin: MobileLocation | None = None
    vehicle_id: str | None = Field(default=None, max_length=36)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    confidence: float = Field(default=0.5, ge=0, le=1)
    idempotency_key: str | None = Field(default=None, max_length=80)


class TripEndRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trip_session_id: str | None = Field(default=None, max_length=36)
    location: MobileLocation | None = None
    ended_at: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: str | None = Field(default=None, max_length=80)


class ChargingStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trip_session_id: str | None = Field(default=None, max_length=36)
    location: MobileLocation | None = None
    vehicle_id: str | None = Field(default=None, max_length=36)
    charger_name: str | None = Field(default=None, max_length=255)
    charger_place_id: str | None = Field(default=None, max_length=255)
    soc_start: float | None = Field(default=None, ge=0, le=100)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: str | None = Field(default=None, max_length=80)


class ChargingEndRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    charging_session_id: str | None = Field(default=None, max_length=36)
    soc_end: float | None = Field(default=None, ge=0, le=100)
    ended_at: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: str | None = Field(default=None, max_length=80)


class WaitingStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trip_session_id: str | None = Field(default=None, max_length=36)
    location: MobileLocation | None = None
    vehicle_id: str | None = Field(default=None, max_length=36)
    wait_type: str = Field(default="unknown", max_length=50)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: str | None = Field(default=None, max_length=80)


class WaitingEndRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wait_event_id: str | None = Field(default=None, max_length=36)
    ended_at: datetime = Field(default_factory=datetime.utcnow)
    idempotency_key: str | None = Field(default=None, max_length=80)


class IssueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trip_session_id: str | None = Field(default=None, max_length=36)
    issue_type: Literal[
        "low_battery",
        "breakdown",
        "puncture",
        "charger_not_working",
        "unsafe_route",
        "accident",
        "need_help",
    ]
    message: str | None = Field(default=None, max_length=500)
    location: MobileLocation | None = None
    vehicle_id: str | None = Field(default=None, max_length=36)
    idempotency_key: str | None = Field(default=None, max_length=80)


async def _limit_mobile(request: Request, user: User, namespace: str) -> None:
    await check_rate_limit(
        request=request,
        namespace=namespace,
        limit=get_settings().telemetry_rate_limit_per_minute,
        subject=f"user:{user.id}",
    )


def _latest_telemetry(db: Session, driver_id: str) -> Telemetry | None:
    return (
        db.query(Telemetry)
        .filter(Telemetry.driver_id == driver_id)
        .order_by(desc(Telemetry.recorded_at))
        .first()
    )


@router.get("/me")
def mobile_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    driver = require_mobile_driver(db, current_user)
    vehicle, latest = latest_vehicle_for_driver(db, driver.id)
    active_trip = active_trip_for_driver(db, driver.id)
    active_wait = active_wait_for_driver(db, driver.id)
    active_charging = active_charging_for_driver(db, driver.id)
    return ok(
        {
            "user": user_dict(current_user),
            "driver": driver_dict(driver),
            "vehicle": vehicle_dict(vehicle, latest) if vehicle else None,
            "latest_telemetry": telemetry_dict(latest) if latest else None,
            "approval": {"approved": True, "requires_driver_mapping": False},
            "active_trip": mobile_trip_session_dict(active_trip) if active_trip else None,
            "active_waiting": mobile_wait_event_dict(active_wait) if active_wait else None,
            "active_charging": mobile_charging_session_dict(active_charging) if active_charging else None,
        }
    )


@router.post("/location")
async def record_location(
    payload: LocationPingRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-location")
    existing = existing_by_idempotency(db, MobileLocationPoint, payload.idempotency_key)
    if existing:
        return ok(mobile_location_point_dict(existing), "Location already recorded")
    vehicle = resolve_mobile_vehicle(db, driver.id, payload.vehicle_id)
    row = MobileLocationPoint(
        user_id=current_user.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id if vehicle else None,
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        speed_mps=payload.speed_mps,
        heading_deg=payload.heading_deg,
        battery_pct=payload.battery_pct,
        tracking_state=payload.tracking_state,
        source="android_app",
        idempotency_key=payload.idempotency_key,
        captured_at=payload.captured_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    await store_live_vehicle_point(
        {
            "driver_id": driver.id,
            "driver_code": driver.driver_code,
            "vehicle_id": row.vehicle_id,
            "fleet_id": driver.fleet_id,
            "lat": row.lat,
            "lng": row.lng,
            "soc": row.battery_pct,
            "speed": row.speed_mps,
            "recorded_at": row.captured_at.isoformat(),
            "source": row.source,
            "tracking_state": row.tracking_state,
            "accuracy_m": row.accuracy_m,
        }
    )
    return ok(mobile_location_point_dict(row), "Mobile location recorded")


@router.post("/voice/resolve-destination")
async def resolve_voice_destination(
    payload: VoiceResolveRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-voice-resolve")
    result = resolve_destination_text(payload.transcript)
    if payload.current_location:
        result["current_location"] = payload.current_location.model_dump()
    return ok(result)


@router.post("/trips/start")
async def start_trip(
    payload: TripStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-trip-start")
    existing = existing_by_idempotency(db, MobileTripSession, payload.idempotency_key)
    if existing:
        return ok(mobile_trip_session_dict(existing), "Trip already started")
    vehicle = resolve_mobile_vehicle(db, driver.id, payload.vehicle_id)
    destination = resolve_destination_text(payload.destination_text) if payload.destination_text else None
    row = MobileTripSession(
        user_id=current_user.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id if vehicle else None,
        started_at=payload.started_at,
        origin_lat=payload.origin.lat if payload.origin else None,
        origin_lng=payload.origin.lng if payload.origin else None,
        destination_text=destination["destination_text"] if destination else None,
        destination_place_id=payload.destination_place_id,
        destination_lat=payload.destination_lat,
        destination_lng=payload.destination_lng,
        status="active",
        confidence=max(payload.confidence, destination["confidence"] if destination else 0.0),
        source="action_button",
        idempotency_key=payload.idempotency_key,
        context={"voice_resolution": destination} if destination else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok(mobile_trip_session_dict(row), "Trip started")


@router.post("/trips/end")
async def end_trip(
    payload: TripEndRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-trip-end")
    trip = active_trip_for_driver(db, driver.id, payload.trip_session_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active trip session")
    trip.ended_at = payload.ended_at
    trip.status = "completed"
    trip.updated_at = datetime.utcnow()
    context: dict[str, Any] = dict(trip.context or {})
    if payload.location:
        context["ended_location"] = payload.location.model_dump()
    trip.context = context
    db.commit()
    db.refresh(trip)
    return ok(mobile_trip_session_dict(trip), "Trip ended")


@router.post("/charging/start")
async def start_charging(
    payload: ChargingStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-charging-start")
    existing = existing_by_idempotency(db, MobileChargingSession, payload.idempotency_key)
    if existing:
        return ok(mobile_charging_session_dict(existing), "Charging already started")
    trip = active_trip_for_driver(db, driver.id, payload.trip_session_id)
    vehicle = resolve_mobile_vehicle(db, driver.id, payload.vehicle_id or (trip.vehicle_id if trip else None))
    row = MobileChargingSession(
        trip_session_id=trip.id if trip else None,
        user_id=current_user.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id if vehicle else None,
        started_at=payload.started_at,
        lat=payload.location.lat if payload.location else None,
        lng=payload.location.lng if payload.location else None,
        charger_name=payload.charger_name,
        charger_place_id=payload.charger_place_id,
        soc_start=payload.soc_start,
        confidence=0.75 if payload.location else 0.55,
        idempotency_key=payload.idempotency_key,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok(mobile_charging_session_dict(row), "Charging started")


@router.post("/charging/end")
async def end_charging(
    payload: ChargingEndRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-charging-end")
    row = active_charging_for_driver(db, driver.id, payload.charging_session_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active charging session")
    row.ended_at = payload.ended_at
    row.soc_end = payload.soc_end
    row.duration_seconds = close_duration_seconds(row.started_at, payload.ended_at)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return ok(mobile_charging_session_dict(row), "Charging ended")


@router.post("/waiting/start")
async def start_waiting(
    payload: WaitingStartRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-waiting-start")
    existing = existing_by_idempotency(db, MobileWaitEvent, payload.idempotency_key)
    if existing:
        return ok(mobile_wait_event_dict(existing), "Waiting already started")
    trip = active_trip_for_driver(db, driver.id, payload.trip_session_id)
    vehicle = resolve_mobile_vehicle(db, driver.id, payload.vehicle_id or (trip.vehicle_id if trip else None))
    row = MobileWaitEvent(
        trip_session_id=trip.id if trip else None,
        user_id=current_user.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id if vehicle else None,
        started_at=payload.started_at,
        lat=payload.location.lat if payload.location else None,
        lng=payload.location.lng if payload.location else None,
        wait_type=payload.wait_type,
        confidence=0.75 if payload.location else 0.55,
        idempotency_key=payload.idempotency_key,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok(mobile_wait_event_dict(row), "Waiting started")


@router.post("/waiting/end")
async def end_waiting(
    payload: WaitingEndRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-waiting-end")
    row = active_wait_for_driver(db, driver.id, payload.wait_event_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active waiting event")
    row.ended_at = payload.ended_at
    row.duration_seconds = close_duration_seconds(row.started_at, payload.ended_at)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return ok(mobile_wait_event_dict(row), "Waiting ended")


@router.post("/issues")
async def create_issue(
    payload: IssueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    await _limit_mobile(request, current_user, "mobile-issue")
    existing = existing_by_idempotency(db, MobileIssueEvent, payload.idempotency_key)
    if existing:
        return ok(mobile_issue_event_dict(existing), "Issue already recorded")
    trip = active_trip_for_driver(db, driver.id, payload.trip_session_id)
    vehicle = resolve_mobile_vehicle(db, driver.id, payload.vehicle_id or (trip.vehicle_id if trip else None))
    latest = _latest_telemetry(db, driver.id)
    row = MobileIssueEvent(
        trip_session_id=trip.id if trip else None,
        user_id=current_user.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id if vehicle else None,
        issue_type=payload.issue_type,
        message=payload.message,
        lat=payload.location.lat if payload.location else None,
        lng=payload.location.lng if payload.location else None,
        status="open",
        idempotency_key=payload.idempotency_key,
        context={"latest_telemetry": telemetry_dict(latest) if latest else None},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ok(mobile_issue_event_dict(row), "Issue recorded")


@router.get("/alerts")
def mobile_alerts(
    unresolved_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    query = db.query(Alert).filter(Alert.driver_id == driver.id)
    if unresolved_only:
        query = query.filter(Alert.is_resolved.is_(False))
    rows = query.order_by(desc(Alert.created_at)).limit(min(limit, 100)).all()
    return ok([alert_dict(row) for row in rows])


@router.post("/alerts/{alert_id}/ack")
def ack_mobile_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = require_mobile_driver(db, current_user)
    alert = db.get(Alert, alert_id)
    if not alert or alert.driver_id != driver.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.is_resolved = True
    db.add(
        NudgeEvent(
            driver_id=driver.id,
            vehicle_id=alert.vehicle_id,
            alert_id=alert.id,
            nudge_type="mobile_alert_ack",
            channel="mobile",
            message="Driver acknowledged mobile alert.",
            status="acknowledged",
            acknowledged_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(alert)
    return ok(alert_dict(alert), "Alert acknowledged")
