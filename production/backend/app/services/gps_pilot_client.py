from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _fetch_google_identity_token(audience: str) -> str:
    return id_token.fetch_id_token(Request(), audience)


def fetch_gps_pilot_snapshot(settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    url = settings.gps_pilot_monitoring_url.strip()
    audience = settings.gps_pilot_monitoring_audience.strip()

    if not url or not audience:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GPS Pilot monitoring is not configured",
        )
    if settings.environment.lower() in {"production", "prod"} and not url.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GPS Pilot monitoring is not securely configured",
        )

    try:
        service_token = _fetch_google_identity_token(audience)
        with httpx.Client(timeout=settings.gps_pilot_request_timeout_seconds) as client:
            response = client.get(
                url,
                headers={"Authorization": f"Bearer {service_token}"},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="GPS Pilot monitoring timed out",
        ) from None
    except (GoogleAuthError, httpx.HTTPError, ValueError, TypeError):
        logger.exception("GPS Pilot monitoring bridge failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GPS Pilot monitoring is temporarily unavailable",
        ) from None

    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GPS Pilot monitoring returned an invalid response",
        )
    snapshot = payload.get("data")
    if not isinstance(snapshot, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GPS Pilot monitoring returned an invalid response",
        )
    return snapshot
