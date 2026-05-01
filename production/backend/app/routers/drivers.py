from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Driver, Trip, User
from app.schemas.api import ok
from app.services.access import assert_driver_access
from app.services.auth import get_current_user, require_roles
from app.services.serializers import driver_dict, trip_dict

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("")
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(Driver)
    if current_user.role == "fleet_operator":
        query = query.filter(Driver.fleet_id == current_user.fleet_id)
    return ok([driver_dict(driver) for driver in query.order_by(Driver.driver_code).all()])


@router.get("/me")
def driver_me(db: Session = Depends(get_db), current_user: User = Depends(require_roles("driver"))):
    driver = assert_driver_access(db, current_user, current_user.driver_id)
    return ok(driver_dict(driver))


@router.get("/{driver_id}")
def get_driver(driver_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    driver = assert_driver_access(db, current_user, driver_id)
    return ok(driver_dict(driver))


@router.get("/{driver_id}/trips")
def driver_trips(
    driver_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    rows = db.query(Trip).filter(Trip.driver_id == driver.id).order_by(Trip.started_at.desc()).limit(limit).all()
    return ok([trip_dict(row) for row in rows])
