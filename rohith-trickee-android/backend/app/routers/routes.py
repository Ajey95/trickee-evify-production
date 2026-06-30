from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.auth import get_current_user
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai import AIToolRegistry, llm_client
from app.services.rate_limit import check_rate_limit
from app.services.route_scorer import route_scores, score_route

router = APIRouter(prefix="/routes", tags=["routes"])


class RouteScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str | None = Field(default=None, max_length=64)
    day_type: str = Field(default="weekday", pattern="^(weekday|weekend)$")
    slot: str = Field(default="morning", max_length=40)
    personal_factor: float = Field(default=1.1, ge=0.5, le=2.0)
    soc_start: float = Field(default=80.0, ge=0, le=100)
    origin: dict[str, float] | None = None
    destination: dict[str, float] | None = None
    origin_label: str | None = Field(default=None, max_length=120)
    dest_label: str | None = Field(default=None, max_length=120)


class RerouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str | None = Field(default=None, max_length=64)
    original_route: str = Field(default="A", max_length=8)
    incident_speed_kmh: float = Field(default=8.0, ge=0, le=120)
    personal_factor: float = Field(default=1.1, ge=0.5, le=2.0)
    soc_current: float = Field(default=65.0, ge=0, le=100)
    day_type: str = Field(default="weekday", pattern="^(weekday|weekend)$")
    slot: str = Field(default="morning", max_length=40)


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RouteExplainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_id: str = Field(min_length=1, max_length=64)
    origin: Location
    destination: Location
    current_soc: float = Field(ge=0, le=100)
    routes: list[str] = Field(default_factory=lambda: ["A", "B", "C"], min_length=1, max_length=6)


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
    return ok(
        route_scores(
            payload.day_type,
            payload.slot,
            personal_factor,
            payload.soc_start,
            origin=payload.origin,
            destination=payload.destination,
            origin_label=payload.origin_label,
            dest_label=payload.dest_label,
        )
    )


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


@router.post("/explain")
async def explain_route(
    payload: RouteExplainRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="route-explanation",
        limit=settings.route_explanation_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"driver:{payload.driver_id}",
    )
    driver = assert_driver_access(db, current_user, payload.driver_id)
    assert_vehicle_access(db, current_user, payload.vehicle_id)
    registry = AIToolRegistry(db, current_user, feature="route_explanation")
    route_result = registry.call(
        "get_route_score",
        {
            "driver_id": driver.id,
            "vehicle_id": payload.vehicle_id,
            "origin": payload.origin.model_dump(),
            "destination": payload.destination.model_dump(),
            "current_soc": payload.current_soc,
        },
    )
    traffic_result = registry.call(
        "get_environment_context",
        {"origin": payload.origin.model_dump(), "destination": payload.destination.model_dump()},
    )
    battery_result = registry.call("get_battery_prediction", {"vehicle_id": payload.vehicle_id})
    charger_result = registry.call("get_nearest_charger", {"driver_id": driver.id, "lat": payload.destination.lat, "lng": payload.destination.lng, "radius_m": 2000})
    ranked = route_result.data.get("ranked_routes") if route_result.success else []
    ranked = [row for row in ranked if str(row.get("route") or row.get("route_id")) in set(payload.routes)] or ranked
    recommended = ranked[0] if ranked else {}
    alternatives = []
    for row in ranked[1:]:
        route_name = row.get("route") or row.get("route_id")
        reason = row.get("feasibility_reason") or f"Higher combined time or battery score than {recommended.get('route') or recommended.get('route_id')}."
        alternatives.append({"route": route_name, "reason_not_chosen": reason})
    fallback = (
        f"{recommended.get('route_name') or recommended.get('route') or 'The top route'} is recommended based on the current route score. "
        "Traffic, battery, and charger context were checked where available."
    )
    llm = llm_client.compose(
        feature="route_explanation",
        system="Explain the selected EV route. Do not change the recommended route.",
        facts={
            "recommended": recommended,
            "alternatives": alternatives,
            "traffic": traffic_result.data,
            "battery": battery_result.data,
            "chargers": charger_result.data,
        },
        fallback=fallback,
        max_sentences=3,
    )
    llm_client.record(
        db,
        user=current_user,
        feature="route_explanation",
        result=llm,
        driver_id=driver.id,
        vehicle_id=payload.vehicle_id,
        tool_calls=[route_result.name, traffic_result.name, battery_result.name, charger_result.name],
    )
    db.commit()
    return ok(
        {
            "recommended_route": recommended.get("route") or recommended.get("route_id"),
            "explanation": llm.text,
            "alternatives": alternatives,
            "data_used": {
                "battery_score": battery_result.success,
                "traffic_score": traffic_result.success,
                "charger_context": charger_result.success,
            },
        }
    )
