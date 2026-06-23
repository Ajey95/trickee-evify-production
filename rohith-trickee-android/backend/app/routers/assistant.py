from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AssistantMessage, User
from app.schemas.api import ok
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai.safety import detect_prompt_injection, sanitize_text
from app.services.ai_features import assistant_answer
from app.services.auth import get_current_user
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/assistant", tags=["assistant"])


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class AssistantMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_id: str = Field(min_length=1, max_length=64)
    channel: Literal["app", "whatsapp"] = "app"
    message: str = Field(min_length=1, max_length=1200)
    location: Location | None = None


@router.post("/message")
async def send_assistant_message(
    payload: AssistantMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="assistant-message",
        limit=settings.assistant_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"driver:{payload.driver_id}",
    )
    driver = assert_driver_access(db, current_user, payload.driver_id)
    vehicle = assert_vehicle_access(db, current_user, payload.vehicle_id)
    if detect_prompt_injection(payload.message):
        response = {
            "intent": "UNKNOWN",
            "answer": "I can help with battery, route, and charger questions using live fleet data.",
            "tools_called": [],
            "confidence": 0.2,
            "escalated": False,
        }
    else:
        response = assistant_answer(
            db,
            current_user,
            driver,
            vehicle,
            payload.channel,
            payload.message,
            payload.location.model_dump() if payload.location else None,
        )
    db.add(
        AssistantMessage(
            user_id=current_user.id,
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            channel=payload.channel,
            message=sanitize_text(payload.message),
            response=response["answer"],
            intent=response["intent"],
            tool_calls=response["tools_called"],
            confidence=response["confidence"],
            escalated=response["escalated"],
        )
    )
    db.commit()
    return ok(response)
