from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import SecurityEvent, User


SENSITIVE_METADATA_KEYS = {"password", "access_token", "refresh_token", "token", "secret", "api_key"}


def _client_ip(request: Request | None) -> str | None:
    if not request:
        return None
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _safe_metadata(metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    if not metadata:
        return None
    return {key: value for key, value in metadata.items() if key.lower() not in SENSITIVE_METADATA_KEYS}


def record_security_event(
    db: Session,
    *,
    event_type: str,
    request: Request | None = None,
    user: User | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        with db.begin_nested():
            db.add(
                SecurityEvent(
                    user_id=user.id if user else None,
                    event_type=event_type,
                    ip_address=_client_ip(request),
                    user_agent=(request.headers.get("user-agent")[:255] if request and request.headers.get("user-agent") else None),
                    event_metadata=_safe_metadata(metadata),
                )
            )
    except Exception:
        pass
