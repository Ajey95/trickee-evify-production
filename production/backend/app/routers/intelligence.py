from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChargingDecisionRecord, Driver, DriverBehaviorSnapshot, NudgeEvent, OrderAssignmentDecision, User, Vehicle, WaitEvent
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.auth import get_current_user, require_roles
from app.services.charging_decision_engine import choose_charging_option
from app.services.driver_behavior import compute_driver_behavior
from app.services.external_context import external_context
from app.services.intelligence_history import persist_charging_decision, persist_order_assignment
from app.services.live_intelligence import fleet_live_overview, live_driver_decision, live_map_context, weekly_live_metrics
from app.services.live_driver_profile import live_driver_profile
from app.services.order_assignment_engine import assign_order
from app.services.serializers import (
    charging_decision_record_dict,
    driver_behavior_snapshot_dict,
    nudge_event_dict,
    order_assignment_decision_dict,
    wait_event_dict,
)
from app.services.wait_time_estimator import estimate_wait_window
from app.services.weekly_report import generate_weekly_report, send_weekly_report_email

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _scoped_driver_ids(db: Session, user: User) -> list[str] | None:
    if user.role == "trickee_admin":
        return None
    if user.role == "fleet_operator":
        return [row[0] for row in db.query(Driver.id).filter(Driver.fleet_id == user.fleet_id).all()]
    if user.role == "driver" and user.driver_id:
        return [user.driver_id]
    return []


def _scoped_vehicle_ids(db: Session, user: User) -> list[str] | None:
    if user.role == "trickee_admin":
        return None
    if user.role == "fleet_operator":
        return [row[0] for row in db.query(Vehicle.id).filter(Vehicle.fleet_id == user.fleet_id).all()]
    return None


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ContextRequest(BaseModel):
    origin: Location
    destination: Location | None = None


class WaitTimeRequest(BaseModel):
    driver_location: Location
    restaurant_location: Location
    prep_min: float = Field(ge=0)
    handover_buffer_min: float = Field(default=2.0, ge=0)
    current_speed_kmph: float | None = Field(default=None, ge=0)
    ignition_on: bool | None = None
    charge_plug: bool | None = None
    current_stop_duration_min: float = Field(default=0.0, ge=0)


class OrderAssignmentRequest(BaseModel):
    available_drivers: list[dict[str, Any]]
    order: dict[str, Any]


class ChargingDecisionRequest(BaseModel):
    driver: dict[str, Any]
    order: dict[str, Any]


class LiveDecisionRequest(BaseModel):
    destination: Location | None = None
    order_context: dict[str, Any] | None = None
    persist_nudge: bool = False


