from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.config import get_settings

try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials, messaging
except ImportError:  # pragma: no cover - optional dependency guard
    firebase_admin = None
    firebase_auth = None
    credentials = None
    messaging = None


@lru_cache
def _firebase_app():
    settings = get_settings()
    if firebase_admin is None or credentials is None:
        raise RuntimeError("firebase-admin is not installed")

    if firebase_admin._apps:
        return firebase_admin.get_app()

    cred = None
    if settings.firebase_service_account_json:
        data = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(data)
    elif settings.firebase_service_account_path:
        cred = credentials.Certificate(Path(settings.firebase_service_account_path))

    options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
    if cred:
        return firebase_admin.initialize_app(cred, options)
    return firebase_admin.initialize_app(options=options)


def firebase_configured() -> bool:
    settings = get_settings()
    return bool(settings.firebase_auth_enabled or settings.firebase_fcm_enabled)


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.firebase_auth_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Firebase auth is not enabled")
    if firebase_auth is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="firebase-admin is not installed")
    try:
        _firebase_app()
        return firebase_auth.verify_id_token(id_token, check_revoked=True)
    except Exception as exc:
        if "Token used too early" in str(exc):
            time.sleep(2)
            try:
                return firebase_auth.verify_id_token(id_token, check_revoked=True)
            except Exception as retry_exc:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token") from retry_exc
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token") from exc


def send_fcm_notification(tokens: list[str], title: str, body: str, data: dict[str, str] | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.firebase_fcm_enabled or not tokens:
        return {"sent": 0, "failed": 0, "enabled": settings.firebase_fcm_enabled}
    if messaging is None:
        return {"sent": 0, "failed": len(tokens), "error": "firebase-admin is not installed"}

    _firebase_app()
    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
    )
    response = messaging.send_each_for_multicast(message)
    return {"sent": response.success_count, "failed": response.failure_count}
