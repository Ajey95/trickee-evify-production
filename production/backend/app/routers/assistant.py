from __future__ import annotations

from typing import Literal

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
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


@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    await check_rate_limit(
        request=request,
        namespace="assistant-transcribe",
        limit=settings.assistant_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"user:{current_user.id}",
    )
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="Voice transcription is not configured.")
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio upload.")
    try:
        async with httpx.AsyncClient(timeout=settings.ai_request_timeout_seconds * 4) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                data={
                    "model": "whisper-large-v3",
                    "response_format": "json",
                    "language": "en",
                    "temperature": "0",
                },
                files={"file": (file.filename or "speech.m4a", audio, file.content_type or "audio/m4a")},
            )
        resp.raise_for_status()
        text = sanitize_text((resp.json().get("text") or "").strip(), max_chars=1200)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not transcribe audio.")
    # Whisper hallucinates stock phrases on silence — treat those as "no speech".
    _HALLUCINATIONS = {"thank you.", "thank you", "you", "thanks for watching!", ".", "bye."}
    if not text or text.lower() in _HALLUCINATIONS:
        raise HTTPException(status_code=422, detail="I didn't catch that — please speak and try again.")
    return ok({"text": text})


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
