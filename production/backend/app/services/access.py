from fastapi import HTTPException, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, Telemetry, User, Vehicle


def assert_vehicle_access(db: Session, user: User, vehicle_id: str) -> Vehicle:
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    if user.role == "trickee_admin":
        return vehicle
    if user.role == "fleet_operator" and vehicle.fleet_id == user.fleet_id:
        return vehicle
    if user.role == "driver" and user.driver_id:
        latest = (
            db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .first()
        )
        if latest and latest.driver_id == user.driver_id:
            return vehicle
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vehicle not in user's scope")


def assert_driver_access(db: Session, user: User, driver_id: str) -> Driver:
    driver = db.get(Driver, driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    if user.role == "trickee_admin":
        return driver
    if user.role == "fleet_operator" and driver.fleet_id == user.fleet_id:
        return driver
    if user.role == "driver" and user.driver_id == driver.id:
        return driver
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Driver not in user's scope")
