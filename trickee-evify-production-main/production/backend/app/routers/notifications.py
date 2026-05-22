from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import NotificationPersonalizationLog, User
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai import AIToolRegistry, llm_client
from app.services.ai.safety import sanitize_payload, sanitize_text
from app.services.auth import get_current_user
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationPersonalizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alert_type: Literal["low_soc", "charging_opportunity", "driving_coaching", "route_change"]
    severity: Literal["low", "medium", "high", "critical"]
    action: str = Field(min_length=1, max_length=240)
    vehicle_id: str = Field(min_length=1, max_length=64)
    driver_id: str = Field(min_length=1, max_length=64)
    raw_data: dict[str, Any] = Field(default_factory=dict)


def _tone(severity: str) -> str:
    return {"low": "calm", "medium": "helpful", "high": "urgent", "critical": "critical"}[severity]


def _fallback(payload: NotificationPersonalizeRequest, facts: dict[str, Any]) -> str:
    vehicle = facts.get("vehicle_state", {}).get("latest", {})
    charger = (facts.get("nearest_charger", {}).get("chargers") or [{}])[0]
    if payload.alert_type == "charging_opportunity" and charger.get("name"):
        return f"{payload.action}. Nearest charger: {charger['name']}. Availability is not confirmed."
    if payload.alert_type == "low_soc" and vehicle.get("soc") is not None:
        return f"{payload.action}. Current SOC is {float(vehicle['soc']):.0f}%."
    return sanitize_text(payload.action, max_chars=220)


@router.post("/personalize")
async def personalize_notification(
    payload: NotificationPersonalizeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="notification-personalize",
        limit=settings.notification_personalization_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"driver:{payload.driver_id}",
    )
    assert_driver_access(db, current_user, payload.driver_id)
    assert_vehicle_access(db, current_user, payload.vehicle_id)

    since = datetime.utcnow() - timedelta(minutes=8)
    duplicate = (
        db.query(NotificationPersonalizationLog)
        .filter(
            NotificationPersonalizationLog.driver_id == payload.driver_id,
            NotificationPersonalizationLog.vehicle_id == payload.vehicle_id,
            NotificationPersonalizationLog.alert_type == payload.alert_type,
            NotificationPersonalizationLog.created_at >= since,
        )
        .order_by(desc(NotificationPersonalizationLog.created_at))
        .first()
    )
    if duplicate:
        return ok({"message": duplicate.message, "tone": duplicate.tone, "send": False, "fallback_used": duplicate.fallback_used})

    registry = AIToolRegistry(db, current_user, feature="notification_personalization")
    tools = [
        registry.call("get_driver_profile", {"driver_id": payload.driver_id}),
        registry.call("get_battery_prediction", {"vehicle_id": payload.vehicle_id}),
        registry.call("get_vehicle_state", {"vehicle_id": payload.vehicle_id}),
    ]
    if payload.alert_type == "charging_opportunity":
        latest = (tools[-1].data.get("latest") or {}) if tools[-1].success else {}
        if latest.get("lat") is not None and latest.get("lng") is not None:
            tools.append(registry.call("get_nearest_charger", {"driver_id": payload.driver_id, "lat": latest["lat"], "lng": latest["lng"], "radius_m": 2000}))
    facts = {tool.name: tool.data for tool in tools if tool.success}
    fallback = _fallback(payload, facts)
    result = llm_client.compose(
        feature="notification_personalization",
        system="You write short EV driver notifications. Backend already decided severity and action. Use only facts provided.",
        facts={"alert": payload.model_dump(), "tool_facts": facts, "tone": _tone(payload.severity)},
        fallback=fallback,
        max_sentences=2,
        max_tokens=120,
    )
    llm_client.record(
        db,
        user=current_user,
        feature="notification_personalization",
        result=result,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        tool_calls=[tool.name for tool in tools],
    )
    log = NotificationPersonalizationLog(
        user_id=current_user.id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        alert_type=payload.alert_type,
        severity=payload.severity,
        action=sanitize_text(payload.action, max_chars=240),
        message=result.text,
        tone=_tone(payload.severity),
        send=True,
        fallback_used=result.fallback_used,
        raw_data_summary=sanitize_payload(payload.raw_data),
    )
    db.add(log)
    db.commit()
    return ok({"message": result.text, "tone": log.tone, "send": True, "fallback_used": result.fallback_used})
