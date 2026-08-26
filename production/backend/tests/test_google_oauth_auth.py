from __future__ import annotations

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import RefreshSession, User
from app.services.auth import create_access_token, get_current_user


def _client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "google-oauth-test-secret")
    monkeypatch.setenv("AUTH_REQUIRED_PROVIDER", "google")
    monkeypatch.setenv("LEGACY_AUTH_ENABLED", "false")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_IDS", "test-google-client")
    get_settings.cache_clear()

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        db.add(
            User(
                email="driver@example.com",
                full_name="Driver Example",
                role="driver",
                auth_provider="password",
                is_active=True,
            )
        )
        db.commit()

    def override_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), TestingSessionLocal


def test_google_login_maps_existing_user_and_returns_refresh_token(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    monkeypatch.setattr(
        "app.routers.auth.verify_google_id_token",
        lambda token: {
            "sub": "google-sub-1",
            "email": "driver@example.com",
            "email_verified": True,
            "name": "Driver Example",
        },
    )

    try:
        response = client.post("/api/v1/auth/google-login", json={"id_token": "valid-google-token"})

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["token_type"] == "bearer"
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["expires_in_seconds"] > 0
        assert data["user"]["google_sub"] == "google-sub-1"
        assert data["user"]["auth_provider"] == "google"

        with TestingSessionLocal() as db:
            user = db.query(User).filter(User.email == "driver@example.com").one()
            assert user.google_sub == "google-sub-1"
            assert user.auth_provider == "google"
            assert db.query(RefreshSession).filter(RefreshSession.user_id == user.id).count() == 1
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_google_login_auto_provisions_fixed_trickee_admin(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    monkeypatch.setattr(
        "app.routers.auth.verify_google_id_token",
        lambda token: {
            "sub": "google-admin-sub-1",
            "email": "ajaybhargavajaswanthreddy@trickee.co.in",
            "email_verified": True,
            "name": "Ajay Bhargava Jaswanth Reddy",
        },
    )

    try:
        response = client.post("/api/v1/auth/google-login", json={"id_token": "valid-google-token"})

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["user"]["email"] == "ajaybhargavajaswanthreddy@trickee.co.in"
        assert data["user"]["role"] == "trickee_admin"
        assert data["user"]["is_active"] is True
        assert data["user"]["google_sub"] == "google-admin-sub-1"
        assert data["user"]["auth_provider"] == "google"

        with TestingSessionLocal() as db:
            user = db.query(User).filter(
                User.email == "ajaybhargavajaswanthreddy@trickee.co.in"
            ).one()
            assert user.role == "trickee_admin"
            assert user.is_active is True
            assert user.deleted_at is None
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_google_login_restores_fixed_admin_role_for_active_user(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    with TestingSessionLocal() as db:
        db.add(
            User(
                email="ajaybhargavajaswanthreddy@trickee.co.in",
                full_name="Ajay Bhargava Jaswanth Reddy",
                role="fleet_operator",
                auth_provider="google",
                is_active=True,
            )
        )
        db.commit()
    monkeypatch.setattr(
        "app.routers.auth.verify_google_id_token",
        lambda token: {
            "sub": "google-admin-sub-2",
            "email": "ajaybhargavajaswanthreddy@trickee.co.in",
            "email_verified": True,
            "name": "Ajay Bhargava Jaswanth Reddy",
        },
    )

    try:
        response = client.post("/api/v1/auth/google-login", json={"id_token": "valid-google-token"})

        assert response.status_code == 200
        assert response.json()["data"]["user"]["role"] == "trickee_admin"
        with TestingSessionLocal() as db:
            user = db.query(User).filter(
                User.email == "ajaybhargavajaswanthreddy@trickee.co.in"
            ).one()
            assert user.role == "trickee_admin"
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_refresh_rotates_refresh_session(monkeypatch):
    client, TestingSessionLocal = _client(monkeypatch)
    monkeypatch.setattr(
        "app.routers.auth.verify_google_id_token",
        lambda token: {
            "sub": "google-sub-2",
            "email": "driver@example.com",
            "email_verified": True,
            "name": "Driver Example",
        },
    )

    try:
        login = client.post("/api/v1/auth/google-login", json={"id_token": "valid-google-token"})
        old_refresh = login.json()["data"]["refresh_token"]

        refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})

        assert refreshed.status_code == 200
        data = refreshed.json()["data"]
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["refresh_token"] != old_refresh

        reused = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert reused.status_code == 401

        with TestingSessionLocal() as db:
            sessions = db.query(RefreshSession).order_by(RefreshSession.created_at).all()
            assert len(sessions) == 2
            assert sessions[0].rotated_at is not None
            assert sessions[0].replaced_by_session_id == sessions[1].id
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()


def test_google_required_mode_rejects_password_style_jwt(db_session, monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "google-oauth-test-secret")
    monkeypatch.setenv("AUTH_REQUIRED_PROVIDER", "google")
    monkeypatch.setenv("LEGACY_AUTH_ENABLED", "true")
    get_settings.cache_clear()
    user = User(
        email="admin@example.com",
        full_name="Admin User",
        role="trickee_admin",
        auth_provider="password",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": user.id, "auth_provider": "password"})

    try:
        try:
            get_current_user(token=token, db=db_session)
        except HTTPException as exc:
            assert exc.status_code == 401
        else:
            raise AssertionError("password-style JWT was accepted in google-required mode")
    finally:
        get_settings.cache_clear()
