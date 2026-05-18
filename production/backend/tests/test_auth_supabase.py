import base64
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from app.config import get_settings
from app.models import User
from app.services.auth import create_access_token, get_current_user, hash_password


def _reset_settings(monkeypatch, **env):
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def _supabase_token(secret: str, sub: str, email: str) -> str:
    return jwt.encode(
        {
            "sub": sub,
            "email": email,
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        secret,
        algorithm="HS256",
    )


def _b64url_uint(value: int) -> str:
    raw = value.to_bytes(32, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _supabase_es256_token(sub: str, email: str, issuer: str, kid: str):
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_numbers = private_key.public_key().public_numbers()
    public_jwk = {
        "kty": "EC",
        "crv": "P-256",
        "kid": kid,
        "use": "sig",
        "alg": "ES256",
        "x": _b64url_uint(public_numbers.x),
        "y": _b64url_uint(public_numbers.y),
    }
    token = jwt.encode(
        {
            "sub": sub,
            "email": email,
            "aud": "authenticated",
            "iss": issuer,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        private_pem,
        algorithm="ES256",
        headers={"kid": kid},
    )
    return token, public_jwk


def test_supabase_token_maps_user_by_email(db_session, monkeypatch):
    _reset_settings(
        monkeypatch,
        SUPABASE_URL="",
        SUPABASE_JWT_SECRET="supabase-secret",
        SUPABASE_JWT_AUDIENCE="authenticated",
        LEGACY_AUTH_ENABLED="false",
    )
    user = User(
        email="fleet@example.com",
        full_name="Fleet User",
        role="fleet_operator",
        auth_provider="password",
        password_hash=None,
    )
    db_session.add(user)
    db_session.commit()

    token = _supabase_token("supabase-secret", "supabase-user-1", "fleet@example.com")
    current_user = get_current_user(token=token, db=db_session)

    assert current_user.id == user.id
    assert current_user.supabase_user_id == "supabase-user-1"
    assert current_user.auth_provider == "supabase"


def test_supabase_es256_token_verified_with_project_jwks(db_session, monkeypatch):
    project_url = "https://project-ref.supabase.co"
    issuer = f"{project_url}/auth/v1"
    token, public_jwk = _supabase_es256_token(
        "supabase-user-es256",
        "admin@example.com",
        issuer,
        "test-kid",
    )
    _reset_settings(
        monkeypatch,
        SUPABASE_URL=project_url,
        SUPABASE_JWT_AUDIENCE="authenticated",
        LEGACY_AUTH_ENABLED="false",
    )
    monkeypatch.setattr(
        "app.services.auth._fetch_supabase_jwks",
        lambda jwks_url, force_refresh=False: {"keys": [public_jwk]},
    )
    user = User(
        email="admin@example.com",
        full_name="Admin User",
        role="trickee_admin",
        auth_provider="supabase",
        password_hash=None,
    )
    db_session.add(user)
    db_session.commit()

    current_user = get_current_user(token=token, db=db_session)

    assert current_user.id == user.id
    assert current_user.supabase_user_id == "supabase-user-es256"
    assert current_user.role == "trickee_admin"


def test_legacy_token_rejected_when_rollback_disabled(db_session, monkeypatch):
    _reset_settings(monkeypatch, SECRET_KEY="legacy-secret", LEGACY_AUTH_ENABLED="false")
    user = User(
        email="admin@example.com",
        full_name="Admin User",
        role="trickee_admin",
        auth_provider="password",
        password_hash=hash_password("secret"),
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": user.id})
    with pytest.raises(HTTPException):
        get_current_user(token=token, db=db_session)


def test_legacy_token_allowed_when_rollback_enabled(db_session, monkeypatch):
    _reset_settings(monkeypatch, SECRET_KEY="legacy-secret", LEGACY_AUTH_ENABLED="true")
    user = User(
        email="admin@example.com",
        full_name="Admin User",
        role="trickee_admin",
        auth_provider="password",
        password_hash=hash_password("secret"),
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token({"sub": user.id})
    current_user = get_current_user(token=token, db=db_session)

    assert current_user.id == user.id
