import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AccessRequest, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
logger = logging.getLogger(__name__)
_JWKS_CACHE_TTL_SECONDS = 3600
_JWKS_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_SUPABASE_ASYMMETRIC_ALGORITHMS = {"ES256", "RS256"}

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(payload: dict[str, Any], expire_minutes: int | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes or settings.access_token_expire_minutes)
    to_encode = payload.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _workspace_access_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Workspace access is pending approval",
    )


def _decode_legacy_token(token: str, settings) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        return str(user_id) if user_id else None
    except JWTError:
        return None


def _normalized_supabase_url(settings) -> str | None:
    if not settings.supabase_url:
        return None
    return settings.supabase_url.rstrip("/")


def _supabase_issuer(settings) -> str | None:
    supabase_url = _normalized_supabase_url(settings)
    if not supabase_url:
        return None
    return f"{supabase_url}/auth/v1"


def _supabase_jwks_url(settings) -> str | None:
    if settings.supabase_jwks_url:
        return settings.supabase_jwks_url
    issuer = _supabase_issuer(settings)
    if not issuer:
        return None
    return f"{issuer}/.well-known/jwks.json"


def _fetch_supabase_jwks(jwks_url: str, *, force_refresh: bool = False) -> dict[str, Any]:
    now = time.time()
    cached = _JWKS_CACHE.get(jwks_url)
    if cached and not force_refresh and cached[0] > now:
        return cached[1]

    with httpx.Client(timeout=4.0) as client:
        resp = client.get(jwks_url)
        resp.raise_for_status()
        jwks = resp.json()

    _JWKS_CACHE[jwks_url] = (now + _JWKS_CACHE_TTL_SECONDS, jwks)
    return jwks


def _select_jwks_key(jwks: dict[str, Any], kid: str | None) -> dict[str, Any] | None:
    keys = jwks.get("keys") or []
    if kid:
        return next((key for key in keys if key.get("kid") == kid), None)
    return keys[0] if len(keys) == 1 else None


def _decode_supabase_token(token: str, settings) -> dict[str, Any] | None:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256" and settings.supabase_jwt_secret:
            issuer = _supabase_issuer(settings)
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                issuer=issuer,
            )

        if alg not in _SUPABASE_ASYMMETRIC_ALGORITHMS:
            return None

        issuer = _supabase_issuer(settings)
        jwks_url = _supabase_jwks_url(settings)
        if not issuer or not jwks_url:
            return None

        kid = header.get("kid")
        jwks = _fetch_supabase_jwks(jwks_url)
        key = _select_jwks_key(jwks, kid)
        if key is None and kid:
            # Supabase can rotate keys. Refresh once before rejecting the session.
            jwks = _fetch_supabase_jwks(jwks_url, force_refresh=True)
            key = _select_jwks_key(jwks, kid)

        if key is None:
            logger.warning("Supabase JWT key not found kid=%s", kid)
            return None

        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
        )
    except Exception as exc:
        logger.warning(
            "Supabase JWT validation failed alg=%s error=%s",
            locals().get("alg", "unknown"),
            exc.__class__.__name__,
        )
        return None


def _find_supabase_user(db: Session, payload: dict[str, Any]) -> User | None:
    supabase_user_id = payload.get("sub")
    email = payload.get("email")
    user = None
    if supabase_user_id:
        user = db.query(User).filter(User.supabase_user_id == str(supabase_user_id)).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.supabase_user_id = str(supabase_user_id) if supabase_user_id else None
            user.auth_provider = "supabase"
            db.commit()
            db.refresh(user)
    return user


def record_supabase_access_request(db: Session, payload: dict[str, Any]) -> AccessRequest | None:
    email = payload.get("email")
    if not email:
        return None
    metadata = payload.get("user_metadata") or {}
    requested_role = metadata.get("requested_role") or metadata.get("role") or "driver"
    if requested_role not in {"fleet_operator", "driver", "trickee_admin"}:
        requested_role = "fleet_operator"
    full_name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
    company = metadata.get("company") or metadata.get("fleet") or metadata.get("organization")
    row = db.query(AccessRequest).filter(AccessRequest.email == email).first()
    if not row:
        row = AccessRequest(email=email, full_name=full_name, company=company, requested_role=requested_role)
        db.add(row)
    row.supabase_user_id = str(payload.get("sub")) if payload.get("sub") else row.supabase_user_id
    row.full_name = full_name or row.full_name
    row.company = company or row.company
    if row.status == "pending":
        row.requested_role = requested_role
    db.commit()
    return row


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    credentials_error = _credentials_error()

    supabase_payload = _decode_supabase_token(token, settings)
    if supabase_payload:
        user = _find_supabase_user(db, supabase_payload)
        if not user or not user.is_active or user.deleted_at is not None:
            if not user:
                record_supabase_access_request(db, supabase_payload)
            raise _workspace_access_error()
        return user

    if not settings.legacy_auth_enabled:
        raise credentials_error

    user_id = _decode_legacy_token(token, settings)
    if not user_id:
        raise credentials_error

    user = db.get(User, user_id)
    if not user or not user.is_active or user.deleted_at is not None:
        raise credentials_error
    return user


def require_roles(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return dependency
