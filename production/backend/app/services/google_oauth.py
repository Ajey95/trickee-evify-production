from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

from app.config import get_settings

try:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token
except ImportError:  # pragma: no cover - dependency guard
    google_requests = None
    google_id_token = None


def _client_ids() -> list[str]:
    settings = get_settings()
    if not settings.google_oauth_client_ids:
        return []
    return [
        value.strip()
        for value in settings.google_oauth_client_ids.split(",")
        if value.strip()
    ]


def verify_google_id_token(id_token: str) -> dict[str, Any]:
    settings = get_settings()
    client_ids = _client_ids()
    if not client_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth client IDs are not configured",
        )
    if google_requests is None or google_id_token is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google-auth is not installed",
        )

    request = google_requests.Request()
    last_error: Exception | None = None
    for client_id in client_ids:
        try:
            payload = google_id_token.verify_oauth2_token(
                id_token,
                request,
                audience=client_id,
            )
            if payload.get("iss") not in {
                "accounts.google.com",
                "https://accounts.google.com",
            }:
                raise ValueError("Invalid Google token issuer")
            if settings.google_oauth_hosted_domain and payload.get("hd") != settings.google_oauth_hosted_domain:
                raise ValueError("Google account is outside the allowed domain")
            if payload.get("email_verified") is not True:
                raise ValueError("Google account email is not verified")
            return payload
        except Exception as exc:  # Try every configured client audience.
            last_error = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Google token",
    ) from last_error
