from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai_features import battery_insight
from app.services.auth import get_current_user
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/battery", tags=["battery"])


class BatteryInsightRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_id: str = Field(min_length=1, max_length=64)
    current_soc: float = Field(ge=0, le=100)
    trip_context: dict[str, Any] = Field(default_factory=dict)
    environment_context: dict[str, Any] = Field(default_factory=dict)


@router.post("/insight")
async def create_battery_insight(
    payload: BatteryInsightRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_rate_limit(
        request=request,
        namespace="battery-insight",
        limit=30,
        window_seconds=3600,
        subject=f"driver:{payload.driver_id}",
    )
    driver = assert_driver_access(db, current_user, payload.driver_id)
    vehicle = assert_vehicle_access(db, current_user, payload.vehicle_id)
    result = battery_insight(db, current_user, driver, vehicle, payload.current_soc, payload.trip_context, payload.environment_context)
    db.commit()
    return ok(result)
