from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Driver, Trip, User
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai_features import deterministic_driver_profile, driver_coaching
from app.services.auth import get_current_user, require_roles
from app.services.rate_limit import check_rate_limit
from app.services.serializers import driver_dict, trip_dict

router = APIRouter(prefix="/drivers", tags=["drivers"])


class DriverProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trigger: Literal["trip_end", "post_nudge", "post_charging", "route_selection", "ignored_alert", "manual"] = "manual"
    metrics: dict = Field(default_factory=dict)


class DriverCoachingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_id: str | None = Field(default=None, max_length=64)
    trip_id: str | None = Field(default=None, max_length=64)
    mode: Literal["trip", "shift"] = "trip"


@router.get("")
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    query = db.query(Driver).filter(Driver.deleted_at.is_(None))
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


@router.get("/{driver_id}/profile")
def get_driver_profile(driver_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    driver = assert_driver_access(db, current_user, driver_id)
    profile = deterministic_driver_profile(db, driver, current_user)
    db.commit()
    return ok(profile)


@router.post("/{driver_id}/profile/update")
def update_driver_profile(
    driver_id: str,
    payload: DriverProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = assert_driver_access(db, current_user, driver_id)
    profile = deterministic_driver_profile(db, driver, current_user)
    if payload.metrics:
        profile["last_update_trigger"] = payload.trigger
        profile["manual_metric_keys"] = sorted(str(key) for key in payload.metrics.keys())[:20]
    db.commit()
    return ok(profile)


@router.post("/{driver_id}/coaching")
async def create_driver_coaching(
    driver_id: str,
    payload: DriverCoachingRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="driver-coaching",
        limit=settings.coaching_rate_limit_per_day,
        window_seconds=86_400,
        subject=f"driver:{driver_id}",
    )
    driver = assert_driver_access(db, current_user, driver_id)
    vehicle = assert_vehicle_access(db, current_user, payload.vehicle_id) if payload.vehicle_id else None
    trip = db.get(Trip, payload.trip_id) if payload.trip_id else None
    if trip and trip.driver_id != driver.id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trip not in driver's scope")
    result = driver_coaching(db, current_user, driver, vehicle, trip, payload.mode)
    db.commit()
    return ok(result)
