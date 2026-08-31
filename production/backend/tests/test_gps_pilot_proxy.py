from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.models import User
from app.services.auth import get_current_user
from app.services.gps_pilot_client import fetch_gps_pilot_snapshot


def _user(role: str) -> User:
    return User(
        id=f"{role}-user",
        email=f"{role}@example.com",
        full_name=role.replace("_", " ").title(),
        role=role,
        is_active=True,
    )


def test_gps_pilot_route_is_admin_only(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: _user("driver")
    try:
        response = TestClient(app).get("/api/v1/admin/gps-pilot")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert "Insufficient role" in response.json()["error"]


def test_gps_pilot_route_returns_upstream_snapshot(monkeypatch):
    snapshot = {
        "generated_at": "2026-08-31T10:00:00Z",
        "service_status": "healthy",
        "summary": {"active_trip_count": 1},
        "live_vehicles": [],
        "recent_trips": [],
        "recent_rejections": [],
    }
    app.dependency_overrides[get_current_user] = lambda: _user("trickee_admin")
    monkeypatch.setattr(
        "app.routers.gps_pilot.fetch_gps_pilot_snapshot",
        lambda: snapshot,
    )
    try:
        response = TestClient(app).get("/api/v1/admin/gps-pilot")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": snapshot,
        "message": "OK",
        "error": None,
    }


def test_proxy_fails_closed_when_configuration_is_missing():
    settings = Settings(
        database_url="sqlite://",
        gps_pilot_monitoring_url="",
        gps_pilot_monitoring_audience="",
    )

    with pytest.raises(HTTPException) as exc_info:
        fetch_gps_pilot_snapshot(settings=settings)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "GPS Pilot monitoring is not configured"


def test_proxy_normalizes_upstream_timeout(monkeypatch):
    settings = Settings(
        database_url="sqlite://",
        gps_pilot_monitoring_url="https://pilot.example/internal/monitoring",
        gps_pilot_monitoring_audience="https://pilot.example",
    )

    monkeypatch.setattr(
        "app.services.gps_pilot_client._fetch_google_identity_token",
        lambda audience: "service-identity-token",
    )

    class TimeoutClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, *args, **kwargs):
            import httpx

            raise httpx.TimeoutException("sensitive upstream detail")

    monkeypatch.setattr("app.services.gps_pilot_client.httpx.Client", TimeoutClient)

    with pytest.raises(HTTPException) as exc_info:
        fetch_gps_pilot_snapshot(settings=settings)

    assert exc_info.value.status_code == 504
    assert exc_info.value.detail == "GPS Pilot monitoring timed out"
    assert "sensitive" not in exc_info.value.detail
