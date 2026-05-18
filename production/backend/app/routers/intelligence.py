from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import ChargingDecisionRecord, Driver, DriverBehaviorSnapshot, NudgeEvent, OrderAssignmentDecision, Prediction, Telemetry, User, Vehicle, WaitEvent
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.auth import get_current_user, require_roles
from app.services.rate_limit import check_rate_limit
from app.services.charging_decision_engine import choose_charging_option
from app.services.daily_impact_report import build_daily_impact_report
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


async def _limit_intelligence(request: Request, user: User, namespace: str) -> None:
    await check_rate_limit(
        request=request,
        namespace=namespace,
        limit=get_settings().intelligence_rate_limit_per_minute,
        subject=f"user:{user.id}",
    )


def _scoped_assignment_drivers(db: Session, user: User, drivers: list[AssignmentDriver]) -> list[dict[str, Any]]:
    scoped: list[dict[str, Any]] = []
    for driver_payload in drivers:
        assert_driver_access(db, user, driver_payload.driver_id)
        if driver_payload.vehicle_id:
            assert_vehicle_access(db, user, driver_payload.vehicle_id)
        scoped.append(driver_payload.to_engine_payload())
    return scoped


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    origin: Location
    destination: Location | None = None


class WaitTimeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_location: Location
    restaurant_location: Location
    prep_min: float = Field(ge=0, le=180)
    handover_buffer_min: float = Field(default=2.0, ge=0, le=30)
    current_speed_kmph: float | None = Field(default=None, ge=0, le=140)
    ignition_on: bool | None = None
    charge_plug: bool | None = None
    current_stop_duration_min: float = Field(default=0.0, ge=0, le=720)


