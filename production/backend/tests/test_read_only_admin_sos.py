from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import Fleet, SecurityEvent, User, Vehicle
from app.services.auth import create_access_token


def _client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "read-only-admin-test-secret")
    monkeypatch.setenv("AUTH_REQUIRED_PROVIDER", "google")
    monkeypatch.setenv("LEGACY_AUTH_ENABLED", "false")
    get_settings.cache_clear()

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        fleet = Fleet(name="Pilot Fleet", city="Ahmedabad")
        db.add(fleet)
        db.flush()
        viewer = User(
            email="jshah862@gmail.com",
            full_name="J Shah",
            role="trickee_admin",
            access_mode="read_only",
            capabilities=["mock_sos"],
            auth_provider="google",
            is_active=True,
        )
        full_admin = User(
            email="admin@example.com",
            full_name="Full Admin",
            role="trickee_admin",
            access_mode="full",
            capabilities=[],
            auth_provider="google",
            is_active=True,
        )
        vehicle = Vehicle(
            fleet_id=fleet.id,
            vehicle_code="OLA-S1-PILOT-01",
            make="Ola Electric",
            model="S1",
            max_range_km=121,
        )
        db.add_all([viewer, full_admin, vehicle])
        db.commit()
        db.refresh(viewer)
        db.refresh(full_admin)
        db.refresh(vehicle)
        ids = {"viewer": viewer.id, "full_admin": full_admin.id, "vehicle": vehicle.id}

    def override_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), TestingSessionLocal, ids


def _auth(user_id: str) -> dict[str, str]:
    token = create_access_token({"sub": user_id, "auth_provider": "google"})
    return {"Authorization": f"Bearer {token}"}


def test_read_only_admin_can_read_but_cannot_mutate(monkeypatch):
    client, _, ids = _client(monkeypatch)
    try:
        readable = client.get("/api/v1/admin/metrics", headers=_auth(ids["viewer"]))
        blocked = client.patch(
            f"/api/v1/admin/users/{ids['full_admin']}/mapping",
            headers=_auth(ids["viewer"]),
            json={"role": "trickee_admin", "is_active": False},
        )

        assert readable.status_code == 200
        assert blocked.status_code == 403
        assert blocked.json()["error"] == "This account has view-only access"
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_mock_sos_records_audit_without_sending_vehicle_command(monkeypatch):
    client, TestingSessionLocal, ids = _client(monkeypatch)
    try:
        response = client.post(
            "/api/v1/admin/mock-sos",
            headers=_auth(ids["viewer"]),
            json={
                "vehicle_id": ids["vehicle"],
                "confirmation": "SIMULATE VEHICLE OFF",
                "reason": "Dashboard demonstration",
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["simulated"] is True
        assert data["command_sent"] is False
        assert data["requested_action"] == "remote_vehicle_shutdown"
        assert data["vehicle"]["vehicle_code"] == "OLA-S1-PILOT-01"

        with TestingSessionLocal() as db:
            event = db.query(SecurityEvent).filter(
                SecurityEvent.event_type == "mock_sos_vehicle_disable_requested"
            ).one()
            assert event.user_id == ids["viewer"]
            assert event.event_metadata["vehicle_id"] == ids["vehicle"]
            assert event.event_metadata["simulated"] is True
            assert event.event_metadata["command_sent"] is False
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_mock_sos_is_denied_without_account_capability(monkeypatch):
    client, _, ids = _client(monkeypatch)
    try:
        response = client.post(
            "/api/v1/admin/mock-sos",
            headers=_auth(ids["full_admin"]),
            json={
                "vehicle_id": ids["vehicle"],
                "confirmation": "SIMULATE VEHICLE OFF",
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "Mock SOS is not enabled for this account"
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_mock_sos_requires_explicit_simulation_confirmation(monkeypatch):
    client, _, ids = _client(monkeypatch)
    try:
        response = client.post(
            "/api/v1/admin/mock-sos",
            headers=_auth(ids["viewer"]),
            json={"vehicle_id": ids["vehicle"], "confirmation": "TURN OFF"},
        )

        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