@router.get("/drivers/{driver_id}/behavior")
def driver_behavior(
    driver_id: str,
    window_minutes: int = 30,
    persist: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    return ok(compute_driver_behavior(db, driver, window_minutes=window_minutes, persist=persist))


@router.get("/drivers/{driver_id}/live-profile")
def driver_live_profile(
    driver_id: str,
    window_minutes: int = Query(default=7 * 24 * 60, ge=30, le=31 * 24 * 60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    return ok(live_driver_profile(db, driver, window_minutes=window_minutes))


@router.get("/drivers/{driver_id}/live-decision")
def driver_live_decision_get(
    driver_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    return ok(live_driver_decision(db, driver))


@router.post("/drivers/{driver_id}/live-decision")
def driver_live_decision_post(
    driver_id: str,
    payload: LiveDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    return ok(
        live_driver_decision(
            db,
            driver,
            destination=payload.destination.model_dump() if payload.destination else None,
            order_context=payload.order_context,
            persist_nudge=payload.persist_nudge,
        )
    )


@router.get("/fleet/live")
def fleet_live(
    window_minutes: int = Query(default=7 * 24 * 60, ge=30, le=31 * 24 * 60),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    return ok(fleet_live_overview(db, current_user, window_minutes=window_minutes))


@router.get("/live-map")
def live_map(
    driver_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ok(live_map_context(db, current_user, driver_id=driver_id))


@router.get("/reports/weekly")
def weekly_report(
    days: int = Query(default=7, ge=1, le=31),
    send_email: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    metrics = weekly_live_metrics(db, current_user, days=days)
    report = generate_weekly_report(metrics)
    delivery = send_weekly_report_email(metrics, report) if send_email else {"email_status": "not_requested"}
    return ok({**metrics, "report": report, "delivery": delivery})


@router.post("/context")
def route_context(payload: ContextRequest, _: User = Depends(get_current_user)):
    destination = payload.destination.model_dump() if payload.destination else None
    return ok(external_context.route_context(payload.origin.model_dump(), destination))


@router.post("/wait-time")
def wait_time(payload: WaitTimeRequest, _: User = Depends(get_current_user)):
    return ok(
        estimate_wait_window(
            payload.driver_location.model_dump(),
            payload.restaurant_location.model_dump(),
            payload.prep_min,
            payload.handover_buffer_min,
            current_speed_kmph=payload.current_speed_kmph,
            ignition_on=payload.ignition_on,
            charge_plug=payload.charge_plug,
            current_stop_duration_min=payload.current_stop_duration_min,
        )
    )


@router.post("/orders/assign")
def assign_delivery_order(
    payload: OrderAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    result = assign_order(payload.available_drivers, payload.order)
    record = persist_order_assignment(
        db,
        user=current_user,
        available_drivers=payload.available_drivers,
        order=payload.order,
        result=result,
    )
    db.commit()
    return ok({**result, "decision_record_id": record.id})


@router.post("/charging/decision")
def charging_decision(
    payload: ChargingDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver_id = payload.driver.get("driver_id") or payload.driver.get("id")
    vehicle_id = payload.driver.get("vehicle_id")
    if driver_id:
        assert_driver_access(db, current_user, str(driver_id))
    if vehicle_id:
        assert_vehicle_access(db, current_user, str(vehicle_id))
    result = choose_charging_option(payload.driver, payload.order)
    record = persist_charging_decision(db, driver=payload.driver, order=payload.order, result=result)
    db.commit()
    return ok({**result, "decision_record_id": record.id})


@router.get("/history/driver-behavior")
def driver_behavior_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(DriverBehaviorSnapshot)
    scoped_driver_ids = _scoped_driver_ids(db, current_user)
    if scoped_driver_ids is not None:
        query = query.filter(DriverBehaviorSnapshot.driver_id.in_(scoped_driver_ids))
    rows = query.order_by(DriverBehaviorSnapshot.computed_at.desc()).limit(min(limit, 200)).all()
    return ok([driver_behavior_snapshot_dict(row) for row in rows])


@router.get("/history/nudges")
def nudge_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(NudgeEvent)
    scoped_driver_ids = _scoped_driver_ids(db, current_user)
    scoped_vehicle_ids = _scoped_vehicle_ids(db, current_user)
    if scoped_driver_ids is not None:
        query = query.filter(NudgeEvent.driver_id.in_(scoped_driver_ids))
    if scoped_vehicle_ids is not None:
        query = query.filter((NudgeEvent.vehicle_id.is_(None)) | (NudgeEvent.vehicle_id.in_(scoped_vehicle_ids)))
    rows = query.order_by(NudgeEvent.created_at.desc()).limit(min(limit, 200)).all()
    return ok([nudge_event_dict(row) for row in rows])


@router.get("/history/order-assignments")
def order_assignment_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(OrderAssignmentDecision)
    if current_user.role == "fleet_operator":
        query = query.filter(OrderAssignmentDecision.fleet_id == current_user.fleet_id)
    rows = query.order_by(OrderAssignmentDecision.created_at.desc()).limit(min(limit, 200)).all()
    return ok([order_assignment_decision_dict(row) for row in rows])


@router.get("/history/charging-decisions")
def charging_decision_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(ChargingDecisionRecord)
    scoped_vehicle_ids = _scoped_vehicle_ids(db, current_user)
    if scoped_vehicle_ids is not None:
        query = query.filter((ChargingDecisionRecord.vehicle_id.is_(None)) | (ChargingDecisionRecord.vehicle_id.in_(scoped_vehicle_ids)))
    rows = query.order_by(ChargingDecisionRecord.created_at.desc()).limit(min(limit, 200)).all()
    return ok([charging_decision_record_dict(row) for row in rows])


@router.get("/history/waits")
def wait_event_history(
    limit: int = 50,
    wait_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(WaitEvent)
    scoped_driver_ids = _scoped_driver_ids(db, current_user)
    if scoped_driver_ids is not None:
        query = query.filter(WaitEvent.driver_id.in_(scoped_driver_ids))
    if wait_type:
        query = query.filter(WaitEvent.wait_type == wait_type)
    rows = query.order_by(WaitEvent.started_at.desc()).limit(min(limit, 200)).all()
    return ok([wait_event_dict(row) for row in rows])
