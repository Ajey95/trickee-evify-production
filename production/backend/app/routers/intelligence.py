from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChargingDecisionRecord, DriverBehaviorSnapshot, NudgeEvent, OrderAssignmentDecision, User, WaitEvent
from app.schemas.api import ok
from app.services.access import assert_driver_access
from app.services.auth import get_current_user, require_roles
from app.services.charging_decision_engine import choose_charging_option
from app.services.driver_behavior import compute_driver_behavior
from app.services.external_context import external_context
from app.services.intelligence_history import persist_charging_decision, persist_order_assignment
from app.services.order_assignment_engine import assign_order
from app.services.serializers import (
    charging_decision_record_dict,
    driver_behavior_snapshot_dict,
    nudge_event_dict,
    order_assignment_decision_dict,
    wait_event_dict,
)
from app.services.wait_time_estimator import estimate_wait_window

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class Location(BaseModel):
    lat: float
    lng: float


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
    _: User = Depends(get_current_user),
):
    result = choose_charging_option(payload.driver, payload.order)
    record = persist_charging_decision(db, driver=payload.driver, order=payload.order, result=result)
    db.commit()
    return ok({**result, "decision_record_id": record.id})


@router.get("/history/driver-behavior")
def driver_behavior_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    rows = db.query(DriverBehaviorSnapshot).order_by(DriverBehaviorSnapshot.computed_at.desc()).limit(limit).all()
    return ok([driver_behavior_snapshot_dict(row) for row in rows])


@router.get("/history/nudges")
def nudge_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    rows = db.query(NudgeEvent).order_by(NudgeEvent.created_at.desc()).limit(limit).all()
    return ok([nudge_event_dict(row) for row in rows])


@router.get("/history/order-assignments")
def order_assignment_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    rows = db.query(OrderAssignmentDecision).order_by(OrderAssignmentDecision.created_at.desc()).limit(limit).all()
    return ok([order_assignment_decision_dict(row) for row in rows])


@router.get("/history/charging-decisions")
def charging_decision_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    rows = db.query(ChargingDecisionRecord).order_by(ChargingDecisionRecord.created_at.desc()).limit(limit).all()
    return ok([charging_decision_record_dict(row) for row in rows])


@router.get("/history/waits")
def wait_event_history(
    limit: int = 50,
    wait_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(WaitEvent)
    if wait_type:
        query = query.filter(WaitEvent.wait_type == wait_type)
    rows = query.order_by(WaitEvent.started_at.desc()).limit(limit).all()
    return ok([wait_event_dict(row) for row in rows])
