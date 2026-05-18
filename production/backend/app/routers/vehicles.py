from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Driver, Telemetry, User, Vehicle
from app.schemas.api import ok
from app.services.access import assert_vehicle_access
from app.services.auth import get_current_user, require_roles
from app.services.serializers import telemetry_dict, vehicle_dict

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("")
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(Vehicle).filter(Vehicle.deleted_at.is_(None))
    if current_user.role == "fleet_operator":
        query = query.filter(Vehicle.fleet_id == current_user.fleet_id)
    vehicles = query.order_by(Vehicle.vehicle_code).all()
    data = []
    for vehicle in vehicles:
        latest = (
            db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .first()
        )
        latest_driver = db.get(Driver, latest.driver_id) if latest and latest.driver_id else None
        data.append(vehicle_dict(vehicle, latest, latest_driver))
    return ok(data)


@router.get("/me")
def my_vehicles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "driver" or not current_user.driver_id:
        return ok([])

    latest_rows = (
        db.query(Telemetry)
        .filter(Telemetry.driver_id == current_user.driver_id)
        .order_by(desc(Telemetry.recorded_at))
        .limit(200)
        .all()
    )

    data = []
    seen_vehicle_ids: set[str] = set()
    for latest in latest_rows:
        if latest.vehicle_id in seen_vehicle_ids:
            continue
        vehicle = db.get(Vehicle, latest.vehicle_id)
        if not vehicle:
            continue
        if vehicle.deleted_at is not None:
            continue
        seen_vehicle_ids.add(vehicle.id)
        latest_driver = db.get(Driver, latest.driver_id) if latest.driver_id else None
        data.append(vehicle_dict(vehicle, latest, latest_driver))
    return ok(data)


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vehicle = assert_vehicle_access(db, current_user, vehicle_id)
    latest = (
        db.query(Telemetry).filter(Telemetry.vehicle_id == vehicle.id).order_by(desc(Telemetry.recorded_at)).first()
    )
    latest_driver = db.get(Driver, latest.driver_id) if latest and latest.driver_id else None
    return ok(vehicle_dict(vehicle, latest, latest_driver))


@router.get("/{vehicle_id}/telemetry")
def vehicle_telemetry(
    vehicle_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = assert_vehicle_access(db, current_user, vehicle_id)
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.vehicle_id == vehicle.id)
        .order_by(desc(Telemetry.recorded_at))
        .limit(min(limit, 500))
        .all()
    )
    return ok([telemetry_dict(row) for row in rows])
