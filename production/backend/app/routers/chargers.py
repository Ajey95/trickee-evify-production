from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai_features import recommend_charger
from app.services.auth import get_current_user
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/chargers", tags=["chargers"])


class ChargerRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_id: str = Field(min_length=1, max_length=64)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    soc: float = Field(ge=0, le=100)
    destination_km: float = Field(ge=0, le=500)
    available_time_min: float = Field(ge=0, le=180)


@router.post("/recommend")
async def charger_recommendation(
    payload: ChargerRecommendationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="charger-recommendation",
        limit=settings.charger_recommendation_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"driver:{payload.driver_id}",
    )
    driver = assert_driver_access(db, current_user, payload.driver_id)
    vehicle = assert_vehicle_access(db, current_user, payload.vehicle_id)
    result = recommend_charger(
        db,
        current_user,
        driver,
        vehicle,
        payload.lat,
        payload.lng,
        payload.soc,
        payload.destination_km,
        payload.available_time_min,
    )
    db.commit()
    return ok(result)
