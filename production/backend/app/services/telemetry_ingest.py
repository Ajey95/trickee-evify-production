from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, tuple_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Driver, Fleet, Telemetry, User, Vehicle
from app.services.alert_service import maybe_create_charging_alert, maybe_create_driver_risk_alert
from app.services.evify_adapter import normalize_evify_payload
from app.services.live_driver_profile import record_soc_rise_charging_event
from app.services.physics import compute_derived_fields
from app.services.trip_inference import update_inferred_trip, update_inferred_trips_for_rows
from app.services.wait_classifier import update_wait_event
from app.services.ws_manager import manager


def live_vehicle_point(row: Telemetry, vehicle: Vehicle, driver: Driver | None) -> dict[str, Any] | None:
    if row.lat is None or row.lng is None or row.lat == 0 or row.lng == 0:
        return None
    if not row.driver_id or not driver:
        return None
    return {
        "driver_id": row.driver_id,
        "driver_code": driver.driver_code,
        "vehicle_id": row.vehicle_id,
        "fleet_id": vehicle.fleet_id,
        "lat": row.lat,
        "lng": row.lng,
        "soc": row.soc,
        "speed": row.speed,
        "recorded_at": row.recorded_at.isoformat(),
    }


def default_fleet_id(db: Session, user: User | None = None) -> str:
    if user and user.fleet_id:
        return user.fleet_id
    fleet = db.query(Fleet).order_by(Fleet.created_at).first()
    if not fleet:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fleet exists for telemetry ingest")
    return fleet.id


def _get_or_create_driver(db: Session, fleet_id: str, driver_code: str | None, *, vehicle_proxy: bool = False) -> Driver | None:
    if not driver_code:
        return None
    driver = db.query(Driver).filter(Driver.driver_code == str(driver_code)).first()
    if driver:
        return driver
    driver = Driver(
        fleet_id=fleet_id,
        driver_code=str(driver_code),
        full_name=f"Vehicle Profile {driver_code}" if vehicle_proxy else f"Evify Driver {driver_code}",
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

    driver_code = normalized.get("driver_code") or normalized["vehicle_code"]
    driver = _get_or_create_driver(db, vehicle.fleet_id, driver_code, vehicle_proxy=not bool(normalized.get("driver_code")))
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
    if commit:
        record_soc_rise_charging_event(db, row, prev)

    alert = maybe_create_charging_alert(db, row) or maybe_create_driver_risk_alert(db, row)
    if commit:
        db.commit()
        db.refresh(row)
        if alert:
            db.refresh(alert)
        point = live_vehicle_point(row, vehicle, driver)
        if point:
            manager.schedule_vehicle_point_publish(point, get_settings().redis_url)
    return row, alert


def ingest_evify_payloads_bulk(
    db: Session,
    payloads: list[dict[str, Any]],
    *,
    user: User | None = None,
) -> list[Telemetry]:
    normalized_rows = [normalize_evify_payload(payload) for payload in payloads]
    missing_vehicle = next((row for row in normalized_rows if not row["vehicle_code"]), None)
    if missing_vehicle is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Evify vehicle registration")

    fleet_id = default_fleet_id(db, user)
    vehicle_codes = {str(row["vehicle_code"]) for row in normalized_rows}
    vehicles = {
        vehicle.vehicle_code: vehicle
        for vehicle in db.query(Vehicle).filter(Vehicle.vehicle_code.in_(vehicle_codes)).all()
    }
    for vehicle_code in sorted(vehicle_codes):
        if vehicle_code not in vehicles:
            vehicle = Vehicle(fleet_id=fleet_id, vehicle_code=vehicle_code)
            db.add(vehicle)
            db.flush()
            vehicles[vehicle_code] = vehicle
    if user and user.role == "fleet_operator":
        foreign = next((vehicle for vehicle in vehicles.values() if vehicle.fleet_id != user.fleet_id), None)
        if foreign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vehicle belongs to another fleet")

    driver_codes = {str(row.get("driver_code") or row["vehicle_code"]) for row in normalized_rows}
    drivers = {
        driver.driver_code: driver
        for driver in db.query(Driver).filter(Driver.driver_code.in_(driver_codes)).all()
    }
    for driver_code in sorted(driver_codes):
        if driver_code in drivers:
            continue
        vehicle_proxy = not any(str(row.get("driver_code") or "") == driver_code for row in normalized_rows)
        driver = Driver(
            fleet_id=fleet_id,
            driver_code=driver_code,
            full_name=f"Vehicle Profile {driver_code}" if vehicle_proxy else f"Evify Driver {driver_code}",
            style_label="Moderate",
        )
        db.add(driver)
        db.flush()
        drivers[driver_code] = driver

    vehicle_ids = [vehicle.id for vehicle in vehicles.values()]
    latest_subquery = (
        db.query(Telemetry.vehicle_id, func.max(Telemetry.recorded_at).label("recorded_at"))
        .filter(Telemetry.vehicle_id.in_(vehicle_ids))
        .group_by(Telemetry.vehicle_id)
        .subquery()
    )
    previous_by_vehicle = {
        row.vehicle_id: row
        for row in (
            db.query(Telemetry)
            .join(
                latest_subquery,
                and_(
                    Telemetry.vehicle_id == latest_subquery.c.vehicle_id,
                    Telemetry.recorded_at == latest_subquery.c.recorded_at,
                ),
            )
            .all()
        )
    }

    keys = [
        (vehicles[str(row["vehicle_code"])].id, row["recorded_at"])
        for row in normalized_rows
    ]
    existing_by_key = {}
    if keys:
        existing_by_key = {
            (row.vehicle_id, row.recorded_at): row
            for row in db.query(Telemetry).filter(tuple_(Telemetry.vehicle_id, Telemetry.recorded_at).in_(keys)).all()
        }

    result_rows: list[Telemetry] = []
    new_rows: list[Telemetry] = []
    created_by_key: dict[tuple[str, Any], Telemetry] = {}
    for normalized in sorted(normalized_rows, key=lambda row: (str(row["vehicle_code"]), row["recorded_at"])):
        vehicle = vehicles[str(normalized["vehicle_code"])]
        key = (vehicle.id, normalized["recorded_at"])
        existing = existing_by_key.get(key) or created_by_key.get(key)
        if existing:
            result_rows.append(existing)
            continue

        driver_code = str(normalized.get("driver_code") or normalized["vehicle_code"])
        driver = drivers[driver_code]
        prev = previous_by_vehicle.get(vehicle.id)
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
            driver_id=driver.id,
            **{k: v for k, v in normalized.items() if k not in {"vehicle_code", "driver_code"}},
            **derived,
        )
        db.add(row)
        result_rows.append(row)
        new_rows.append(row)
        created_by_key[key] = row
        previous_by_vehicle[vehicle.id] = row

    db.flush()
    update_inferred_trips_for_rows(db, new_rows, update_personal_factor=False)
    latest_by_vehicle: dict[str, Telemetry] = {}
    for row in new_rows:
        current = latest_by_vehicle.get(row.vehicle_id)
        if current is None or row.recorded_at > current.recorded_at:
            latest_by_vehicle[row.vehicle_id] = row
    for row in latest_by_vehicle.values():
        update_wait_event(db, row)
        maybe_create_charging_alert(db, row) or maybe_create_driver_risk_alert(db, row)
    return result_rows
