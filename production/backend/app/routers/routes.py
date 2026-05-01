from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.auth import get_current_user
from app.services.access import assert_driver_access
from app.services.route_scorer import route_scores, score_route

router = APIRouter(prefix="/routes", tags=["routes"])


class RouteScoreRequest(BaseModel):
    driver_id: str | None = None
    day_type: str = "weekday"
    slot: str = "morning"
    personal_factor: float = 1.1
    soc_start: float = 80.0


class RerouteRequest(BaseModel):
    driver_id: str | None = None
    original_route: str = "A"
    incident_speed_kmh: float = 8.0
    personal_factor: float = 1.1
    soc_current: float = 65.0
    day_type: str = "weekday"
    slot: str = "morning"


def _personal_factor_for_request(db: Session, user: User, driver_id: str | None, fallback: float) -> float:
    effective_driver_id = driver_id or (user.driver_id if user.role == "driver" else None)
    if not effective_driver_id:
        return fallback
    driver = assert_driver_access(db, user, effective_driver_id)
    return driver.personal_factor or fallback


@router.post("/score")
def score_routes(
    payload: RouteScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    personal_factor = _personal_factor_for_request(db, current_user, payload.driver_id, payload.personal_factor)
    return ok(route_scores(payload.day_type, payload.slot, personal_factor, payload.soc_start))


@router.post("/reroute")
def reroute(
    payload: RerouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    personal_factor = _personal_factor_for_request(db, current_user, payload.driver_id, payload.personal_factor)
    degraded = score_route(payload.original_route, payload.incident_speed_kmh, personal_factor, payload.soc_current)
    scored = route_scores(payload.day_type, payload.slot, personal_factor, payload.soc_current)["ranked_routes"]
    alternatives = [route for route in scored if route["route"] != payload.original_route]
    best = alternatives[0] if alternatives else None
    return ok({"original_route_now": degraded, "recommended_reroute": best})
