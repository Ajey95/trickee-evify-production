from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Fleet, Telemetry, User
from app.services.auth import get_current_user
from app.services.ws_manager import manager


def _payload(reg_no: str = "GJ01YK9001", *, offset_seconds: int = 0) -> dict:
    event_time = datetime(2026, 5, 30, 10, 0, tzinfo=timezone.utc) + timedelta(seconds=offset_seconds)
    return {
        "RegNo": reg_no,
        "VehicleId": reg_no,
        "eventTime": event_time.isoformat().replace("+00:00", "Z"),
        "soc": 72,
        "BatteryVoltage": 52.1,
        "BatteryCurrent": 4.2,
        "Speed": 18,
        "Latitude": 21.1702,
        "Longitude": 72.8311,
        "MaxCellTemp": 34,
        "SOH": 97,
        "IgnitionOn": True,
    }


def _client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    fleet = Fleet(name="Pilot Fleet", city="Surat")
    user = User(email="bulk-api@example.com", full_name="Bulk API", role="fleet_operator", fleet=fleet)
    db.add_all([fleet, user])
    db.commit()
    db.refresh(user)
    db.close()

    def override_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        session = TestingSessionLocal()
        try:
            return session.get(User, user.id)
        finally:
            session.close()

    monkeypatch.setattr(manager, "schedule_vehicle_point_publish", lambda *args, **kwargs: None)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    client = TestClient(app)
    return client, TestingSessionLocal


def test_bulk_ingest_accepts_500_rows(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    try:
        rows = [_payload(offset_seconds=index) for index in range(500)]
        response = client.post("/api/v1/telemetry/evify/bulk", json=rows, headers={"Authorization": "Bearer test"})

        assert response.status_code == 200
        assert response.json()["data"]["ingested"] == 500
        with TestingSessionLocal() as db:
            assert db.query(Telemetry).count() == 500
    finally:
        app.dependency_overrides.clear()


def test_bulk_ingest_rejects_501_rows(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    try:
        rows = [_payload(offset_seconds=index) for index in range(501)]
        response = client.post("/api/v1/telemetry/evify/bulk", json=rows, headers={"Authorization": "Bearer test"})

        assert response.status_code == 413
        body = response.json()
        assert "500 rows" in (body.get("detail") or body.get("error") or body.get("message") or "")
        with TestingSessionLocal() as db:
            assert db.query(Telemetry).count() == 0
    finally:
        app.dependency_overrides.clear()


def test_bulk_ingest_duplicate_vehicle_timestamp_does_not_create_duplicates(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    try:
        row = _payload()
        first = client.post("/api/v1/telemetry/evify/bulk", json=[row], headers={"Authorization": "Bearer test"})
        second = client.post("/api/v1/telemetry/evify/bulk", json=[row], headers={"Authorization": "Bearer test"})

        assert first.status_code == 200
        assert second.status_code == 200
        with TestingSessionLocal() as db:
            assert db.query(Telemetry).count() == 1
    finally:
        app.dependency_overrides.clear()