class AssignmentDriver(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    driver_code: str | None = Field(default=None, max_length=64)
    vehicle_id: str | None = Field(default=None, max_length=64)
    soc: float = Field(default=0.0, ge=0, le=100)
    current_range_km: float | None = Field(default=None, ge=0, le=500)
    available_range_km: float | None = Field(default=None, ge=0, le=500)
    efficiency_score: float = Field(default=0.5, ge=0, le=1)
    distance_to_restaurant_km: float = Field(default=0.0, ge=0, le=100)
    current_location: Location | None = None
    archetype: dict[str, Any] | None = None

    def to_engine_payload(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        data["current_range_km"] = float(self.current_range_km if self.current_range_km is not None else self.available_range_km or 0.0)
        return data


class AssignmentOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str | None = Field(default=None, max_length=100)
    restaurant_wait_min: float = Field(default=0.0, ge=0, le=180)
    delivery_distance_km: float = Field(default=0.0, ge=0, le=200)
    required_range_km: float | None = Field(default=None, ge=0, le=500)
    pickup_location: Location | None = None
    drop_location: Location | None = None
    restaurant_location: Location | None = None
    customer_location: Location | None = None

    def to_engine_payload(self) -> dict[str, Any]:
        data = self.model_dump(exclude_none=True)
        if self.pickup_location and "restaurant_location" not in data:
            data["restaurant_location"] = self.pickup_location.model_dump()
        if self.drop_location and "customer_location" not in data:
            data["customer_location"] = self.drop_location.model_dump()
        return data


class OrderAssignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available_drivers: list[AssignmentDriver] = Field(min_length=1, max_length=100)
    order: AssignmentOrder


class ChargingDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver: AssignmentDriver
    order: AssignmentOrder

    def engine_payloads(self) -> tuple[dict[str, Any], dict[str, Any]]:
        driver = self.driver.to_engine_payload()
        if self.driver.current_location:
            driver["location"] = self.driver.current_location.model_dump()
        order = self.order.to_engine_payload()
        if "restaurant_location" not in order:
            raise ValueError("restaurant_location or pickup_location is required")
        return driver, order


class LiveDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

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
async def driver_live_decision_post(
    driver_id: str,
    payload: LiveDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _limit_intelligence(request, current_user, "live-decision")
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
async def weekly_report(
    request: Request,
    days: int = Query(default=7, ge=1, le=31),
    send_email: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    await _limit_intelligence(request, current_user, "weekly-report")
    metrics = weekly_live_metrics(db, current_user, days=days)
    report = generate_weekly_report(metrics)
    delivery = send_weekly_report_email(metrics, report) if send_email else {"email_status": "not_requested"}
    return ok({**metrics, "report": report, "delivery": delivery})


def _bucket_label(recorded_at, days: int) -> str:
    if days <= 2:
        return recorded_at.strftime("%d %b %H:00")
    return recorded_at.strftime("%d %b")


def _average(values: list[float]) -> float:
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 2) if values else 0.0


@router.get("/reports/charts")
async def report_charts(
    request: Request,
    days: int = Query(default=7, ge=1, le=31),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    await _limit_intelligence(request, current_user, "report-charts")
    days = min(max(days, 1), 31)
    since = datetime.utcnow() - timedelta(days=days)
    driver_ids = _scoped_driver_ids(db, current_user)
    vehicle_ids = _scoped_vehicle_ids(db, current_user)

    telemetry_query = db.query(Telemetry).filter(Telemetry.recorded_at >= since)
    if driver_ids is not None:
        telemetry_query = telemetry_query.filter(Telemetry.driver_id.in_(driver_ids))
    if vehicle_ids is not None:
        telemetry_query = telemetry_query.filter(Telemetry.vehicle_id.in_(vehicle_ids))

    telemetry_rows = telemetry_query.order_by(Telemetry.recorded_at.asc()).limit(5000).all()
    buckets: dict[str, dict[str, Any]] = {}
    for row in telemetry_rows:
        label = _bucket_label(row.recorded_at, days)
        bucket = buckets.setdefault(label, {"time": label, "soc": [], "speed": [], "temperature": [], "energy": [], "low_soc": 0, "samples": 0})
        bucket["soc"].append(float(row.soc))
        bucket["speed"].append(float(row.speed))
        bucket["temperature"].append(float(row.temp_max))
        bucket["energy"].append(abs(float(row.power or 0.0)) / 1000.0)
        bucket["low_soc"] += 1 if row.soc < 20 else 0
        bucket["samples"] += 1

    telemetry_series = [
        {
            "time": bucket["time"],
            "avg_soc": _average(bucket["soc"]),
            "avg_speed": _average(bucket["speed"]),
            "avg_temperature": _average(bucket["temperature"]),
            "energy_kw": _average(bucket["energy"]),
            "low_soc_events": bucket["low_soc"],
            "samples": bucket["samples"],
        }
        for bucket in buckets.values()
    ]

    scatter_step = max(1, len(telemetry_rows) // 160)
    speed_energy = [
        {
            "speed": round(float(row.speed), 1),
            "energy_kw": round(abs(float(row.power or 0.0)) / 1000.0, 3),
            "soc": round(float(row.soc), 1),
        }
        for row in telemetry_rows[::scatter_step]
    ]

    prediction_query = db.query(Prediction).filter(Prediction.predicted_at >= since)
    if driver_ids is not None:
        prediction_query = prediction_query.filter(Prediction.driver_id.in_(driver_ids))
    if vehicle_ids is not None:
        prediction_query = prediction_query.filter(Prediction.vehicle_id.in_(vehicle_ids))
    prediction_rows = prediction_query.order_by(Prediction.predicted_at.asc()).limit(1000).all()
    prediction_step = max(1, len(prediction_rows) // 180)
    range_accuracy = [
        {
            "time": row.predicted_at.strftime("%d %b %H:%M"),
            "actual_soc": round(float(row.actual_soc), 2),
            "predicted_soc": round(float(row.predicted_next_soc), 2),
            "true_next_soc": round(float(row.true_next_soc), 2) if row.true_next_soc is not None else None,
            "error": round(abs(float(row.ai_error)), 3) if row.ai_error is not None else None,
            "range_km": round(float(row.predicted_range_km), 2),
        }
        for row in prediction_rows[::prediction_step]
    ]

    waits_query = db.query(WaitEvent).filter(WaitEvent.started_at >= since)
    if driver_ids is not None:
        waits_query = waits_query.filter(WaitEvent.driver_id.in_(driver_ids))
    wait_counts: dict[str, int] = {}
    for row in waits_query.limit(1000).all():
        wait_counts[row.wait_type] = wait_counts.get(row.wait_type, 0) + 1

    charging_query = db.query(ChargingDecisionRecord).filter(ChargingDecisionRecord.created_at >= since)
    if vehicle_ids is not None:
        charging_query = charging_query.filter((ChargingDecisionRecord.vehicle_id.is_(None)) | (ChargingDecisionRecord.vehicle_id.in_(vehicle_ids)))
    charging_counts: dict[str, int] = {}
    for row in charging_query.limit(1000).all():
        charging_counts[row.chosen_option] = charging_counts.get(row.chosen_option, 0) + 1

    latest = telemetry_rows[-1] if telemetry_rows else None
    return ok(
        {
            "generated_at": datetime.utcnow().isoformat(),
            "period": {"days": days, "since": since.isoformat()},
            "summary": {
                "telemetry_rows": len(telemetry_rows),
                "prediction_rows": len(prediction_rows),
                "avg_soc": _average([float(row.soc) for row in telemetry_rows]),
                "avg_speed": _average([float(row.speed) for row in telemetry_rows]),
                "low_soc_events": sum(1 for row in telemetry_rows if row.soc < 20),
                "latest_soc": round(float(latest.soc), 2) if latest else None,
            },
            "telemetry_series": telemetry_series,
            "speed_energy": speed_energy,
            "range_accuracy": range_accuracy,
            "wait_type_counts": [{"name": key.replace("_", " ").title(), "value": value} for key, value in sorted(wait_counts.items())],
            "charging_decisions": [{"name": key.replace("_", " ").title(), "value": value} for key, value in sorted(charging_counts.items())],
        }
    )


@router.get("/reports/daily-impact")
async def daily_impact_report(
    request: Request,
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _limit_intelligence(request, current_user, "daily-impact")
    return ok(build_daily_impact_report(db, current_user, report_date=report_date))


@router.post("/context")
async def route_context(payload: ContextRequest, request: Request, current_user: User = Depends(get_current_user)):
    await _limit_intelligence(request, current_user, "route-context")
    destination = payload.destination.model_dump() if payload.destination else None
    return ok(external_context.route_context(payload.origin.model_dump(), destination))


@router.post("/wait-time")
async def wait_time(payload: WaitTimeRequest, request: Request, current_user: User = Depends(get_current_user)):
    await _limit_intelligence(request, current_user, "wait-time")
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
async def assign_delivery_order(
    payload: OrderAssignmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    await _limit_intelligence(request, current_user, "order-assignment")
    available_drivers = _scoped_assignment_drivers(db, current_user, payload.available_drivers)
    order_payload = payload.order.to_engine_payload()
    result = assign_order(available_drivers, order_payload)
    record = persist_order_assignment(
        db,
        user=current_user,
        available_drivers=available_drivers,
        order=order_payload,
        result=result,
    )
    db.commit()
    assigned = result.get("assigned_driver") or {}
    return ok(
        {
            **result,
            "assigned_driver_id": assigned.get("driver_id"),
            "assignment_score": assigned.get("assignment_score"),
            "strategy": assigned.get("strategy") or result.get("reason"),
            "decision_record_id": record.id,
        }
    )


@router.post("/charging/decision")
async def charging_decision(
    payload: ChargingDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _limit_intelligence(request, current_user, "charging-decision")
    try:
        driver_payload, order_payload = payload.engine_payloads()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    driver_id = driver_payload.get("driver_id")
    vehicle_id = driver_payload.get("vehicle_id")
    if driver_id:
        assert_driver_access(db, current_user, str(driver_id))
    if vehicle_id:
        assert_vehicle_access(db, current_user, str(vehicle_id))
    result = choose_charging_option(driver_payload, order_payload)
    record = persist_charging_decision(db, driver=driver_payload, order=order_payload, result=result)
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
