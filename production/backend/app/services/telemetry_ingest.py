from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, Fleet, Telemetry, User, Vehicle
from app.services.alert_service import maybe_create_charging_alert
from app.services.evify_adapter import normalize_evify_payload
from app.services.physics import compute_derived_fields
from app.services.trip_inference import update_inferred_trip
from app.services.wait_classifier import update_wait_event


def default_fleet_id(db: Session, user: User | None = None) -> str:
    if user and user.fleet_id:
        return user.fleet_id
    fleet = db.query(Fleet).order_by(Fleet.created_at).first()
    if not fleet:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fleet exists for telemetry ingest")
    return fleet.id


def _get_or_create_driver(db: Session, fleet_id: str, driver_code: str | None) -> Driver | None:
    if not driver_code:
        return None
    driver = db.query(Driver).filter(Driver.driver_code == str(driver_code)).first()
    if driver:
        return driver
    driver = Driver(
        fleet_id=fleet_id,
        driver_code=str(driver_code),
        full_name=f"Evify Driver {driver_code}",
        style_label="Moderate",
    )
    db.add(driver)
    db.flush()
    return driver


def ingest_evify_payload(
    db: Session,
    payload: dict[str, Any],
    *,
    user: User | None = None,
    commit: bool = True,
) -> tuple[Telemetry, Any | None]:
    normalized = normalize_evify_payload(payload)
    if not normalized["vehicle_code"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Evify vehicle registration")

    fleet_id = default_fleet_id(db, user)
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == normalized["vehicle_code"]).first()
    if not vehicle:
        vehicle = Vehicle(fleet_id=fleet_id, vehicle_code=normalized["vehicle_code"])
        db.add(vehicle)
        db.flush()
    if user and user.role == "fleet_operator" and vehicle.fleet_id != user.fleet_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vehicle belongs to another fleet")

    driver = _get_or_create_driver(db, vehicle.fleet_id, normalized.get("driver_code"))
    existing = (
        db.query(Telemetry)
        .filter(Telemetry.vehicle_id == vehicle.id, Telemetry.recorded_at == normalized["recorded_at"])
        .first()
    )
    if existing:
        return existing, None

    prev = (
        db.query(Telemetry)
        .filter(Telemetry.vehicle_id == vehicle.id)
        .order_by(desc(Telemetry.recorded_at))
        .first()
    )
    derived = compute_derived_fields(
        soc=normalized["soc"],
        battery_voltage=normalized["battery_voltage"],
        current=normalized["current"],
        temp_max=normalized["temp_max"],
        prev_temp_max=prev.temp_max if prev else None,
        cycle_count=normalized["cycle_count"],
        soh=normalized["soh"],
        recorded_at=normalized["recorded_at"],
    )
    row = Telemetry(
        vehicle_id=vehicle.id,
        driver_id=driver.id if driver else None,
        **{k: v for k, v in normalized.items() if k not in {"vehicle_code", "driver_code"}},
        **derived,
    )
    db.add(row)
    db.flush()
    update_inferred_trip(db, row)
    update_wait_event(db, row)

    alert = maybe_create_charging_alert(db, row)
    if commit:
        db.commit()
        db.refresh(row)
        if alert:
            db.refresh(alert)
    return row, alert
